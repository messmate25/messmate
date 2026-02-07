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

exports.getWeeklyMenu = async (req, res) => {
  try {
    const { WeeklyMenu, MenuItem, WeeklySelection } = getModels(req);
    const { week_start_date } = req.query;
    const userId = req.user?.id; // Get user ID from auth middleware

    if (!week_start_date) {
      return res.status(400).json({ message: 'Please provide a week_start_date.' });
    }

    if (!userId) {
      return res.status(401).json({ message: 'User authentication required.' });
    }

    const weekStart = new Date(week_start_date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // ✅ Get user's existing selections for this week WITH meal_date and meal_type
    const userSelections = await WeeklySelection.findAll({
      where: {
        userId,
        meal_date: {
          [Op.between]: [weekStart, weekEnd]
        }
      },
      attributes: ['menuItemId', 'meal_date', 'meal_type']
    });

    // ✅ Create a map to check if user already selected a meal for specific day and meal type
    const userSelectedMealSlots = new Map();
    const userSelectionCounts = {};

    userSelections.forEach(selection => {
      const menuItemId = selection.menuItemId;
      const mealDate = selection.meal_date;
      const mealType = selection.meal_type;

      // For checking if slot is already taken
      const slotKey = `${mealDate}-${mealType}`;
      userSelectedMealSlots.set(slotKey, menuItemId);

      // For counting weekly selections per menu item
      userSelectionCounts[menuItemId] = (userSelectionCounts[menuItemId] || 0) + 1;
    });

    // ✅ Get the weekly menu
    const menu = await WeeklyMenu.findAll({
      where: { week_start_date },
      include: [{
        model: MenuItem,
        attributes: ['id', 'name', 'description', 'image_url', 'extra_price', 'weekly_limit', 'monthly_limit']
      }],
      order: [['day_of_week'], ['meal_type']]
    });

    if (!menu || menu.length === 0) {
      return res.status(404).json({ message: `No menu found for the week starting ${week_start_date}.` });
    }

    // ✅ Get current date (without time for proper comparison)
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // ✅ Calculate the date for each day of the week
    const dayDateMap = {};
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Map each day_of_week to its actual date
    daysOfWeek.forEach((day, index) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + index);
      dayDateMap[day] = dayDate;
    });

    const groupedMenu = {};
    for (const item of menu) {
      const day = item.day_of_week;
      const meal = item.meal_type;

      // ✅ Check if this day's date is in the past
      const dayDate = dayDateMap[day.toLowerCase()];
      if (dayDate && dayDate < currentDate) {
        continue; // Skip past days
      }

      if (!groupedMenu[day]) groupedMenu[day] = {};
      if (!groupedMenu[day][meal]) groupedMenu[day][meal] = [];

      // ✅ Check if user already selected a meal for this specific day and meal type
      const slotKey = `${dayDate.toISOString().split('T')[0]}-${meal}`;

      if (userSelectedMealSlots.has(slotKey)) {
        // User already selected a meal for this slot, send empty object
        groupedMenu[day][meal].push({});
        continue;
      }

      // ✅ Get menu item
      const menuItem = item.MenuItem;

      // ✅ Calculate remaining weekly limit for this user
      const menuItemId = menuItem.id;
      const baseWeeklyLimit = menuItem.weekly_limit;
      const alreadySelectedCount = userSelectionCounts[menuItemId] || 0;
      const remainingLimit = Math.max(0, baseWeeklyLimit - alreadySelectedCount);

      // ✅ Create menu item object with dynamic weekly_limit
      const dynamicMenuItem = {
        id: menuItem.id,
        name: menuItem.name,
        description: menuItem.description,
        image_url: menuItem.image_url,
        extra_price: menuItem.extra_price,
        weekly_limit: remainingLimit, // Send remaining limit instead of base limit
        monthly_limit: menuItem.monthly_limit
      };

      groupedMenu[day][meal].push(dynamicMenuItem);
    }

    // ✅ If all days are filtered out (all in past), return appropriate message
    if (Object.keys(groupedMenu).length === 0) {
      return res.status(404).json({
        message: `No upcoming days found in the menu for the week starting ${week_start_date}.`
      });
    }

    // ✅ Return the same structure as before, just with updated weekly_limit values
    res.status(200).json(groupedMenu);

  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- Submit Weekly Menu Selection ---
exports.submitWeeklySelection = async (req, res) => {
  try {
    const { WeeklySelection, MealHistory, MenuItem, User, Transaction } = getModels(req);
    const userId = req.user.id;
    const { selections, week_start_date } = req.body;

    if (!selections || !week_start_date) {
      return res.status(400).json({ message: 'Please provide selections and the week start date.' });
    }

    const startDate = new Date(week_start_date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    // ✅ Get existing selections for this week
    const existingSelections = await WeeklySelection.findAll({
      where: {
        userId,
        meal_date: { [Op.between]: [startDate, endDate] }
      },
      include: [{ model: MenuItem }]
    });

    // ✅ Create a map of existing selections for duplicate checking
    const existingSelectionMap = new Map();
    existingSelections.forEach(selection => {
      const key = `${selection.meal_date}-${selection.meal_type}-${selection.menuItemId}`;
      existingSelectionMap.set(key, selection);
    });

    // ✅ Validation: Check for duplicates in new selections
    const newSelectionsMap = new Map();
    const duplicates = [];

    for (const selection of selections) {
      const key = `${selection.meal_date}-${selection.meal_type}-${selection.menuItemId}`;

      // Check if this exact selection already exists in DB
      if (existingSelectionMap.has(key)) {
        duplicates.push(`Meal ${selection.menuItemId} for ${selection.meal_date} (${selection.meal_type})`);
        continue;
      }

      // Check for duplicates within the new submission
      if (newSelectionsMap.has(key)) {
        duplicates.push(`Meal ${selection.menuItemId} for ${selection.meal_date} (${selection.meal_type})`);
        continue;
      }

      newSelectionsMap.set(key, selection);
    }

    // ✅ Return error if duplicates found
    if (duplicates.length > 0) {
      return res.status(400).json({
        message: 'Duplicate selections found:',
        duplicates
      });
    }

    // ✅ Prepare new selections to add (no updates or deletions)
    const newSelectionsToAdd = Array.from(newSelectionsMap.values()).map(selection => ({
      ...selection,
      userId,
      is_default: false
    }));

    // ✅ Add new selections to database
    if (newSelectionsToAdd.length > 0) {
      await WeeklySelection.bulkCreate(newSelectionsToAdd);
    }

    // ✅ Prepare the response
    const response = {
      message: 'Your weekly menu has been updated successfully!',
      added: newSelectionsToAdd.length,
      existing: existingSelections.length,
      duplicates_rejected: duplicates.length
    };

    // ✅ Send response immediately
    res.status(201).json(response);

    // ✅ Generate QR codes in background for NEW selections only
    if (newSelectionsToAdd.length > 0) {
      generateQRsInBackground(newSelectionsToAdd, userId, req);
    }

  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// ✅ Helper function to generate QR codes in the background
async function generateQRsInBackground(selections, userId, req) {
  try {
    const { WeeklySelection, MenuItem, MealHistory } = getModels(req);

    for (const selection of selections) {
      const { meal_date, meal_type } = selection;

      try {
        // Check if QR already exists for this user, meal_date, and meal_type
        const existingQR = await MealHistory.findOne({
          where: { userId, meal_date, meal_type }
        });

        if (existingQR) {
          console.log(`QR already exists for ${meal_type} on ${meal_date}. Skipping.`);
          continue;
        }

        // Find the user's weekly selection for that meal & date
        const weeklySelection = await WeeklySelection.findOne({
          where: { userId, meal_date, meal_type },
          include: [{ model: MenuItem, attributes: ["id", "name", "description", "image_url"] }],
        });

        if (!weeklySelection) {
          console.log(`No selection found for ${meal_type} on ${meal_date}. Skipping.`);
          continue;
        }

        // Prepare QR payload
        const qrPayload = {
          userId,
          userName: req.user.name,
          meal_date,
          meal_type,
          items: [
            {
              id: weeklySelection.MenuItem.id,
              name: weeklySelection.MenuItem.name,
              description: weeklySelection.MenuItem.description,
              image_url: weeklySelection.MenuItem.image_url,
            },
          ],
        };

        // Save in meal_history table
        await MealHistory.create({
          userId,
          meal_date,
          meal_type,
          menu_item_id: weeklySelection.MenuItem.id,
          qr_code_data: JSON.stringify(qrPayload),
          is_valid: true,
        });

        console.log(`QR generated successfully for ${meal_type} on ${meal_date}`);

      } catch (qrError) {
        console.error(`Error generating QR for ${meal_type} on ${meal_date}:`, qrError);
        // Don't throw here - continue with other selections
      }
    }
  } catch (error) {
    console.error('Error in background QR generation:', error);
    // Don't throw - this is background processing
  }
}

// --- Generate QR Code for a specific meal --- (unchanged)
exports.generateMealQR = async (req, res) => {
  try {
    const { WeeklySelection, MenuItem, MealHistory } = getModels(req);
    const userId = req.user.id;
    const { meal_date, meal_type } = req.query;

    if (!meal_date || !meal_type) {
      return res.status(400).json({ message: "Please provide both meal_date and meal_type." });
    }

    // ✅ Check if QR already exists for this user, meal_date, and meal_type
    const existingQR = await MealHistory.findOne({
      where: { userId, meal_date, meal_type }
    });

    if (existingQR) {
      if (existingQR.is_valid) {
        // ✅ Return the already existing valid QR without updating DB
        return res.status(200).json({
          message: `QR already generated for ${meal_type} on ${meal_date}.`,
          qr_code_payload: JSON.parse(existingQR.qr_code_data),
          meal_history_id: existingQR.id
        });
      } else {
        // ❌ If QR exists but is invalid, return QR expired message
        return res.status(410).json({
          message: `QR for ${meal_type} on ${meal_date} is expired.`,
          meal_history_id: existingQR.id
        });
      }
    }

    // ✅ Find the user's weekly selection for that meal & date
    const selection = await WeeklySelection.findOne({
      where: { userId, meal_date, meal_type },
      include: [{ model: MenuItem, attributes: ["id", "name", "description", "image_url"] }],
    });

    if (!selection) {
      return res.status(404).json({
        message: `You have not made a selection for ${meal_type} on ${meal_date}.`,
      });
    }

    // ✅ Prepare QR payload
    const qrPayload = {
      userId,
      userName: req.user.name,
      meal_date,
      meal_type,
      items: [
        {
          id: selection.MenuItem.id,
          name: selection.MenuItem.name,
          description: selection.MenuItem.description,
          image_url: selection.MenuItem.image_url,
        },
      ],
    };

    // ✅ Save in meal_history table
    const mealHistory = await MealHistory.create({
      userId,
      meal_date,
      meal_type,
      menu_item_id: selection.MenuItem.id,
      qr_code_data: JSON.stringify(qrPayload),
      is_valid: true,
    });

    // ✅ Return QR payload + database reference
    return res.status(200).json({
      message: "QR generated successfully.",
      qr_code_payload: qrPayload,
      meal_history_id: mealHistory.id,
    });

  } catch (error) {
    console.error("generateMealQR error:", error);
    res.status(500).json({ message: "Something went wrong.", error: error.message });
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

      if (currentSimulatedUsage >= menuItem.monthly_limit || currentSimulatedUsage >= menuItem.weekly_limit) {
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

exports.getWeeklySelections = async (req, res) => {
  try {
    // Await models
    const { WeeklySelection, MenuItem } = getModels(req);

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