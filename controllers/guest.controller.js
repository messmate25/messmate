// File: controllers/guest.controller.js

const { Op } = require('sequelize');
const qrcode = require('qrcode');

/**
 * Helper to get initialized models from request
 */
const getModels = (req) => req.app.locals.models;

// --- Get Full Weekly Menu (for Guests) ---
exports.getWeeklyMenu = async (req, res) => {
  try {
    const { WeeklyMenu, MenuItem } = getModels(req);
    const { week_start_date } = req.query;

    if (!week_start_date) {
      return res.status(400).json({ message: 'Please provide a week_start_date.' });
    }

    // Guests can see all Thalis offered during the week
    const menu = await WeeklyMenu.findAll({
      where: { week_start_date },
      include: [{
        model: MenuItem,
        attributes: ['id', 'name', 'estimated_prep_time', 'extra_price']
      }],
    });

    if (!menu || menu.length === 0) {
      return res.status(404).json({ message: `No menu found for the week starting ${week_start_date}.` });
    }

    // Return a simple list of unique Thalis for the week
    const uniqueThalis = [];
    const seenIds = new Set();
    for (const item of menu) {
      if (!seenIds.has(item.MenuItem.id)) {
        uniqueThalis.push(item.MenuItem);
        seenIds.add(item.MenuItem.id);
      }
    }

    res.status(200).json(uniqueThalis);

  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

// --- Place an order for a meal ---
exports.placeOrder = async (req, res) => {
  try {
    const { Guest, MenuItem, MealHistory } = getModels(req);
    const guestId = req.user.id;
    const { menuItemId, meal_date, meal_type } = req.body;

    if (!menuItemId || !meal_date || !meal_type) {
      return res.status(400).json({ message: 'A Thali selection (menuItemId), meal_date, and meal_type are required.' });
    }

    const guest = await Guest.findByPk(guestId);
    if (!guest) {
      return res.status(404).json({ message: 'Guest profile not found.' });
    }

    const menuItem = await MenuItem.findByPk(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: 'Selected Thali not found.' });
    }



    const qrPayload = {
      guestId: guest.id,
      name: guest.name,
      meal_date,
      meal_type,
      items: [{ id: menuItem.id, name: menuItem.name }] // Guest order is a single Thali
    };

    await MealHistory.create({
      userId: guestId,
      meal_date,
      meal_type,
      menu_item_id: menuItemId,
      is_valid: false,
      qr_code_data: JSON.stringify(qrPayload),
      scanned_at: new Date()
    });

    const qrCodeDataURL = await qrcode.toDataURL(JSON.stringify(qrPayload));

    res.status(200).json({
      message: 'Order placed successfully!',
      qr_code_url: qrCodeDataURL,
    });

  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};
