const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_YourKeyId',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'YourKeySecret',
});

module.exports = razorpay;