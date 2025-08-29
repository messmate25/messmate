// File: controllers/admin.controller.js

const { WeeklyMenu, MenuItem, MealHistory } = require('../models');
const Guest = require('../models/guest.model');
const User = require('../models/user.model');
const { Op, fn, col } = require('sequelize');

// --- Super Admin Function ---
exports.setWeeklyMenu = async (req, res) => {
    try {
        const { week_start_date, menu } = req.body; // menu is an array of objects

        if (!week_start_date || !menu) {
            return res.status(400).json({ message: 'Week start date and menu are required.' });
        }

        // Clear any existing menu for that week
        await WeeklyMenu.destroy({ where: { week_start_date: week_start_date } });

        const menuEntries = menu.map(entry => ({
            week_start_date: week_start_date,
            day_of_week: entry.day_of_week,
            meal_type: entry.meal_type,
            menuItemId: entry.menuItemId
        }));

        await WeeklyMenu.bulkCreate(menuEntries);

        res.status(201).json({ message: `Menu for the week of ${week_start_date} has been set.` });
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong.', error: error.message });
    }
};

// --- Dashboard ---
exports.getDashboardStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const mealCounts = await MealHistory.findAll({
            where: {
                scanned_at: {
                    [Op.between]: [today, tomorrow]
                }
            },
            attributes: [
                'meal_type',
                [fn('COUNT', col('id')), 'count']
            ],
            group: ['meal_type']
        });

        const guestRevenue = await MealHistory.sum('total_cost', {
            where: {
                guestId: { [Op.ne]: null },
                scanned_at: {
                    [Op.between]: [today, tomorrow]
                }
            }
        });

        const stats = {
            breakfast_count: 0,
            lunch_count: 0,
            dinner_count: 0,
            total_guest_revenue: guestRevenue || 0
        };

        mealCounts.forEach(mc => {
            const mealType = mc.getDataValue('meal_type');
            const count = mc.getDataValue('count');
            if (mealType === 'breakfast') stats.breakfast_count = count;
            if (mealType === 'lunch') stats.lunch_count = count;
            if (mealType === 'dinner') stats.dinner_count = count;
        });

        res.status(200).json(stats);

    } catch (error) {
        res.status(500).json({ message: 'Something went wrong.', error: error.message });
    }
};

// --- Menu Management (Adding Thalis) ---
exports.addMenuItem = async (req, res) => {
  try {
    const { name, estimated_prep_time, monthly_limit, extra_price } = req.body;
    const newItem = await MenuItem.create({
      name,
      estimated_prep_time,
      monthly_limit,
      extra_price,
    });
    res.status(201).json({ message: 'Thali added successfully!', item: newItem });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- Guest Wallet Management ---
exports.rechargeGuestWallet = async (req, res) => {
  try {
    const { guestId, amount } = req.body;
    if (!guestId || !amount) {
      return res.status(400).json({ message: 'Guest ID and amount are required.' });
    }
    const guest = await Guest.findByPk(guestId);
    if (!guest) {
      return res.status(404).json({ message: 'Guest not found.' });
    }
    const newBalance = parseFloat(guest.wallet_balance) + parseFloat(amount);
    guest.wallet_balance = newBalance;
    await guest.save();
    res.status(200).json({
      message: 'Wallet recharged successfully!',
      guestId: guest.id,
      new_balance: guest.wallet_balance
    });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- QR Code Scanning ---
exports.scanMealQR = async (req, res) => {
  try {
    const { qr_data } = req.body;
    if (!qr_data) {
      return res.status(400).json({ message: 'QR data is required.' });
    }

    let mealDetails;
    try {
        mealDetails = JSON.parse(qr_data);
    } catch (e) {
        return res.status(400).json({ message: 'Invalid QR code format.' });
    }

    const { userId, guestId, meal_date, meal_type } = mealDetails;

    const whereClause = { meal_date, meal_type };
    if (userId) {
      whereClause.userId = userId;
    } else if (guestId) {
      whereClause.guestId = guestId;
    } else {
      return res.status(400).json({ message: 'Invalid QR code: No user or guest ID found.' });
    }

    const existingEntry = await MealHistory.findOne({ where: whereClause });

    if (existingEntry) {
      return res.status(409).json({ message: 'This meal has already been redeemed today.' });
    }

    if (userId) {
        await MealHistory.create({
            userId: userId,
            meal_date: meal_date,
            meal_type: meal_type,
            qr_code_data: qr_data,
        });
    }

    res.status(200).json({ message: 'Meal verified successfully!', mealDetails });

  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- User Management ---
exports.getAllUsers = async (req, res) => {
    try {
        const students = await User.findAll({
            where: { role: 'student' },
            attributes: ['id', 'name', 'email', 'room_no', 'role']
        });

        const guests = await Guest.findAll({
            attributes: ['id', 'name', 'mobile_number', 'wallet_balance']
        });

        res.status(200).json({ students, guests });
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong.', error: error.message });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password'] }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong.', error: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        await user.destroy();
        res.status(200).json({ message: 'User deleted successfully.' });

    } catch (error) {
        if (error.name === 'SequelizeForeignKeyConstraintError') {
            return res.status(409).json({ message: 'Cannot delete user. They have associated records (e.g., meal history). Please deactivate instead.' });
        }
        res.status(500).json({ message: 'Something went wrong.', error: error.message });
    }
};
