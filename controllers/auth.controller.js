const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require("nodemailer");

/**
 * Helper to get initialized models from request
 */
const getModels = (req) => req.app.locals.models;

// --- User Registration (Regular with Password) ---
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

// --- User Login (Password-based) ---
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const { User } = getModels(req);

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Check if user has password (regular user)
    if (!user.password) {
      return res.status(400).json({ 
        message: 'This account uses OTP login. Please use guest verification.' 
      });
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

    res.status(200).json({ 
      message: 'Login successful',
      result: { id: user.id, name: user.name, role: user.role, email: user.email },
      token 
    });

  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- Guest Signup (Request OTP) ---
exports.guestSignup = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const { Guest, User } = getModels(req);

    if (!name || !email || !phone) {
      return res.status(400).json({ message: "Name, email, and phone are required." });
    }

    // Check if already a regular user
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser && existingUser.password) {
      return res.status(409).json({ 
        message: "This email is already registered as a regular user. Please use password login." 
      });
    }

    // Find or create guest
    const [guest, created] = await Guest.findOrCreate({
      where: { mobile_number: email },
      defaults: { name, phone }
    });

    if (!created && guest.name !== name) {
      guest.name = name;
      await guest.save();
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    guest.otp = otp;
    guest.otp_expires_at = otpExpiry;
    await guest.save();

    // Send OTP email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"MessApp" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your OTP for MessApp Signup",
      text: `Hello ${name},\n\nYour OTP is: ${otp}\nIt is valid for 5 minutes.\n\nThanks,\nMessApp Team`,
      html: `<p>Hello ${name},</p><p>Your OTP is: <b>${otp}</b></p><p>It is valid for 5 minutes.</p><p>Thanks,<br/>MessApp Team</p>`,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`OTP email sent successfully to ${email}`);
      return res.status(200).json({
        message: `OTP sent successfully to ${email}`,
        otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      });
    } catch (mailError) {
      console.error("Nodemailer send error:", mailError);
      return res.status(500).json({
        message: "Failed to send OTP email.",
        error: mailError.message,
      });
    }

  } catch (error) {
    return res.status(500).json({
      message: "Something went wrong.",
      error: error.message,
    });
  }
};

// --- Guest/User OTP Verification & Login ---
exports.verifyOTPAndLogin = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const { Guest, User } = getModels(req);

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    // 1. Verify OTP in guest table
    const guest = await Guest.findOne({ where: { mobile_number: email } });
    if (!guest) {
      return res.status(404).json({ 
        message: "No OTP request found. Please sign up first." 
      });
    }

    // Check OTP validity
    if (
      guest.otp !== otp ||
      !guest.otp_expires_at ||
      new Date() > guest.otp_expires_at
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    // 2. Clear OTP from guest table
    guest.otp = null;
    guest.otp_expires_at = null;
    await guest.save();

    // 3. Find or create user in users table
    let user = await User.findOne({ where: { email } });
    
    if (!user) {
      // Create new user (student) from guest data
      user = await User.create({
        name: guest.name,
        email: email,
        password: null, // No password for OTP-based users
        phone: guest.phone,
        role: 'guest',
        wallet_balance: guest.wallet_balance || 0.00,
        room_no: null
      });
    } else if (user.password) {
      // If user already exists with password, they can't use OTP login
      return res.status(400).json({
        message: "This account uses password login. Please use password instead."
      });
    }

    // 4. Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        phone: user.phone
      },
      process.env.JWT_SECRET,
      { expiresIn: "72h" }
    );

    res.status(200).json({
      message: "Login successful!",
      result: { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        role: user.role,
        phone: user.phone,
        wallet_balance: user.wallet_balance
      },
      token,
    });

  } catch (error) {
    res.status(500).json({ 
      message: "Something went wrong.", 
      error: error.message 
    });
  }
};

// --- Update Password ---
exports.updatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const { User } = getModels(req);
    const userId = req.user.id;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    // Check if user has password (not OTP-based user)
    if (!user.password) {
      return res.status(400).json({ 
        message: "This account uses OTP login. Please set a password first." 
      });
    }

    const isPasswordCorrect = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordCorrect)
      return res.status(400).json({ message: "Old password is incorrect." });

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await user.update({ password: hashedNewPassword });

    res.status(200).json({ message: "Password updated successfully." });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong.", error: error.message });
  }
};

// --- Set Password for OTP-based Users ---
exports.setPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const { User } = getModels(req);

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: "User not found." });

    // Check if user already has password
    if (user.password) {
      return res.status(400).json({ 
        message: "Password already set. Use update password instead." 
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await user.update({ password: hashedPassword });

    res.status(200).json({ message: "Password set successfully." });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong.", error: error.message });
  }
};