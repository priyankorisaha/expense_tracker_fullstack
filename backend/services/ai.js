const API_URL = 'https://api.openai.com/v1/chat/completions';
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5002';
// Allow longer boot timeout because local model training can take time on first run
const ML_BOOT_TIMEOUT_MS = Number(process.env.ML_BOOT_TIMEOUT_MS || 120000);
const { spawn, spawnSync } = require('child_process');
const path = require('path');

const ML_SERVICE_DIR = path.resolve(__dirname, '..', '..', 'ml-service');
let mlProcess = null;
let mlBootPromise = null;
let lastMlError = null;

const hasApiKey = () => Boolean(process.env.OPENAI_API_KEY);

const callLLM = async (messages, temperature = 0.2) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
        return null;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages,
                temperature,
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('OpenAI API returned error', response.status, text);
            return null;
        }

        const json = await response.json();
        const content = json.choices?.[0]?.message?.content;
        if (!content) {
            console.error('OpenAI API returned no message content', JSON.stringify(json));
            return null;
        }

        return content;
    } catch (err) {
        console.error('callLLM exception:', err);
        return null;
    }
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 3000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
};

const isMlHealthy = async () => {
    try {
        // allow a slightly longer timeout when checking health locally
        const response = await fetchWithTimeout(`${ML_SERVICE_URL}/health`, {}, 2000);
        if (!response.ok) {
            lastMlError = `ML health probe returned ${response.status}`;
            return false;
        }
        lastMlError = null;
        return true;
    } catch (err) {
        lastMlError = err.message;
        return false;
    }
};

const getPythonCandidates = () => [
    { command: path.join(ML_SERVICE_DIR, 'venv', 'Scripts', 'python.exe'), checkArgs: ['--version'], runArgs: ['app.py'] },
    { command: 'python', checkArgs: ['--version'], runArgs: ['app.py'] },
    { command: 'python3', checkArgs: ['--version'], runArgs: ['app.py'] },
    { command: 'py', checkArgs: ['-3', '--version'], runArgs: ['app.py'] },
    { command: 'py', checkArgs: ['--version'], runArgs: ['app.py'] },
];

const pickPythonCommand = () => {
    for (const candidate of getPythonCandidates()) {
        const result = spawnSync(candidate.command, candidate.checkArgs, {
            cwd: ML_SERVICE_DIR,
            encoding: 'utf8',
            shell: false,
        });

        if (!result.error && result.status === 0) {
            return candidate;
        }
    }

    return null;
};

const restartMlService = async () => {
    if (mlProcess) {
        try {
            mlProcess.kill();
        } catch (err) {
            console.warn('[ml-service] Failed to kill existing process:', err.message);
        }
        mlProcess = null;
    }
    mlBootPromise = null;
    return ensureMlService();
};

const waitForMlHealth = async (timeoutMs = ML_BOOT_TIMEOUT_MS) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        if (await isMlHealthy()) return true;
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
};

const ensureMlService = async () => {
    if (await isMlHealthy()) {
        lastMlError = null;
        return true;
    }

    if (mlBootPromise) {
        return mlBootPromise;
    }

    mlBootPromise = (async () => {
        const pythonCmd = pickPythonCommand();

        if (!pythonCmd) {
            lastMlError = 'Python is not available. Recreate ml-service/venv or install Python, then start the ML service.';
            console.warn(`Local ML Service unavailable: ${lastMlError}`);
            return false;
        }

        try {
            mlProcess = spawn(pythonCmd.command, pythonCmd.runArgs, {
                cwd: ML_SERVICE_DIR,
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: false,
            });

            mlProcess.stdout.on('data', (data) => {
                console.log(`[ml-service] ${data.toString().trim()}`);
            });

            mlProcess.stderr.on('data', (data) => {
                const message = data.toString().trim();
                lastMlError = message;
                console.warn(`[ml-service] ${message}`);
            });

            mlProcess.on('error', (err) => {
                lastMlError = err.message;
                console.warn('[ml-service] spawn error:', err.message);
            });

            mlProcess.on('exit', (code) => {
                if (code !== 0) {
                    lastMlError = `ML service exited with code ${code}.`;
                }
                mlProcess = null;
                mlBootPromise = null;
            });

            const runArgsStr = (pythonCmd.runArgs || []).join(' ');
            console.log(`Starting ML service using: ${pythonCmd.command} ${runArgsStr} (cwd=${ML_SERVICE_DIR}), waiting up to ${ML_BOOT_TIMEOUT_MS}ms for health...`);
            const healthy = await waitForMlHealth();
            if (!healthy && !lastMlError) {
                lastMlError = `ML service did not become healthy on ${ML_SERVICE_URL} within ${ML_BOOT_TIMEOUT_MS}ms.`;
            }
            return healthy;
        } catch (err) {
            lastMlError = err.message;
            console.warn('Unable to auto-start local ML Service:', err.message);
            return false;
        } finally {
            if (!(await isMlHealthy())) {
                mlBootPromise = null;
            }
        }
    })();

    return mlBootPromise;
};

