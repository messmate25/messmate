// File: controllers/auth.controller.js

const db = require('../models'); // assumes index.js initializes Sequelize and exports models
const User = db.User;
const Guest = db.Guest;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// --- User Registration ---
exports.register = async (req, res) => {
  try {
    const { name, email, password, room_no, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

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
      role: role || 'student' // Default role
    });

    res.status(201).json({
      message: 'User registered successfully!',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        room_no: newUser.room_no
      }
    });

  } catch (error) {
    console.error("Error in registering user:", error);
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- User Login ---
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.status(200).json({
      message: 'Login successful!',
      result: { id: user.id, role: user.role, name: user.name },
      token
    });

  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- Guest Signup (Request OTP) ---
exports.guestSignup = async (req, res) => {
  try {
    const { name, mobile_number } = req.body;

    if (!name || !mobile_number) {
      return res.status(400).json({ message: 'Name and mobile number are required.' });
    }

    const [guest, created] = await Guest.findOrCreate({
      where: { mobile_number },
      defaults: { name }
    });

    if (!created && guest.name !== name) {
      guest.name = name;
      await guest.save();
    }

    const mockOtp = "123456"; // Replace later with real OTP service

    res.status(200).json({
      message: 'OTP sent successfully (mock).',
      otp: mockOtp
    });

  } catch (error) {
    console.error("Error in guest signup:", error);
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- Guest Login (Verify OTP) ---
exports.guestVerifyOTP = async (req, res) => {
  try {
    const { mobile_number, otp } = req.body;

    if (!mobile_number || !otp) {
      return res.status(400).json({ message: 'Mobile number and OTP are required.' });
    }

    if (otp !== "123456") {
      return res.status(400).json({ message: 'Invalid OTP.' });
    }

    const guest = await Guest.findOne({ where: { mobile_number } });
    if (!guest) {
      return res.status(404).json({ message: 'Guest not found. Please sign up first.' });
    }

    const token = jwt.sign(
      { id: guest.id, role: 'guest', name: guest.name, mobile_number: guest.mobile_number },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.status(200).json({
      message: 'Guest logged in successfully!',
      result: { id: guest.id, role: 'guest', name: guest.name },
      token
    });

  } catch (error) {
    console.error("Error in guest login:", error);
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};
