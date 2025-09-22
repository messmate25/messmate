// File: controllers/student.controller.js

const { Op } = require('sequelize');
const qrcode = require('qrcode');

/**
 * Helper to get initialized models from request
 */
const getModels = (req) => req.app.locals.models;

// --- Get User Profile ---
exports.getProfile = async (req, res) => {
  try {
    const { User } = getModels(req);
    const userId = req.user.id;

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

// --- Get Weekly Menu (for Students) ---
exports.getWeeklyMenu = async (req, res) => {
  try {
    const { WeeklyMenu, MenuItem } = getModels(req);
    const { week_start_date } = req.query;

    if (!week_start_date) {
      return res.status(400).json({ message: 'Please provide a week_start_date.' });
    }

    const menu = await WeeklyMenu.findAll({
      where: { week_start_date },
      include: [{
        model: MenuItem,
        attributes: ['id', 'name', 'description', 'image_url', 'extra_price']
      }],
      order: [['day_of_week'], ['meal_type']]
    });

    if (!menu || menu.length === 0) {
      return res.status(404).json({ message: `No menu found for the week starting ${week_start_date}.` });
    }

    const groupedMenu = {};
    for (const item of menu) {
      const day = item.day_of_week;
      const meal = item.meal_type;
      if (!groupedMenu[day]) groupedMenu[day] = {};
      if (!groupedMenu[day][meal]) groupedMenu[day][meal] = [];
      groupedMenu[day][meal].push(item.MenuItem);
    }

    res.status(200).json(groupedMenu);

  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- Submit Weekly Menu Selection ---
exports.submitWeeklySelection = async (req, res) => {
  try {
    const { WeeklySelection, MealHistory, MenuItem, User , Transaction } = getModels(req);
    const userId = req.user.id;
    const { selections, week_start_date } = req.body;

    if (!selections || !week_start_date) {
      return res.status(400).json({ message: 'Please provide selections and the week start date.' });
    }

    // ✅ Validation: only one thali per meal
    const selectionsByDayMeal = {};
    for (const s of selections) {
      const key = `${s.meal_date}-${s.meal_type}`;
      if (selectionsByDayMeal[key]) {
        return res.status(400).json({ message: `You can only select one Thali per meal. Error on ${key}.` });
      }
      selectionsByDayMeal[key] = true;
    }

    const startDate = new Date(week_start_date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    await WeeklySelection.destroy({
      where: { userId, meal_date: { [Op.between]: [startDate, endDate] } }
    });

    const newSelections = selections.map(selection => ({
      ...selection,
      userId,
      is_default: false
    }));

    await WeeklySelection.bulkCreate(newSelections);

    // ✅ Check extra charges
    let totalExtraCharge = 0;
    for (const s of selections) {
      const menuItem = await MenuItem.findByPk(s.menuItemId);
      if (menuItem && menuItem.extra_price) {
        totalExtraCharge += parseFloat(menuItem.extra_price);
      }
    }

    if (totalExtraCharge > 0) {
      // ✅ Check user balance
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      if (parseFloat(user.wallet_balance) < totalExtraCharge) {
        return res.status(400).json({ 
          message: 'Insufficient wallet balance. Please recharge your wallet.' 
        });
      }

      // ✅ Deduct from wallet
      user.wallet_balance = parseFloat(user.wallet_balance) - totalExtraCharge;
      await user.save();

      // ✅ Log in MealHistory
      
    }

    res.status(201).json({
      message: 'Your weekly menu has been saved successfully!',
      total_extra_charge: totalExtraCharge
    });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- Generate QR Code for a specific meal ---
exports.generateMealQR = async (req, res) => {
  try {
    const { WeeklySelection, MenuItem } = getModels(req);
    const userId = req.user.id;
    const { meal_date, meal_type } = req.query;

    if (!meal_date || !meal_type) {
      return res.status(400).json({ message: 'Please provide both meal_date and meal_type.' });
    }

    const selection = await WeeklySelection.findOne({
      where: { userId, meal_date, meal_type },
      include: [{ model: MenuItem, attributes: ['id', 'name', 'description', 'image_url'] }]
    });

    if (!selection) {
      return res.status(404).json({ message: `You have not made a selection for ${meal_type} on ${meal_date}.` });
    }

    const qrPayload = {
      userId,
      userName: req.user.name,
      meal_date,
      meal_type,
      items: [{
        id: selection.MenuItem.id,
        name: selection.MenuItem.name,
        description: selection.MenuItem.description,
        image_url: selection.MenuItem.image_url
      }]
    };

    const qrCodeDataURL = await qrcode.toDataURL(JSON.stringify(qrPayload));

    res.status(200).json({ qr_code_url: qrCodeDataURL });

  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- Get Monthly Usage Statistics ---
exports.getUsageStats = async (req, res) => {
  try {
    const { MealHistory } = getModels(req);
    const userId = req.user.id;

    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const history = await MealHistory.findAll({
      where: { userId, meal_date: { [Op.between]: [firstDay, lastDay] } }
    });

    const usageCount = {};
    for (const entry of history) {
      try {
        const mealData = JSON.parse(entry.qr_code_data);
        if (mealData.items && Array.isArray(mealData.items)) {
          for (const item of mealData.items) {
            if (usageCount[item.id]) {
              usageCount[item.id].count++;
            } else {
              usageCount[item.id] = { name: item.name, count: 1 };
            }
          }
        }
      } catch (parseError) {
        console.error(`Could not parse qr_code_data for history ID ${entry.id}:`, parseError);
      }
    }

    return res.status(200).json(usageCount);

  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- Preview Costs for a Weekly Selection ---
exports.previewWeeklySelection = async (req, res) => {
  try {
    const { MealHistory, MenuItem } = getModels(req);
    const userId = req.user.id;
    const { selections } = req.body;

    if (!selections || selections.length === 0) {
      return res.status(400).json({ message: 'Please provide selections to preview.' });
    }

    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const history = await MealHistory.findAll({
      where: { userId, meal_date: { [Op.between]: [firstDay, lastDay] } }
    });

    const usageCount = {};
    history.forEach(entry => {
      try {
        const mealData = JSON.parse(entry.qr_code_data);
        if (mealData.items && Array.isArray(mealData.items)) {
          mealData.items.forEach(item => {
            usageCount[item.id] = (usageCount[item.id] || 0) + 1;
          });
        }
      } catch (e) {
        /* Ignore parse errors in old data */
      }
    });

    const menuItemIds = [...new Set(selections.map(s => s.menuItemId))];
    const menuItems = await MenuItem.findAll({
      where: { id: { [Op.in]: menuItemIds } }
    });

    const menuItemsMap = new Map(menuItems.map(item => [item.id, item]));

    let totalExtraCost = 0;
    const chargedItems = [];
    const simulatedUsage = { ...usageCount };

    for (const selection of selections) {
      const menuItem = menuItemsMap.get(selection.menuItemId);
      if (!menuItem) continue;

      const currentSimulatedUsage = simulatedUsage[selection.menuItemId] || 0;

      if (currentSimulatedUsage >= menuItem.monthly_limit) {
        totalExtraCost += parseFloat(menuItem.extra_price);
        chargedItems.push({
          name: menuItem.name,
          price: menuItem.extra_price,
          date: selection.meal_date
        });
      }

      simulatedUsage[selection.menuItemId] = currentSimulatedUsage + 1;
    }

    res.status(200).json({
      total_extra_cost: totalExtraCost.toFixed(2),
      charged_items: chargedItems
    });

  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// GET /student/weekly-selections

exports.getWeeklySelections = async (req, res) => {
  try {
    // Await models
    const { WeeklySelection, MenuItem } = await getModels(req);

    const userId = req.user.id;

    // Get start of week (Monday) and end of week (Sunday)
    const today = new Date();
    const day = today.getDay(); // 0 = Sunday
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const selections = await WeeklySelection.findAll({
      where: {
        userId,
        meal_date: {
          [Op.between]: [monday, sunday],
        },
      },
      include: [
        {
          model: MenuItem,
          attributes: ["id", "name", "image_url", "extra_price"],
        },
      ],
      order: [
        ["meal_date", "ASC"],
        ["meal_type", "ASC"],
      ],
    });

    return res.json({
      week_start: monday,
      week_end: sunday,
      selections,
    });
  } catch (err) {
    console.error("getWeeklySelections error:", err);
    return res.status(500).json({ error: "Failed to fetch weekly selections", details: err.message });
  }
};
