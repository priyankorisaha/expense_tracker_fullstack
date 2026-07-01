
const Income = require('../models/IncomeModel');
 
 // Add Income
 exports.addIncome = async (req, res) => {
     try {
        const userId = req.user.id;
         let { title, amount, category, description, date } = req.body;
 
         amount = Number(amount);
 
        if (!title || !category || !date) {
            return res.status(400).json({ message: 'title, category and date are required!' });
        }
 
         if (!amount || amount <= 0) {
             return res.status(400).json({ message: 'Amount must be a positive number!' });
         }
 
         const income = new Income({
            userId,
             title,
             amount,
             category,
            description: description || '',
             date,
         });
 
         await income.save();
         res.status(200).json({ message: 'Income Added', income });
     } catch (error) {
         res.status(500).json({ message: 'Server Error' });
     }
 };
 
 // Get Incomes
 exports.getIncomes = async (req, res) => {
     try {
        const userId = req.user.id;
        const incomes = await Income.find({ userId }).sort({ createdAt: -1 });
         res.status(200).json(incomes);
     } catch (error) {
         res.status(500).json({ message: 'Server Error' });
     }
 };
 
 // Delete Income
 exports.deleteIncome = async (req, res) => {
     try {
        const userId = req.user.id;
         const { id } = req.params;
        const deletedIncome = await Income.findOneAndDelete({ _id: id, userId });
 
         if (!deletedIncome) {
             return res.status(404).json({ message: 'Income not found' });
         }
 
         res.status(200).json({ message: 'Income Deleted' });
     } catch (error) {
         res.status(500).json({ message: 'Server Error' });
     }
 };
