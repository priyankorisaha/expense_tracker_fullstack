const { addExpense, getExpense, deleteExpense } = require('../controllers/expense');
const { addIncome, getIncomes, deleteIncome } = require('../controllers/income');
const { requireAuth } = require('../middleware/auth');

const router = require('express').Router();

router.post('/add-income', requireAuth, addIncome)
    .get('/get-incomes', requireAuth, getIncomes)
    .delete('/delete-income/:id', requireAuth, deleteIncome)
    .post('/add-expense', requireAuth, addExpense)
    .get('/get-expenses', requireAuth, getExpense)
    .delete('/delete-expense/:id', requireAuth, deleteExpense);

module.exports = router;