const ensureMlServiceFast = async (timeoutMs = 8000) => {
    if (await isMlHealthy()) {
        lastMlError = null;
        return true;
    }

    const bootPromise = ensureMlService();
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs));
    return Promise.race([bootPromise, timeoutPromise]);
};

const callMlJson = async (endpoint, body) => {
    const mlUrl = `${ML_SERVICE_URL}${endpoint}`;
    let ready = await ensureMlServiceFast();
    if (!ready) {
        console.warn(`[ml-service] local health probe timed out or failed, waiting for ML service startup at ${ML_SERVICE_URL}`);
        ready = await ensureMlService();
    }

    if (!ready) {
        console.warn(`[ml-service] local ML service unavailable after startup wait. lastMlError=${lastMlError}`);
        return null;
    }

    try {
        console.log(`[ml-service] calling ${mlUrl}`);
        const response = await fetchWithTimeout(mlUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }, 10000);

        if (!response.ok) {
            lastMlError = `ML service returned ${response.status} for ${endpoint}.`;
            return null;
        }

        const text = await response.text();
        try {
            const json = JSON.parse(text);
            lastMlError = null;
            return json;
        } catch (err) {
            lastMlError = `Invalid JSON from ML service on ${endpoint}: ${err.message}`;
            console.warn('[ml-service] Invalid JSON response:', text);
            return null;
        }
    } catch (err) {
        lastMlError = err.message;
        return null;
    }
};

exports.getMlServiceStatus = async () => {
    const healthy = await isMlHealthy();
    return {
        healthy,
        url: ML_SERVICE_URL,
        error: healthy ? null : lastMlError,
    };
};

exports.ensureMlService = ensureMlService;

exports.autoCategorizeExpense = async ({ title, description, amount }) => {
    // 1. Try local ML Service first
    const mlData = await callMlJson('/categorize', { title, description, amount });
    if (mlData) {
        return {
            category: mlData.category,
            merchant: title || 'Unknown',
            confidence: mlData.confidence,
            reason: mlData.reason,
        };
    }

    // 2. Fallback to OpenAI or Regex
    try {
        const prompt = [
            { role: 'system', content: 'Categorize user expense into JSON {"category":"...","merchant":"...","confidence":0.0-1.0,"reason":"..."}' },
            { role: 'user', content: `title=${title || ''}; description=${description || ''}; amount=${amount || 0}` },
        ];

        const raw = await callLLM(prompt, 0);
        if (!raw) {
            const fallbackCategory = (text) => {
                const lower = (text || '').toLowerCase();
                if (/uber|lyft|taxi|bus|fuel|petrol|gas/.test(lower)) return 'transport';
                if (/food|restaurant|cafe|grocery/.test(lower)) return 'food';
                if (/rent|electricity|internet|water|utility/.test(lower)) return 'utilities';
                if (/netflix|spotify|prime|subscription/.test(lower)) return 'subscriptions';
                if (/doctor|hospital|medicine/.test(lower)) return 'medical';
                return 'other';
            };

            return {
                category: fallbackCategory(`${title} ${description}`),
                merchant: title || 'Unknown',
                confidence: 0.55,
                reason: 'Fallback rule-based categorization',
            };
        }

        const parsed = JSON.parse(raw);
        return {
            category: parsed?.category || 'other',
            merchant: parsed?.merchant || title || 'Unknown',
            confidence: Number(parsed?.confidence || 0.7),
            reason: parsed?.reason || 'AI categorized',
        };
    } catch (error) {
        console.error('autoCategorizeExpense fallback error:', error);
        return {
            category: 'other',
            merchant: title || 'Unknown',
            confidence: 0.5,
            reason: 'fallback due to error',
        };
    }
};

