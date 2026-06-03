
const Expense = require('../models/ExpenseModel');
const { autoCategorizeExpense } = require('../services/ai');
 
 exports.addExpense = async (req, res) => {

    try {
        const userId = req.user.id;
        let { title, amount, category, description, date } = req.body;
 

        amount = Number(amount);
 

        if (!title || !description || !date) {
            return res.status(400).json({ message: 'title, description, date are required!' });
         }


        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Amount must be a positive number!' });
         }


        const aiCategory = await autoCategorizeExpense({ title, description, amount });

       const expense = new Expense({
            userId,
           title,
            amount,
            category: category || aiCategory.category,
            merchant: aiCategory.merchant,
            aiConfidence: aiCategory.confidence,
            aiReason: aiCategory.reason,
            description,
            date,
        });

        await expense.save();
        res.status(200).json({ message: 'Expense Added', expense, aiCategory });
     } catch (error) {

        res.status(500).json({ message: 'Server Error' });
     }
};
 

exports.getExpense = async (req, res) => {
    try {
        const userId = req.user.id;
        const expenses = await Expense.find({ userId }).sort({ createdAt: -1 });
        res.status(200).json(expenses);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};
 

exports.deleteExpense = async (req, res) => {
     try {

        const userId = req.user.id;
        const { id } = req.params;
        const deleted = await Expense.findOneAndDelete({ _id: id, userId });

        if (!deleted) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        res.status(200).json({ message: 'Expense Deleted' });
     } catch (error) {
        res.status(500).json({ message: 'Server Error' });
     }
};
