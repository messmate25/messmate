// File: controllers/auth.controller.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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
    const { name, mobile_number } = req.body;
    const { Guest } = getModels(req);

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

    const mockOtp = "123456"; // mock OTP
    res.status(200).json({
      message: 'OTP sent successfully (mock).',
      otp: mockOtp
    });

  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- Guest Login (Verify OTP) ---
exports.guestVerifyOTP = async (req, res) => {
  try {
    const { mobile_number, otp } = req.body;
    const { Guest } = getModels(req);

    if (otp !== "123456") {
      return res.status(400).json({ message: 'Invalid OTP.' });
    }

    const guest = await Guest.findOne({ where: { mobile_number } });
    if (!guest) {
      return res.status(404).json({ message: 'Guest not found. Please sign up first.' });
    }

    const token = jwt.sign(
      { id: guest.id, name: guest.name, mobile_number: guest.mobile_number, role: 'guest' },
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