const buildFallbackBudgetAdvice = ({ monthlyIncome, topCategories, currency }) => {
    const totalExpense = topCategories.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const safeToSpend = Math.max(Math.round(monthlyIncome - totalExpense), 0);
    const utilization = monthlyIncome > 0 ? totalExpense / monthlyIncome : 0;
    const utilizationPct = Math.round(utilization * 100);
    const healthScore = Math.max(0, Math.min(100, Math.round((1 - utilization) * 100)));
    const riskLevel =
        utilization >= 1 ? 'critical' :
        utilization >= 0.85 ? 'high' :
        utilization >= 0.65 ? 'medium' :
        utilization >= 0.4 ? 'low' :
        'excellent';
    const limitMultiplier =
        riskLevel === 'critical' ? 0.7 :
        riskLevel === 'high' ? 0.8 :
        riskLevel === 'medium' ? 0.88 :
        0.95;

    const categoryBudgets = topCategories.map((item) => ({
        category: item.category,
        suggestedLimit: Math.max(Math.round(Number(item.amount || 0) * limitMultiplier), 0),
    }));

    const recommendations = [];
    if (riskLevel === 'critical') {
        recommendations.push(`Critical risk: spending is ${utilizationPct}% of income, so pause non-essential purchases until cash flow is positive.`);
    } else if (riskLevel === 'high') {
        recommendations.push(`High risk: spending is ${utilizationPct}% of income. Reduce flexible categories by 15-20% this month.`);
    } else if (riskLevel === 'medium') {
        recommendations.push(`Medium risk: spending is ${utilizationPct}% of income. A focused 10-12% cut in your top category should improve headroom.`);
    } else if (riskLevel === 'low') {
        recommendations.push(`Low risk: spending is ${utilizationPct}% of income. Keep a light cap on wants while protecting savings.`);
    } else {
        recommendations.push(`Excellent zone: spending is only ${utilizationPct}% of income, leaving strong room for savings or planned goals.`);
    }

    if (topCategories.length > 0) {
        const top1 = topCategories[0];
        const cutPercent = riskLevel === 'critical' ? 25 : riskLevel === 'high' ? 20 : riskLevel === 'medium' ? 12 : 8;
        recommendations.push(`Top driver: ${top1.category} is ${currency || 'USD'} ${Math.round(Number(top1.amount || 0))}. Try a ${cutPercent}% reduction to free about ${currency || 'USD'} ${Math.round(Number(top1.amount || 0) * cutPercent / 100)}.`);
    }

    recommendations.push(riskLevel === 'critical' || riskLevel === 'high'
        ? 'Set a weekly spending ceiling now so the month does not drift further.'
        : 'Keep a weekly review rhythm so the forecast stays accurate as new expenses arrive.');

    const messages = [];
    if (riskLevel === 'critical') {
        messages.push(`Critical budget risk: expenses are ${utilizationPct}% of income, so your safe-to-spend amount is limited until spending drops.`);
    } else if (riskLevel === 'high') {
        messages.push(`High budget risk at ${utilizationPct}% utilization. Prioritize essentials and reduce discretionary spending.`);
    } else if (riskLevel === 'medium') {
        messages.push(`Medium budget risk at ${utilizationPct}% utilization. A small but consistent category cut will strengthen cash flow.`);
    } else if (riskLevel === 'low') {
        messages.push(`Low budget risk at ${utilizationPct}% utilization. You have room, but keep category limits active.`);
    } else {
        messages.push(`Excellent budget position at ${utilizationPct}% utilization. Great work keeping expenses far below income.`);
    }

    messages.push(`Based on your current data, you can safely spend around ${currency || 'USD'} ${safeToSpend}.`);

    return {
        healthScore,
        safeToSpend,
        categoryBudgets,
        recommendations,
        message: messages.join(' '),
        followUps: [
            'Can you suggest three small changes I can make in the next week?',
            'What is the best way to save for an emergency fund with this budget?',
            'How should I adjust if my income changes next month?',
        ],
        riskLevel,
        isML: false
    };
};

exports.generateBudgetAdvice = async ({ monthlyIncome, topCategories, currency, incomes = [], expenses = [] }) => {
    // 1. Try local ML Service first
    const mlData = await callMlJson('/forecast-budget', { incomes, expenses, currency });
    if (mlData) {
        return {
            healthScore: mlData.healthScore,
            safeToSpend: mlData.safeToSpend,
            categoryBudgets: mlData.categoryBudgets,
            recommendations: mlData.recommendations,
            message: mlData.message,
            followUps: mlData.followUps,
            riskLevel: mlData.riskLevel,
            isML: true,
            mlError: null
        };
    }

    return {
        ...buildFallbackBudgetAdvice({ monthlyIncome, topCategories, currency }),
        mlError: lastMlError,
    };
};

