// File: middleware/auth.middleware.js

const jwt = require('jsonwebtoken');
require('dotenv').config();

const auth = (req, res, next) => {
  try {
    if (!req.headers.authorization) {
      return res.status(401).json({ message: 'Authorization header missing. Access denied.' });
    }

    const token = req.headers.authorization.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied.' });
    }

    const decodedData = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decodedData;
    next();

  } catch (error) {
    res.status(401).json({ message: 'Token is not valid or has expired.' });
  }
};

module.exports = auth;