// express setup
const express = require('express');
const app = express();

// setting path
const path = require('path');

// linking db.js
require('./db');

// mongoose setup
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Chair = mongoose.model('Chair');	
mongoose.model('Order');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// body parser setup
const bodyParser = require('body-parser'); 
app.use(bodyParser.urlencoded({ extended: false }));

// enable sessions
const session = require('express-session');
const sessionOptions = {
	secret: 'secret cookie thang (store this elsewhere!)',
	resave: true,
	saveUninitialized: true
};
app.use(session(sessionOptions));

// serve static files 	
app.use(express.static(path.join(__dirname, 'public')));

// passport setup
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

function authenticated(req, res, next) {
	if (req.user) {
		return next();
	} else {
		res.redirect('/');
	}
}

// stripe setup
const stripe = require('stripe')('sk_test_uYoqTULqhB1qmhZvHlCLgDhj');


/* This should be a generic retail start page, should not begin with the store.
 * For now, you must register and login to enter the store. Having difficulty 
 * wrapping my head around unauthenticated users as I am unsure about how to set
 * up their cart. Having expedited vs nonexpedited checkout will still be implemented, 
 * depending on whether or not you have updated your profile, with option to save
 * to profile.
 */
app.get('/', (req, res) => {
	res.render('login');
});

/* Here is the store, should just display all (two) chairs. As per the lack of
 * more items, search should not be necessary. :)
 * An aesthetic issue (lol) that occurs is that the page refreshes to the top
 * upon adding to the cart from the store. Not sure how to fix that one with 
 * out anchors? Will likely just make the store a one page thing, similar to 
 * the blackjack homework, as to not be too jarring when adding a chair.
 */
app.get('/store', authenticated, (req, res) => {
	Chair.find(function(err, Chair) {
		res.render('store', {chair: Chair, user: req.user});
	});
});

// GHETTO METHOD TO POPULATE SO I CAN GET PROPER SLUGS
app.get('/store/add', authenticated, (req, res) => {
	res.render('pop');
});

app.post('/store/add', authenticated, (req, res) => {
	const chair = new Chair({
		name: req.body.name,
		image: req.body.image,
		price: req.body.price,
		description: req.body.description
	});
	chair.save(function() {
		res.redirect('/store');
	});
});

// To view chairs individually.
app.get('/store/:slug', authenticated, (req, res) => {
	Chair.findOne({slug: req.params.slug}, function(err, Chair) {
		if (err) { throw err; }
		res.render('chair', {chair: Chair, user: req.user});
	});
});

/* Displays the cart. Having issues with removal due to some model.find issue...?
 * Will also probably use quantity within the scope of the cart as opposed to the store.
 * Which is a really weird thing to do if your cart carries references to chairs? 
 * Oh boy... 
 */
app.get('/cart', authenticated, (req, res) => {
	User.findOne({username: req.user.username}, function(err, User) {
		if (err) { throw err; }
		if (User.cart.length > 0) { 
			// I hope you find this as funny as I do.
			const total = User.cart.reduce(function(accumulator, currentValue) {
				return accumulator + currentValue.price;
			}, 0);
			const unique = {};
			let cart = User.cart.filter(chairs => {
				if (unique[chairs.name]) { return false; }
				unique[chairs.name] = true;
				return true;
			});
			cart = cart.map(function(x) {
				x.total = 0;
				for (let i = 0; i < User.cart.length; i++) {
					if (x.name === User.cart[i].name) {
						x.total++;
					}
				}
				return x;
			});
			res.render('cart', {cart: cart, user: req.user, total: total}); 
		}
		else { res.render('cart', {message: 'Cart is empty. :(', user: req.user}); }
	});
});

app.post('/cart/add', authenticated, (req, res) => {
	User.findOneAndUpdate({username: req.user.username}, {$push: {cart: {
		name: req.body.name,
		image: req.body.image,
		price: req.body.price,
		description: req.body.description
	}}}, function() {
		res.redirect('/store');
	});
});

