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



// Fetch weekly menus
exports.getWeeklyMenus = async (req, res) => {
  try {
    const { week_number, start_date } = req.query; // optional query params
    const { WeeklyMenu } = getModels(req);

    if (week_number && !start_date) {
      return res.status(400).json({ message: 'Please provide start_date when using week_number.' });
    }

    let menus;

    if (week_number && start_date) {
      // Calculate the date for the requested week
      const startDateObj = new Date(start_date);
      const targetDate = new Date(startDateObj);
      targetDate.setDate(startDateObj.getDate() + (7 * (parseInt(week_number) - 1)));

      const targetWeek = targetDate.toISOString().split('T')[0]; // format YYYY-MM-DD

      menus = await WeeklyMenu.findAll({
        where: { week_start_date: targetWeek },
        order: [['day_of_week', 'ASC'], ['meal_type', 'ASC']]
      });
    } else {
      // Fetch all weeks if no week_number
      menus = await WeeklyMenu.findAll({
        order: [['week_start_date', 'ASC'], ['day_of_week', 'ASC'], ['meal_type', 'ASC']]
      });
    }

    res.status(200).json({ menus });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- Dashboard ---
exports.getDashboardStats = async (req, res) => {
  try {
    const { MealHistory } = getModels(req);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const mealCounts = await MealHistory.findAll({
      where: { scanned_at: { [Op.between]: [today, tomorrow] } },
      attributes: ['meal_type', [fn('COUNT', col('id')), 'count']],
      group: ['meal_type']
    });

    const guestRevenue = await MealHistory.sum('total_cost', {
      where: { guestId: { [Op.ne]: null }, scanned_at: { [Op.between]: [today, tomorrow] } }
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

// --- Guest Wallet Management ---
exports.rechargeGuestWallet = async (req, res) => {
  try {
    const { Guest } = getModels(req);
    const { guestId, amount } = req.body;

    if (!guestId || !amount) {
      return res.status(400).json({ message: 'Guest ID and amount are required.' });
    }

    const guest = await Guest.findByPk(guestId);
    if (!guest) return res.status(404).json({ message: 'Guest not found.' });

    guest.wallet_balance = parseFloat(guest.wallet_balance) + parseFloat(amount);
    await guest.save();

    res.status(200).json({ message: 'Wallet recharged successfully!', guestId: guest.id, new_balance: guest.wallet_balance });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- QR Code Scanning ---
exports.scanMealQR = async (req, res) => {
  try {
    const { MealHistory } = getModels(req);
    const { qr_data } = req.body;
    if (!qr_data) return res.status(400).json({ message: 'QR data is required.' });

    let mealDetails;
    try {
      mealDetails = JSON.parse(qr_data);
    } catch {
      return res.status(400).json({ message: 'Invalid QR code format.' });
    }

    const { userId, guestId, meal_date, meal_type } = mealDetails;
    const whereClause = { meal_date, meal_type };

    if (userId) whereClause.userId = userId;
    else if (guestId) whereClause.guestId = guestId;
    else return res.status(400).json({ message: 'Invalid QR code: No user or guest ID found.' });

    const existingEntry = await MealHistory.findOne({ where: whereClause });
    if (existingEntry) return res.status(409).json({ message: 'This meal has already been redeemed today.' });

    await MealHistory.create({ userId, guestId, meal_date, meal_type, qr_code_data: qr_data });

    res.status(200).json({ message: 'Meal verified successfully!', mealDetails });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
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
      attributes: ['id', 'name', 'mobile_number', 'wallet_balance' , 'role']
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
