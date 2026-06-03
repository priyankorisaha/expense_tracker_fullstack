const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { getBudgetCopilot } = require('../controllers/budget');
const { askFinanceChat } = require('../controllers/chat');

router.get('/ai/budget-copilot', requireAuth, getBudgetCopilot);
router.post('/ai/chat', requireAuth, askFinanceChat);

module.exports = router;
