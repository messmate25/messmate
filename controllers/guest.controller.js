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
// controllers/order.controller.js
exports.placeOrder = async (req, res) => {
  try {
    const { Guest, MenuItem, GuestOrder, GuestOrderItem } = getModels(req);
    const guestId = req.user.id;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one menu item is required." });
    }

    const guest = await Guest.findByPk(guestId);
    if (!guest) {
      return res.status(404).json({ message: "Guest profile not found." });
    }

    // Validate Menu Items
    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await MenuItem.findAll({ where: { id: menuItemIds } });

    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({ message: "One or more selected menu items are invalid." });
    }

    // Calculate total amount
    let totalAmount = 0;
    const priceMap = {};
    menuItems.forEach(item => {
      priceMap[item.id] = parseFloat(item.extra_price);
    });
    
    items.forEach(item => {
      const price = priceMap[item.menuItemId] || 0;
      totalAmount += price * (item.quantity || 1);
    });

    // Get Estimated Prep Time Text
    const estimatedPrepText = menuItems.map((m) => m.estimated_prep_time).join(", ");

    // Create Guest Order with pending_payment status
    const order = await GuestOrder.create({
      guestId,
      order_date: new Date(),
      status: "pending_payment",
      estimated_preparation_time: estimatedPrepText,
      amount: totalAmount
    });

    // Create Order Items
    const orderItems = items.map((i) => ({
      orderId: order.id,
      menu_item_id: i.menuItemId,
      quantity: i.quantity || 1,
    }));

    await GuestOrderItem.bulkCreate(orderItems);

    res.status(201).json({
      message: "Order created successfully. Proceed to payment.",
      orderId: order.id,
      amount: totalAmount,
      items: orderItems,
      nextStep: "payment"
    });
  } catch (error) {
    console.error("Error creating guest order:", error);
    res.status(500).json({ message: "Something went wrong.", error: error.message });
  }
};



// controllers/order.controller.js

// controllers/order.controller.js

exports.getGuestOrdersById = async (req, res) => {
  try {
    const { GuestOrder, GuestOrderItem, MenuItem, Guest } = getModels(req);
    const guestId = req.params.guestId;

    // Validate guestId
    if (!guestId) {
      return res.status(400).json({ message: "Guest ID is required." });
    }

    const guest = await Guest.findByPk(guestId);
    if (!guest) {
      return res.status(404).json({ message: "Guest not found." });
    }

    const orders = await GuestOrder.findAll({
      where: { guestId },
      include: [
        {
          model: GuestOrderItem,
          as: "items",
          include: [
            {
              model: MenuItem,
              as: "menuItem",
              attributes: ["id", "name", "description", "estimated_prep_time", "extra_price"]
            }
          ]
        }
      ],
      order: [["order_date", "DESC"]] // latest orders first
    });

    res.status(200).json({
      message: `Orders for guest ${guest.name} fetched successfully.`,
      guest: {
        id: guest.id,
        name: guest.name
      },
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error("Error fetching guest orders:", error);
    res.status(500).json({ message: "Something went wrong.", error: error.message });
  }
};
