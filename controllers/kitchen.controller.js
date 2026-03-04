// Update addMenuItem to include kitchenId
exports.addMenuItem = async (req, res) => {
  try {
    const { MenuItem } = getModels(req);
    const { name, estimated_prep_time, monthly_limit, weekly_limit, extra_price, description, kitchenId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Image file is required." });
    }

    if (!kitchenId) {
      return res.status(400).json({ message: "Kitchen ID is required." });
    }

    // Check if kitchen exists
    const { Kitchen } = getModels(req);
    const kitchen = await Kitchen.findByPk(kitchenId);
    if (!kitchen) {
      return res.status(404).json({ message: "Kitchen not found." });
    }

    // Upload to Azure
    const blobName = `${Date.now()}_${req.file.originalname}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype },
    });

    const imageUrl = blockBlobClient.url;

    // Save to DB with kitchenId
    const newItem = await MenuItem.create({
      name,
      estimated_prep_time,
      monthly_limit,
      weekly_limit,
      extra_price,
      description,
      image_url: imageUrl,
      kitchenId
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

// Add new function to get menu items by kitchen
exports.getMenuItemsByKitchen = async (req, res) => {
  try {
    const { kitchenId } = req.params;
    const { MenuItem } = getModels(req);

    const items = await MenuItem.findAll({
      where: { kitchenId },
      attributes: [
        'id',
        'name',
        'description',
        'image_url',
        'estimated_prep_time',
        'monthly_limit',
        'weekly_limit',
        'extra_price',
        'kitchenId'
      ],
      order: [['name', 'ASC']]
    });

    res.status(200).json({ menu_items: items });
  } catch (error) {
    res.status(500).json({
      message: 'Something went wrong while fetching menu items.',
      error: error.message
    });
  }
};

// Update setWeeklyMenu to validate kitchen
exports.setWeeklyMenu = async (req, res) => {
  try {
    const { week_start_date, menu } = req.body; // menu should include kitchenId in each entry
    const { WeeklyMenu, MenuItem } = getModels(req);

    if (!week_start_date || !menu) {
      return res.status(400).json({ message: 'Week start date and menu are required.' });
    }

    // Validate that all menu items belong to the same kitchen or track per item
    // You might want to store kitchenId in WeeklyMenu as well, or validate per item

    // Clear existing menu for that week
    await WeeklyMenu.destroy({ where: { week_start_date } });

    const menuEntries = menu.map(entry => ({
      week_start_date,
      day_of_week: entry.day_of_week,
      meal_type: entry.meal_type,
      menuItemId: entry.menuItemId
      // Note: kitchenId is derived from menuItemId
    }));

    await WeeklyMenu.bulkCreate(menuEntries);

    res.status(201).json({ message: `Menu for the week of ${week_start_date} has been set.` });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};