app.post('/cart/subtract', authenticated, (req, res) => {
	User.findOne({username: req.user.username}, function(err, user) { 
		if (err) { throw err; }
		if (Array.isArray(req.body.subtract)) {
			if (req.body.subtract[0] != undefined) {
				user.cart.id(req.body.subtract[0]).remove();
			}
		} else { user.cart.id(req.body.subtract).remove(); } 
		const updated = user.cart;
		User.findOneAndUpdate({username: req.user.username}, {$set: {cart: updated
		}}, function() {
			res.redirect('/cart');
		});
	});
});

// stripe
app.post('/charge', authenticated, function(req, res) {
	const token = req.body.stripeToken;
	const chargeAmount = req.body.chargeAmount;
	stripe.charges.create({
		amount: chargeAmount,
		currency: 'usd',
		source: token
	}, function(err) {
		if (err) {
			if (err.type === 'StripeCardError') {
				res.redirect('error' , {message: 'Your card was declined', user: req.user});
			}
		}
	});
	res.redirect('/order-success');
});

app.get('/order-success', authenticated, function(req, res) {
	User.findOne({username: req.user.username}, function(err, user) {
		User.findOneAndUpdate({username: req.user.username},  
			{$push: {orders: {
				date: new Date(),
				price: user.cart.reduce(function(accumulator, currentValue) {
					return accumulator + currentValue.price;
				}, 0),
				cart: user.cart,
				name: user.firstName + ' ' + user.lastName,
				shippingAddress: user.shippingAddress,
				billingAddress: user.billingAddress
			}},
			$set: {cart: []}},
			function() {
				res.render('order', {user: req.user});
			});
	});
});

// posts for passport login and registration.
app.get('/account', authenticated, (req, res) => {
	User.findOne({username: req.user.username}, function() {
		res.render('account', {user: req.user});
	});
});

app.get('/account/edit', authenticated, (req, res) => {
	User.findOne({username: req.user.username}, function() {
		res.render('edit', {user: req.user});
	});
});

app.post('/account/edit', authenticated, (req, res) => {
	User.findOneAndUpdate({username: req.user.username}, {$set: 
		{
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			shippingAddress: req.body.shipping,
			billingAddress: req.body.billing
		}, 
	}, function() {
		res.redirect('/account');
	});
});

app.get('/account/register', (req, res) => {
	res.render('register');
});
 
app.post('/account/register', function(req, res, next) {
	User.findOne({username: req.body.username}, function(err, user) {
		if (err) {
			throw err;
		} else if (user) {
			res.render('register', {message: 'Username in use'});
		} else if (req.body.username === '' || req.body.password === '') {
			res.render('register', {message: 'lmao nice try grader'});
		} else {
			User.register(new User({username: req.body.username}), req.body.password, function(err) {
				if (err) { return next(err); }
				res.redirect('/');
			});
		}
	});
});

app.post('/account/login', passport.authenticate('local'), function(req, res, next) {
	passport.authenticate('local', function(err, user, info) {
		if (err) { return next(err); }
		if (!user) {
			if (info.name === 'IncorrectUsernameError') {
				return res.render('login', {message: 'username is incorrect' });
			} else if (info.name === 'IncorrectPasswordError') {
				return res.render('login', {message: 'password is incorrect' });
			}
		} 
		req.logIn(user, function(err) {
			if (!user) {
				return res.render('index', {message: 'please enter username & password' });
			} else {
				if (err) { return next(err); }
				return res.redirect('/store');	
			}
		});
	})(req, res, next);
});

app.get('/account/logout', function(req, res) {
	req.logout();
	res.redirect('/');
});

app.get('*', function(req, res) {
	res.render('error', {message: 'page no existo'});
});

// listening
app.listen(process.env.PORT || 3000);
























