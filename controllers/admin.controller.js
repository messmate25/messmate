// File: controllers/admin.controller.js
const Jimp = require('jimp');
const QrCode = require('qrcode-reader');
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

// --- Student Wallet Management ---
exports.rechargeStudentWallet = async (req, res) => {
  try {
    const { User, Transaction } = getModels(req); // using User instead of Guest
    const { userId, amount } = req.body;

    if (!userId || !amount) {s
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
    
    if (!qr_data) {
      return res.status(400).json({ message: 'QR data is required.' });
    }

    let mealDetails;
    
    // Check if it's a base64 image data URL
    if (qr_data.startsWith('data:image/png;base64,')) {
      try {
        // Extract base64 data from data URL
        const base64Data = qr_data.replace(/^data:image\/png;base64,/, '');
        
        // Decode QR code from image
        mealDetails = await decodeQRFromBase64(base64Data);
      } catch (decodeError) {
        return res.status(400).json({ 
          message: 'Failed to decode QR code image.', 
          error: decodeError.message 
        });
      }
    } else {
      // Assume it's already JSON string
      try {
        mealDetails = JSON.parse(qr_data);
      } catch (parseError) {
        return res.status(400).json({ 
          message: 'Invalid QR code format.', 
          error: parseError.message 
        });
      }
    }

    // Continue with your existing logic
    const { userId, guestId, meal_date, meal_type } = mealDetails;
    const whereClause = { meal_date, meal_type };

    if (userId) whereClause.userId = userId;
    else if (guestId) whereClause.guestId = guestId;
    else {
      return res.status(400).json({ 
        message: 'Invalid QR code: No user or guest ID found.' 
      });
    }

    const existingEntry = await MealHistory.findOne({ where: whereClause });
    if (existingEntry) {
      return res.status(409).json({ 
        message: 'This meal has already been redeemed today.' 
      });
    }

    await MealHistory.create({ 
      userId, 
      guestId, 
      meal_date, 
      meal_type, 
      qr_code_data: JSON.stringify(mealDetails) 
    });

    res.status(200).json({ 
      message: 'Meal verified successfully!', 
      mealDetails 
    });

  } catch (error) {
    console.error('Scan QR Error:', error);
    res.status(500).json({ 
      message: 'Something went wrong.', 
      error: error.message 
    });
  }
};

// Helper function to decode QR code from base64 image
async function decodeQRFromBase64(base64Data) {
  return new Promise((resolve, reject) => {
    try {
      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Read image with Jimp
      Jimp.read(buffer, (err, image) => {
        if (err) {
          reject(new Error('Failed to read QR image: ' + err.message));
          return;
        }

        // Create QR code reader
        const qr = new QrCode();
        
        qr.callback = function(err, value) {
          if (err) {
            reject(new Error('QR code decoding failed: ' + err.message));
            return;
          }
          
          if (!value || !value.result) {
            reject(new Error('No QR code found in image'));
            return;
          }

          try {
            // Parse the QR code content as JSON
            const parsedData = JSON.parse(value.result);
            resolve(parsedData);
          } catch (parseErr) {
            reject(new Error('QR content is not valid JSON: ' + parseErr.message));
          }
        };
        
        // Decode the QR code
        qr.decode(image.bitmap);
      });
    } catch (error) {
      reject(error);
    }
  });
}

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