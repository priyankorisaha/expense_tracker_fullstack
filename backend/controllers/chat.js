const Income = require('../models/IncomeModel');
const Expense = require('../models/ExpenseModel');
const { chatWithFinanceAssistant } = require('../services/ai');

exports.askFinanceChat = async (req, res) => {
    try {
        const userId = req.user.id;
        const { question } = req.body;

        if (!question) {
            return res.status(400).json({ message: 'question is required' });
        }

        const [incomes, expenses] = await Promise.all([
            Income.find({ userId }).sort({ date: -1 }).limit(100).lean(),
            Expense.find({ userId }).sort({ date: -1 }).limit(100).lean(),
        ]);

        const totalIncome = incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const totalExpense = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const byCategory = expenses.reduce((acc, item) => {
            const key = item.category || 'other';
            acc[key] = (acc[key] || 0) + Number(item.amount || 0);
            return acc;
        }, {});

        const context = {
            totalIncome,
            totalExpense,
            balance: totalIncome - totalExpense,
            topCategories: Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([category, amount]) => ({ category, amount })),
            recentExpenses: expenses.slice(0, 10).map((e) => ({
                title: e.title,
                amount: e.amount,
                date: e.date,
                category: e.category,
            })),
        };

        const ai = await chatWithFinanceAssistant({ question, context });
        return res.status(200).json(ai);
    } catch (error) {
        return res.status(500).json({ message: 'Server Error' });
    }
};
