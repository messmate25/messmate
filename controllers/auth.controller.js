// File: controllers/auth.controller.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const emailjs = require('@emailjs/nodejs');
require('dotenv').config();

/**
 * Helper to get initialized models from request
 */
const getModels = (req) => req.app.locals.models;

// --- User Registration ---
exports.register = async (req, res) => {
  try {
    const { name, email, password, room_no, role } = req.body;
    const { User } = getModels(req);

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      room_no,
      role: role || 'student'
    });

    res.status(201).json({
      message: 'User registered successfully!',
      userId: newUser.id,
    });

  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- User Login ---
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const { User } = getModels(req);

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { email: user.email, id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({ result: { id: user.id, role: user.role }, token });

  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- Guest Signup (Request OTP) ---
exports.guestSignup = async (req, res) => {
  try {
    const { name, email } = req.body; // treat as email
    const { Guest } = getModels(req);

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required.' });
    }

    // Find or create guest
    const [guest, created] = await Guest.findOrCreate({
      where: { mobile_number: email }, // store email in mobile_number column
      defaults: { name }
    });

    if (!created && guest.name !== name) {
      guest.name = name;
      await guest.save();
    }

    // Generate OTP (6-digit random)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    guest.otp = otp;
    guest.otp_expires_at = otpExpiry;
    await guest.save();

    // Send OTP via EmailJS
    try {
      await emailjs.send(
        process.env.EMAILJS_SERVICE_ID,
        process.env.EMAILJS_TEMPLATE_ID,
        { to_email: email, otp },
        { publicKey: process.env.EMAILJS_PUBLIC_KEY, privateKey: process.env.EMAILJS_PRIVATE_KEY }
      );
    } catch (emailError) {
      console.error("EmailJS send error:", emailError.message);
      // fallback: return OTP in response for dev/testing
    }

    res.status(200).json({
      message: `OTP sent successfully to ${email}`,
      otp: process.env.NODE_ENV === 'development' ? otp : undefined // only return OTP in dev
    });

  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- Guest Login (Verify OTP) ---
exports.guestVerifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const { Guest } = getModels(req);

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required.' });
    }

    const guest = await Guest.findOne({ where: { mobile_number: email } });
    if (!guest) {
      return res.status(404).json({ message: 'Guest not found. Please sign up first.' });
    }

    if (guest.otp !== otp || !guest.otp_expires_at || new Date() > guest.otp_expires_at) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    // OTP valid -> clear it
    guest.otp = null;
    guest.otp_expires_at = null;
    await guest.save();

    const token = jwt.sign(
      { id: guest.id, name: guest.name, email: guest.mobile_number, role: 'guest' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Guest logged in successfully!',
      result: { id: guest.id, role: 'guest' },
      token
    });

  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};