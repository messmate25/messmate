// File: controllers/admin.controller.js

const { Op, fn, col } = require('sequelize');

/**
 * Helper to get initialized models from request
 */
const getModels = (req) => req.app.locals.models;

const { BlobServiceClient } = require("@azure/storage-blob");

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = "image";

const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

// --- Super Admin Function ---
// Set weekly menu
exports.setWeeklyMenu = async (req, res) => {
  try {
    const { week_start_date, menu } = req.body; // menu is an array of objects
    const { WeeklyMenu } = getModels(req);

    if (!week_start_date || !menu) {
      return res.status(400).json({ message: 'Week start date and menu are required.' });
    }

    // Clear any existing menu for that week
    await WeeklyMenu.destroy({ where: { week_start_date } });

    const menuEntries = menu.map(entry => ({
      week_start_date,
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

// Fetch weekly menus with menu item names
exports.getWeeklyMenus = async (req, res) => {
  try {
    const { week_number, start_date } = req.query; // optional query params
    const { WeeklyMenu, MenuItem } = getModels(req);

    if (week_number && !start_date) {
      return res.status(400).json({ message: 'Please provide start_date when using week_number.' });
    }

    let menus;

    if (week_number && start_date) {
      const startDateObj = new Date(start_date);
      const targetDate = new Date(startDateObj);
      targetDate.setDate(startDateObj.getDate() + (7 * (parseInt(week_number) - 1)));
      const targetWeek = targetDate.toISOString().split('T')[0]; // format YYYY-MM-DD

      menus = await WeeklyMenu.findAll({
        where: { week_start_date: targetWeek },
        include: [{ model: MenuItem, attributes: ['name', 'description', 'image_url'] }],
        order: [['day_of_week', 'ASC'], ['meal_type', 'ASC']]
      });
    } else {
      menus = await WeeklyMenu.findAll({
        include: [{ model: MenuItem, attributes: ['name', 'description', 'image_url'] }],
        order: [['week_start_date', 'ASC'], ['day_of_week', 'ASC'], ['meal_type', 'ASC']]
      });
    }

    // Map to include menu item name directly
    const response = menus.map(m => ({
      id: m.id,
      week_start_date: m.week_start_date,
      day_of_week: m.day_of_week,
      meal_type: m.meal_type,
      menuItemId: m.menuItemId,
      name: m.MenuItem?.name || '',
      description: m.MenuItem?.description || '',
      imageUrl: m.MenuItem?.image_url || ''
    }));

    res.status(200).json({ menus: response });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// Delete weekly menu
exports.deleteWeeklyMenu = async (req, res) => {
  try {
    const { week_start_date } = req.params;
    const { WeeklyMenu } = getModels(req);

    if (!week_start_date) {
      return res.status(400).json({ message: 'Week start date is required.' });
    }

    const deleted = await WeeklyMenu.destroy({ where: { week_start_date } });

    if (deleted) {
      res.status(200).json({ message: `Weekly menu for ${week_start_date} has been deleted.` });
    } else {
      res.status(404).json({ message: `No weekly menu found for ${week_start_date}.` });
    }
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- Dashboard ---
exports.getDashboardStats = async (req, res) => {
  try {
    const { MealHistory } = getModels(req);
    const { Op } = require("sequelize");

    // Helper to aggregate item counts
    const aggregateItems = (mealHistories) => {
      const mealStats = {};

      mealHistories.forEach(mh => {
        const isValid = mh.is_valid ? 1 : 0;
        let items = [];
        try {
          const qrData = JSON.parse(mh.qr_code_data);
          items = qrData.items || [];
        } catch (err) {
          console.warn("Invalid QR data for meal_history id:", mh.id);
        }

        items.forEach(item => {
          const name = item.name;
          if (!mealStats[name]) {
            mealStats[name] = { ordered: 0, served: 0, remaining: 0 };
          }
          mealStats[name].ordered += 1;
          mealStats[name].remaining += isValid;
          mealStats[name].served += 1 - isValid;
        });
      });

      // Calculate totals
      const total_orders = Object.values(mealStats).reduce((sum, i) => sum + i.ordered, 0);
      const served = Object.values(mealStats).reduce((sum, i) => sum + i.served, 0);
      const remaining = Object.values(mealStats).reduce((sum, i) => sum + i.remaining, 0);

      return { total_orders, served, remaining, items: mealStats };
    };

    // --- Daily stats ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const dailyMeals = await MealHistory.findAll({
      where: { meal_date: { [Op.between]: [today, tomorrow] } }
    });

    const dailyStats = { breakfast: {}, lunch: {}, dinner: {} };
    ['breakfast', 'lunch', 'dinner'].forEach(type => {
      const filtered = dailyMeals.filter(m => m.meal_type === type);
      dailyStats[type] = aggregateItems(filtered);
    });

    // --- Weekly stats (last 7 days including today) ---
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);

    const weeklyMeals = await MealHistory.findAll({
      where: { meal_date: { [Op.between]: [weekStart, today] } }
    });

    const weeklyStats = { breakfast: {}, lunch: {}, dinner: {} };
    ['breakfast', 'lunch', 'dinner'].forEach(type => {
      const filtered = weeklyMeals.filter(m => m.meal_type === type);
      weeklyStats[type] = aggregateItems(filtered);
    });

    res.status(200).json({ dailyStats, weeklyStats });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};



// --- Add Menu Item with Image Upload ---
exports.addMenuItem = async (req, res) => {
  try {
    const { MenuItem } = getModels(req);
    const { name, estimated_prep_time, monthly_limit, extra_price, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Image file is required." });
    }

    // Upload to Azure
    const blobName = `${Date.now()}_${req.file.originalname}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype },
    });

    const imageUrl = blockBlobClient.url;

    // Save to DB
    const newItem = await MenuItem.create({
      name,
      estimated_prep_time,
      monthly_limit,
      extra_price,
      description,
      image_url: imageUrl,
    });

    res.status(201).json({
      message: "Thali added successfully!",
      item: newItem,
    });
  } catch (error) {
    console.error("Azure Upload Error:", error);
    res.status(500).json({ message: "Something went wrong.", error: error.message });
  }
};

// --- Student Wallet Management ---
exports.rechargeStudentWallet = async (req, res) => {
  try {
    const { User, Transaction } = getModels(req); // using User instead of Guest
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      s
      return res.status(400).json({ message: 'User ID and amount are required.' });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Update balance
    user.wallet_balance = parseFloat(user.wallet_balance || 0) + parseFloat(amount);
    await user.save();

    // (Optional but recommended) log in transactions table


    res.status(200).json({
      message: 'Wallet recharged successfully!',
      userId: user.id,
      new_balance: user.wallet_balance
    });
  } catch (error) {
    console.error("Recharge error:", error);
    res.status(500).json({ message: 'Something went very wrong', error: error.message });
  }
};


// --- QR Code Scanning ---
exports.scanMealQR = async (req, res) => {
  try {
    const { MealHistory } = getModels(req);
    const { qr_data } = req.body;

    if (!qr_data)
      return res.status(400).json({ message: "QR data is required." });

    let mealDetails;
    try {
      const parsedData = JSON.parse(qr_data);

      // Support both formats: nested qr_code_payload or top-level
      mealDetails = parsedData.qr_code_payload ? parsedData.qr_code_payload : parsedData;
    } catch {
      return res.status(400).json({ message: "Invalid QR code format." });
    }

    const { userId, meal_date, meal_type } = mealDetails;

    if (!meal_date || !meal_type || !userId) {
      return res.status(400).json({ message: "QR code missing required fields." });
    }

    // Validate meal_date
    const mealDateObj = new Date(meal_date);
    if (isNaN(mealDateObj)) {
      return res.status(400).json({ message: "Invalid meal_date in QR code." });
    }

    // Check if QR exists and is valid
    const existingEntry = await MealHistory.findOne({
      where: {
        meal_date,
        meal_type,
        is_valid: true,
        userId
      }
    });

    if (!existingEntry) {
      return res.status(400).json({ message: "This QR code is invalid or has already been used." });
    }

    // Mark QR as used
    existingEntry.is_valid = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // sets time to 00:00:00
    existingEntry.scanned_at = today;
    await existingEntry.save();

    return res.status(200).json({
      message: "Meal verified successfully!",
      meal: existingEntry
    });

  } catch (error) {
    console.error("QR Scan Error:", error);
    return res.status(500).json({ message: "Something went wrong.", error: error.message });
  }
};



exports.updateWalletBalance = async (req, res) => {
  try {
    const { User } = getModels(req);
    const { userId, wallet_balance } = req.body;

    if (!userId || wallet_balance === undefined) {
      return res.status(400).json({ message: "Please provide userId and wallet_balance." });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.wallet_balance = parseFloat(wallet_balance);
    await user.save();

    return res.status(200).json({
      message: "Wallet balance updated successfully.",
      userId: user.id,
      wallet_balance: user.wallet_balance
    });
  } catch (error) {
    console.error("updateWalletBalance error:", error);
    return res.status(500).json({ message: "Something went wrong.", error: error.message });
  }
};

// --- User Management ---
exports.getAllUsers = async (req, res) => {
  try {
    const { User, Guest } = getModels(req);

    const students = await User.findAll({
      where: { role: 'student' },
      attributes: ['id', 'name', 'email', 'room_no', 'role']
    });

    const guests = await Guest.findAll({
      attributes: ['id', 'name', 'mobile_number', 'wallet_balance', 'role']
    });

    const admins = await User.findAll({
      where: { role: ['admin', 'super_admin'] }, // Sequelize auto converts to IN()
      attributes: ['id', 'name', 'email', 'room_no', 'role']
    });

    res.status(200).json({ students, guests, admins });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { User } = getModels(req);
    const { userId } = req.params;

    const user = await User.findByPk(userId, { attributes: { exclude: ['password'] } });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { User } = getModels(req);
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    await user.destroy();
    res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(409).json({
        message: 'Cannot delete user. They have associated records (e.g., meal history). Please deactivate instead.'
      });
    }
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};



// --- Get All Menu Items ---
exports.getMenuItems = async (req, res) => {
  try {
    const { MenuItem } = getModels(req);

    const items = await MenuItem.findAll({
      attributes: [
        'id',
        'name',
        'description',
        'image_url',
        'estimated_prep_time',
        'monthly_limit',
        'extra_price'
      ],
      order: [['name', 'ASC']] // Optional: sort alphabetically
    });

    res.status(200).json({ menu_items: items });
  } catch (error) {
    res.status(500).json({
      message: 'Something went wrong while fetching menu items.',
      error: error.message
    });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const { MenuItem } = getModels(req);
    const { id } = req.params;
    const { name, description, estimated_prep_time, monthly_limit, extra_price } = req.body;

    const item = await MenuItem.findByPk(id);
    if (!item) {
      return res.status(404).json({ message: 'Menu item not found.' });
    }

    // Handle image upload if provided
    let imageUrl = item.image_url;
    if (req.file) {
      const blobName = `${Date.now()}_${req.file.originalname}`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      await blockBlobClient.uploadData(req.file.buffer, {
        blobHTTPHeaders: { blobContentType: req.file.mimetype },
      });

      imageUrl = blockBlobClient.url;
    }

    await item.update({
      name,
      description,
      estimated_prep_time,
      monthly_limit,
      extra_price,
      image_url: imageUrl
    });

    res.status(200).json({ message: 'Menu item updated successfully!', item });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- Delete a menu item ---
exports.deleteMenuItem = async (req, res) => {
  try {
    const { MenuItem } = getModels(req);
    const { id } = req.params;

    const item = await MenuItem.findByPk(id);
    if (!item) {
      return res.status(404).json({ message: 'Menu item not found.' });
    }

    await item.destroy();

    res.status(200).json({ message: 'Menu item deleted successfully!' });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};