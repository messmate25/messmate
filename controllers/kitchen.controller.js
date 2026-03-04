const { Op } = require('sequelize');

const getModels = (req) => req.app.locals.models;


// Get all available kitchens
exports.getAvailableKitchens = async (req, res) => {
    try {
        const { Kitchen } = getModels(req);

        const kitchens = await Kitchen.findAll({
            where: { is_active: true },
            attributes: ['id', 'name', 'description', 'location'],
            order: [['name', 'ASC']]
        });

        res.status(200).json({ kitchens });
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong.', error: error.message });
    }
};

exports.selectDefaultKitchen = async (req, res) => {
    try {
        const { User } = getModels(req);
        const { kitchenId } = req.body;
        const userId = req.user.id;

        if (!kitchenId) {
            return res.status(400).json({ message: 'Please provide a kitchen ID.' });
        }

        // Check if kitchen exists
        const { Kitchen } = getModels(req);
        const kitchen = await Kitchen.findByPk(kitchenId);

        if (!kitchen) {
            return res.status(404).json({ message: 'Kitchen not found.' });
        }

        // Update user's default kitchen
        await User.update(
            { kitchenId },
            { where: { id: userId } }
        );

        res.status(200).json({
            message: 'Default kitchen selected successfully.',
            kitchen: {
                id: kitchen.id,
                name: kitchen.name
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong.', error: error.message });
    }
};

// Get user's current kitchen
exports.getMyKitchen = async (req, res) => {
    try {
        const { User, Kitchen } = getModels(req);
        const userId = req.user.id;

        const user = await User.findByPk(userId, {
            include: [{
                model: Kitchen,
                attributes: ['id', 'name', 'description', 'location']
            }]
        });

        if (!user || !user.Kitchen) {
            return res.status(404).json({ message: 'No default kitchen selected.' });
        }

        res.status(200).json({ kitchen: user.Kitchen });
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong.', error: error.message });
    }
};

// --- Admin Functions ---

// Create new kitchen
exports.createKitchen = async (req, res) => {
    try {
        const { Kitchen } = getModels(req);
        const { name, description, location } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Kitchen name is required.' });
        }

        const existingKitchen = await Kitchen.findOne({ where: { name } });
        if (existingKitchen) {
            return res.status(409).json({ message: 'Kitchen with this name already exists.' });
        }

        const kitchen = await Kitchen.create({
            name,
            description,
            location,
            is_active: true
        });

        res.status(201).json({
            message: 'Kitchen created successfully.',
            kitchen
        });
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong.', error: error.message });
    }
};

// Update kitchen
exports.updateKitchen = async (req, res) => {
    try {
        const { Kitchen } = getModels(req);
        const { kitchenId } = req.params;
        const { name, description, location, is_active } = req.body;

        const kitchen = await Kitchen.findByPk(kitchenId);
        if (!kitchen) {
            return res.status(404).json({ message: 'Kitchen not found.' });
        }

        await kitchen.update({
            name: name || kitchen.name,
            description: description !== undefined ? description : kitchen.description,
            location: location !== undefined ? location : kitchen.location,
            is_active: is_active !== undefined ? is_active : kitchen.is_active
        });

        res.status(200).json({
            message: 'Kitchen updated successfully.',
            kitchen
        });
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong.', error: error.message });
    }
};

// Delete kitchen
exports.deleteKitchen = async (req, res) => {
    try {
        const { Kitchen, MenuItem } = getModels(req);
        const { kitchenId } = req.params;

        // Check if kitchen has any menu items
        const itemCount = await MenuItem.count({ where: { kitchenId } });

        if (itemCount > 0) {
            return res.status(409).json({
                message: 'Cannot delete kitchen with existing menu items. Please reassign or delete items first.'
            });
        }

        const kitchen = await Kitchen.findByPk(kitchenId);
        if (!kitchen) {
            return res.status(404).json({ message: 'Kitchen not found.' });
        }

        await kitchen.destroy();

        res.status(200).json({ message: 'Kitchen deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong.', error: error.message });
    }
};

// Get all kitchens (admin)
exports.getAllKitchens = async (req, res) => {
    try {
        const { Kitchen, MenuItem } = getModels(req);

        const kitchens = await Kitchen.findAll({
            include: [{
                model: MenuItem,
                attributes: ['id'],
                required: false
            }],
            order: [['name', 'ASC']]
        });

        // Add item count to each kitchen
        const kitchensWithStats = kitchens.map(kitchen => ({
            ...kitchen.toJSON(),
            item_count: kitchen.MenuItems ? kitchen.MenuItems.length : 0
        }));

        res.status(200).json({ kitchens: kitchensWithStats });
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong.', error: error.message });
    }
};

// Get kitchen stats
exports.getKitchenStats = async (req, res) => {
    try {
        const { kitchenId } = req.params;
        const { MenuItem, WeeklyMenu, User } = getModels(req);

        const itemCount = await MenuItem.count({ where: { kitchenId } });

        const userCount = await User.count({ where: { kitchenId } });

        const activeMenuCount = await WeeklyMenu.count({
            include: [{
                model: MenuItem,
                where: { kitchenId },
                required: true
            }]
        });

        res.status(200).json({
            stats: {
                total_items: itemCount,
                total_users: userCount,
                active_menu_entries: activeMenuCount
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong.', error: error.message });
    }
};