exports.chatWithFinanceAssistant = async ({ question, context }) => {
    // 1. Try local ML Service first
    const mlData = await callMlJson('/chat-advice', { question, context });
    if (mlData && typeof mlData.answer === 'string') {
        return {
            answer: mlData.answer,
            followUps: Array.isArray(mlData.followUps) ? mlData.followUps : [],
            isML: true,
            mlError: null
        };
    }

    if (mlData) {
        console.warn('[ml-service] chat-advice returned invalid response, falling back.');
    }

    // 2. Fallback to rule-based response
    try {
        const text = (question || '').toLowerCase().trim();
        const income = Number(context?.totalIncome || 0);
        const expense = Number(context?.totalExpense || 0);
        const balance = Number(context?.balance || income - expense);
        const topCategories = Array.isArray(context?.topCategories) ? context.topCategories : [];
        const detectedAmount = question?.match(/(\d[\d,]*)/);
        const askedAmount = detectedAmount ? Number(detectedAmount[1].replace(/,/g, '')) : null;
        const planningAmount = askedAmount && askedAmount > 0 ? askedAmount : income;
        const savingsTarget = Math.round(planningAmount * 0.3);
        const needsBudget = Math.round(planningAmount * 0.5);
        const wantsBudget = Math.round(planningAmount * 0.2);
        const weeklyWantsBudget = Math.round(wantsBudget / 4);
        const savingsRate = income > 0 ? Math.round((Math.max(balance, 0) / income) * 100) : 0;
        const categoryHints = topCategories.slice(0, 3).map((row) => `- ${row.category}: ${Math.round(Number(row.amount || 0))}`).join('\n');
        const wantsSpendingPlan = /spend|budget|plan|allocate|distribution|split/.test(text);
        const wantsSavings = /save|saving|invest|sip|emergency fund|goal/.test(text);
        const wantsExpenseCut = /reduce|cut|lower|decrease|optimi[sz]e/.test(text);
        const wantsWeekly = /week|weekly|per week/.test(text);
        const wantsCategory = /category|categories|food|rent|transport|subscription/.test(text);

        const openingOptions = [
            'Hey there! I’m your budgeting buddy — let’s make money feel like a team game.',
            'Nice question! I’ve got your back with a practical money chat.',
            'Absolutely, this is a great topic. Let’s turn your budget into wins.',
        ];
        const opening = openingOptions[Math.floor(Math.random() * openingOptions.length)];

        let answer = `${opening}\n\n`;
        answer += `Here is what I can see in your current snapshot:\n- Income: ${income}\n- Expense: ${expense}\n- Balance: ${balance}\n`;
        if (categoryHints) answer += `- Top spending categories:\n${categoryHints}\n`;

        if (wantsSpendingPlan || askedAmount) {
            answer += `\nBased on your goal of planning ${planningAmount}, here’s a friendly 50/30/20 split:\n- Needs: ${needsBudget}\n- Savings/Investments: ${savingsTarget}\n- Wants: ${wantsBudget}\n- Weekly wants cap: ${weeklyWantsBudget}\n`;
        }

        if (wantsSavings) {
            answer += `\nGood call on savings! Aim for at least 30% of income (~${Math.round(income * 0.3)}). Your current savings rate is around ${savingsRate}%.`;
        }

        if (wantsExpenseCut) {
            const topOne = topCategories[0];
            if (topOne) {
                answer += `\nLet’s trim ${topOne.category} by 10% this month to save about ${Math.round(Number(topOne.amount || 0) * 0.1)}.`;
            } else {
                answer += '\nA good quick move: track spending for 2 weeks and then cut the top non-essential category by 10%.\n';
            }
        }

        if (wantsWeekly) {
            const weeklyNeeds = Math.round(needsBudget / 4);
            const weeklySavings = Math.round(savingsTarget / 4);
            answer += `\nWeek-by-week direction:\n- Needs: ${weeklyNeeds}\n- Savings: ${weeklySavings}\n- Wants: ${weeklyWantsBudget}\n`;
        }

        if (wantsCategory && topCategories.length > 0) {
            answer += '\nCategory focus: keep each top category a bit lower (10% down) than last month to build momentum.\n';
        }

        if (!wantsSpendingPlan && !wantsSavings && !wantsExpenseCut && !wantsWeekly && !wantsCategory) {
            answer += '\nI have a few ideas: you can ask me to be your debt-slayer, savings planner, or grocery negotiator. What would you like next?\n';
        }

        const followUps = [
            'Help me create a daily spending plan',
            'How can I save 20% more without feeling restricted?',
            'Show me a simple plan to reduce grocery spend',
            'Tell me how to make an emergency fund fast',
        ];

        return {
            answer: answer + '\nPractical next step: save first, then spend wisely. Ask me for a day-by-day tracker if you want.',
            followUps,
            isML: false
        };
    } catch (error) {
        console.error('chatWithFinanceAssistant fallback error:', error);
        return {
            answer: 'I could not generate advice right now. Please retry with a shorter question.',
            followUps: ['How to spend 60000 efficiently'],
            isML: false
        };
    }
};
