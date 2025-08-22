// File: services/cron.service.js

const cron = require('node-cron');
const { Op } = require('sequelize');
const User = require('../models/user.model');
const WeeklySelection = require('../models/weeklySelection.model');

const startDefaultMenuJob = () => {
  // Schedule the job to run every Saturday at 11:59 PM
  // The format is: 'minute hour day-of-month month day-of-week'
  cron.schedule('59 23 * * 6', async () => {
    console.log('Running job to assign default menu to students...');

    try {
      // 1. Define the upcoming week (Monday to Sunday)
      const today = new Date();
      const nextMonday = new Date(today);
      // Logic to find the date of the *next* Monday
      nextMonday.setDate(today.getDate() + (1 + 7 - today.getDay()) % 7);
      if (today.getDay() === 1 && today.getHours() < 23) { // If it's Monday before the job runs, get next week's
          nextMonday.setDate(today.getDate() + 7);
      } else if (today.getDay() === 0 || today.getDay() > 1) { // If it's Sunday or after Monday
          // Standard logic works
      }

      const nextSunday = new Date(nextMonday);
      nextSunday.setDate(nextMonday.getDate() + 6);

      // 2. Find all students
      const allStudents = await User.findAll({
        where: { role: 'student' },
        attributes: ['id']
      });
      const allStudentIds = allStudents.map(s => s.id);

      // 3. Find students who have already made a selection for the upcoming week
      const studentsWithSelection = await WeeklySelection.findAll({
        where: {
          meal_date: { [Op.between]: [nextMonday, nextSunday] }
        },
        attributes: ['userId'],
        group: ['userId']
      });
      const studentsWithSelectionIds = studentsWithSelection.map(s => s.userId);

      // 4. Determine which students have NOT made a selection
      const studentsWithoutSelectionIds = allStudentIds.filter(id => !studentsWithSelectionIds.includes(id));

      if (studentsWithoutSelectionIds.length === 0) {
        console.log('All students have made their selections for the upcoming week.');
        return;
      }

      console.log(`Assigning default menu to ${studentsWithoutSelectionIds.length} students.`);

      // 5. Define a default menu (using Thali IDs)
      // In a real app, this would be managed by an admin in the UI.
      // For now, we'll assume the default Thali is menuItemId 1.
      const defaultThaliId = 1;

      // 6. Create the default selection entries
      const defaultSelections = [];
      for (const userId of studentsWithoutSelectionIds) {
        for (let i = 0; i < 7; i++) {
          const mealDate = new Date(nextMonday);
          mealDate.setDate(nextMonday.getDate() + i);

          // Assign default Thali for lunch and dinner
          defaultSelections.push({
            userId,
            meal_date: mealDate.toISOString().split('T')[0],
            meal_type: 'lunch',
            menuItemId: defaultThaliId,
            is_default: true
          });
          defaultSelections.push({
            userId,
            meal_date: mealDate.toISOString().split('T')[0],
            meal_type: 'dinner',
            menuItemId: defaultThaliId,
            is_default: true
          });
        }
      }

      if (defaultSelections.length > 0) {
        await WeeklySelection.bulkCreate(defaultSelections);
        console.log('Default menu assignment completed successfully.');
      } else {
        console.log('No default selections to create.');
      }

    } catch (error) {
      console.error('Error assigning default menu:', error);
    }
  });
};

module.exports = { startDefaultMenuJob };
