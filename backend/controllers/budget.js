const Income = require('../models/IncomeModel');
const Expense = require('../models/ExpenseModel');
const User = require('../models/userModel');
const { generateBudgetAdvice } = require('../services/ai');

exports.getBudgetCopilot = async (req, res) => {
    try {
        const userId = req.user.id;

        const [incomes, expenses, user] = await Promise.all([
            Income.find({ userId }).lean(),
            Expense.find({ userId }).lean(),
            User.findById(userId).lean(),
        ]);

        if (!user) {
            console.warn('getBudgetCopilot warning: user not found for id', userId);
        }

        const monthlyIncome = incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const monthlyExpense = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const categoryMap = expenses.reduce((acc, item) => {
            const key = item.category || 'other';
            acc[key] = (acc[key] || 0) + Number(item.amount || 0);
            return acc;
        }, {});

        const topCategories = Object.entries(categoryMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([category, amount]) => ({ category, amount }));

        const aiAdvice = await generateBudgetAdvice({
            monthlyIncome,
            topCategories,
            currency: user?.currency || 'USD',
        });

        const fallbackSafeToSpend = Math.max(monthlyIncome - monthlyExpense, 0);

        return res.status(200).json({
            monthlyIncome,
            monthlyExpense,
            healthScore: aiAdvice?.healthScore ?? Math.max(0, Math.min(100, Math.round((fallbackSafeToSpend / (monthlyIncome || 1)) * 100))),
            safeToSpend: aiAdvice?.safeToSpend ?? fallbackSafeToSpend,
            categoryBudgets:
                aiAdvice?.categoryBudgets ??
                topCategories.map((row) => ({
                    category: row.category,
                    suggestedLimit: Math.round(row.amount * 0.9),
                })),
            recommendations:
                aiAdvice?.recommendations ?? [
                    'Reduce top spending category by 10% this month.',
                    'Set a weekly cap for discretionary spending.',
                ],
            message: aiAdvice?.message || 'Here is what your budget looks like and next steps to stay on track.',
            followUps: aiAdvice?.followUps || ['How can I save 10% more this month?', 'Help me plan for an emergency fund', 'Should I lower subscription expenses?'],
        });
    } catch (error) {
        console.error('getBudgetCopilot error:', error);
        return res.status(500).json({ message: 'Server Error', detail: error.message });
    }
};
