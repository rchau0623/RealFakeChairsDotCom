const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const URLSlugs = require('mongoose-url-slugs');
const passportLocalMongoose = require('passport-local-mongoose');

/* Chairs
 * Users will not be able to add chairs. Chairs should be added directly into a mongodb. 
 * Should chairs include quantity?
 * Should include a name.
 * Should include a price.
 * Should include an image of the chair. 
 */
const chairSchema = new mongoose.Schema({
	name: {type: String, required: true},
	image: {type: String, required: true},
	price: {type: Number, required: true},
	description: {type: String, required: true}
});

const orderSchema = new mongoose.Schema({
	date: {type: Date, required: true},
	price: {type: Number, required: true},
	cart: [chairSchema],
	name: {type: String, required: true},
	shippingAddress: {type: String, required: true},
	billingAddress: {type: String, required: true}
});

/* Users
 * Should our site require authentication?
 * Users should be able to register.
 * Users should have a username and password.
 * Users should be able to log on.
 * Users should be able to store billing and shipping address.
 * Users should have an expedited checkout.
 */
const userSchema = new mongoose.Schema({
	username: {type: String, required: true},
	cart: [chairSchema],
	firstName: String,
	lastName: String,
	billingAddress: String,
	shippingAddress: String,
	orders: [orderSchema]
});

// TODO: add remainder of setup for slugs, connection, registering models, etc. below

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(URLSlugs('username'));
chairSchema.plugin(URLSlugs('name'));

mongoose.model('User', userSchema);
mongoose.model('Order', orderSchema);
mongoose.model('Chair', chairSchema);

// is the environment variable, NODE_ENV, set to PRODUCTION? 
let dbconf;
if (process.env.NODE_ENV === 'PRODUCTION') {
	// if we're in PRODUCTION mode, then read the configration from a file
	// use blocking file io to do this...
	const fs = require('fs');
	const path = require('path');
	const fn = path.join(__dirname, 'config.json');
	const data = fs.readFileSync(fn);
	// our configuration file will be in json, so parse it and set the
	// conenction string appropriately!
	const conf = JSON.parse(data);
	dbconf = conf.dbconf;
} else {
	// if we're not in PRODUCTION mode, then use
	dbconf = 'mongodb://localhost/rc3009';
}

mongoose.connect(dbconf);
