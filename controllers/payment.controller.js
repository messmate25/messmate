const razorpay = require('../config/razorpay.config');

const getModels = (req) => req.app.locals.models;

// Create Razorpay Order
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { MenuItem } = getModels(req);
    const { items } = req.body;
    const guestId = req.user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one menu item is required." });
    }

    // Calculate total amount
    const menuItemIds = items.map(i => i.menuItemId);
    const menuItems = await MenuItem.findAll({
      where: { id: menuItemIds }
    });

    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({ message: "One or more selected menu items are invalid." });
    }

    // Create a map for quick price lookup
    const priceMap = {};
    menuItems.forEach(item => {
      priceMap[item.id] = parseFloat(item.extra_price);
    });

    // Calculate total amount in paise (Razorpay expects amount in smallest currency unit)
    let totalAmount = 0;
    items.forEach(item => {
      const price = priceMap[item.menuItemId] || 0;
      totalAmount += price * (item.quantity || 1);
    });

    // Convert to paise (INR * 100)
    const amountInPaise = Math.round(totalAmount * 100);

    // Create Razorpay Order
    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1, // Auto capture payment
      notes: {
        guestId: guestId.toString(),
        items: JSON.stringify(items)
      }
    };

    const razorpayOrder = await razorpay.orders.create(options);
    console.log("Razorpay Order Created:", razorpayOrder); 


    res.status(200).json({
      success: true,
      order: razorpayOrder,
      key: process.env.RAZORPAY_KEY_ID,
      amount: totalAmount,
      currency: "INR",
      name: "Mess Management System",
      description: "Guest Order Payment"
    });

  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to create payment order",
      error: error.message 
    });
  }
};

// Verify Payment and Create Order
exports.verifyPayment = async (req, res) => {
  try {
    const { GuestOrder, GuestOrderItem, MenuItem } = getModels(req);
    const { 
      razorpay_payment_id, 
      razorpay_order_id, 
      razorpay_signature,
      items 
    } = req.body;

    const guestId = req.user.id;

    // Validate required fields
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing payment details" 
      });
    }

    // Verify payment signature
    const crypto = require('crypto');
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ 
        success: false, 
        message: "Payment verification failed" 
      });
    }

    // Calculate total amount and get estimated prep time
    let totalAmount = 0;
    let estimatedPrepText = "";
    
    if (items && items.length > 0) {
      const menuItemIds = items.map(i => i.menuItemId);
      const menuItems = await MenuItem.findAll({
        where: { id: menuItemIds }
      });

      const priceMap = {};
      const prepTimeMap = {};
      menuItems.forEach(item => {
        priceMap[item.id] = parseFloat(item.extra_price);
        prepTimeMap[item.id] = item.estimated_prep_time;
      });

      // Calculate total and prep time
      items.forEach(item => {
        const price = priceMap[item.menuItemId] || 0;
        totalAmount += price * (item.quantity || 1);
        
        const prepTime = prepTimeMap[item.menuItemId];
        if (prepTime && !estimatedPrepText.includes(prepTime)) {
          if (estimatedPrepText) estimatedPrepText += ", ";
          estimatedPrepText += prepTime;
        }
      });
    }

    // Create Guest Order with payment details
    const order = await GuestOrder.create({
      guestId,
      order_date: new Date(),
      status: "confirmed", // Payment successful, move to confirmed
      estimated_preparation_time: estimatedPrepText,
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      amount: totalAmount,
      payment_status: "captured"
    });

    // Create Order Items
    if (items && items.length > 0) {
      const orderItems = items.map(item => ({
        orderId: order.id,
        menu_item_id: item.menuItemId,
        quantity: item.quantity || 1,
      }));
      await GuestOrderItem.bulkCreate(orderItems);
    }


    res.status(201).json({
      success: true,
      message: "Order placed and payment successful!",
      orderId: order.id,
      paymentId: razorpay_payment_id,
      status: order.status,
      estimated_preparation_time: estimatedPrepText,
      amount: totalAmount
    });

  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ 
      success: false,
      message: "Payment verification failed",
      error: error.message 
    });
  }
};

// Webhook for payment status updates (optional but recommended)
exports.paymentWebhook = async (req, res) => {
  try {
    const { GuestOrder } = getModels(req);
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    // Verify webhook signature
    const crypto = require('crypto');
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }
    
    const event = req.body.event;
    const payment = req.body.payload.payment.entity;
    
    // Find and update order based on payment
    const order = await GuestOrder.findOne({
      where: { payment_id: payment.id }
    });
    
    if (order) {
      switch (event) {
        case 'payment.captured':
          await order.update({ 
            payment_status: 'captured',
            status: 'confirmed'
          });
          break;
          
        case 'payment.failed':
          await order.update({ 
            payment_status: 'failed',
            status: 'cancelled'
          });
          break;
          
        case 'payment.refunded':
          await order.update({ 
            payment_status: 'refunded',
            status: 'cancelled'
          });
          break;
      }
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};