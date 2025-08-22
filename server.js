// File: server.js

const express = require('express');
require('dotenv').config();
const path = require('path');

const sequelize = require('./config/database');

// --- Import Models ---
const User = require('./models/user.model');
const MenuItem = require('./models/menuItem.model');
const WeeklyMenu = require('./models/weeklyMenu.model');
const WeeklySelection = require('./models/weeklySelection.model');
const MealHistory = require('./models/mealHistory.model');
const Guest = require('./models/guest.model');

// --- Import Services ---
const { startDefaultMenuJob } = require('./services/cron.service');

// --- Import Routes ---
const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/student.routes');
const adminRoutes = require('./routes/admin.routes');
const guestRoutes = require('./routes/guest.routes');

const app = express();

// --- Middleware ---
app.use(express.json());

const PORT = process.env.PORT || 3000;

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/guest', guestRoutes);

// A simple test route to confirm the server is running
app.get('/', (req, res) => {
  res.send('Mess App Backend is running successfully!');
});


// --- Define Model Associations ---
MenuItem.hasMany(WeeklyMenu, { foreignKey: 'menuItemId' });
WeeklyMenu.belongsTo(MenuItem, { foreignKey: 'menuItemId' });

User.hasMany(WeeklySelection, { foreignKey: 'userId' });
WeeklySelection.belongsTo(User, { foreignKey: 'userId' });

MenuItem.hasMany(WeeklySelection, { foreignKey: 'menuItemId' });
WeeklySelection.belongsTo(MenuItem, { foreignKey: 'menuItemId' });

User.hasMany(MealHistory, { foreignKey: 'userId' });
MealHistory.belongsTo(User, { foreignKey: 'userId' });

Guest.hasMany(MealHistory, { foreignKey: 'guestId' });
MealHistory.belongsTo(Guest, { foreignKey: 'guestId' });


// Start the server and connect to the database
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  try {
    // Test the database connection
    await sequelize.authenticate();
    console.log('✅ Database connection has been established successfully.');

    // Sync all defined models to the database.
    await sequelize.sync({ force: false });
    console.log('✅ All models were synchronized successfully.');

    // Start the scheduled jobs
    startDefaultMenuJob();
    console.log('🕒 Cron job for default menu assignment has been scheduled.');

  } catch (error) {
    console.error('❌ Unable to connect to the database or sync models:', error);
  }
});
