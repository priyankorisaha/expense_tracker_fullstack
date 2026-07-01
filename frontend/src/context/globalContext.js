import React, { useCallback, useContext, useMemo, useState } from 'react';
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api/v1/';

const buildApi = (token) =>
    axios.create({
        baseURL: BASE_URL,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

const publicApi = axios.create({ baseURL: BASE_URL });

const readStoredUser = () => {
    const raw = localStorage.getItem('user');
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch (error) {
        localStorage.removeItem('user');
        return null;
    }
};

const GlobalContext = React.createContext();

export const GlobalProvider = ({ children }) => {
    const [incomes, setIncomes] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [error, setError] = useState(null);

    const [token, setToken] = useState(localStorage.getItem('token') || '');
    const [user, setUser] = useState(readStoredUser);

    const [budgetCopilot, setBudgetCopilot] = useState(null);
    const [budgetError, setBudgetError] = useState(null);
    const [budgetLoading, setBudgetLoading] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);

    const api = useMemo(() => buildApi(token), [token]);

    const clearSession = useCallback(() => {
        setToken('');
        setUser(null);
        setIncomes([]);
        setExpenses([]);
        setBudgetCopilot(null);
        setBudgetError(null);
        setChatMessages([]);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }, []);

    const handleProtectedError = useCallback(
        (err, fallbackMessage) => {
            const message = err?.response?.data?.message || fallbackMessage;

            if (err?.response?.status === 401) {
                clearSession();
                setError('Your session expired or is invalid. Please log in again.');
                return;
            }

            setError(message);
        },
        [clearSession]
    );

    const login = async ({ email, password }) => {
        try {
            setError(null);
            const response = await publicApi.post('auth/login', { email, password });
            const nextToken = response.data.token;
            const nextUser = response.data.user;
            setToken(nextToken);
            setUser(nextUser);
            localStorage.setItem('token', nextToken);
            localStorage.setItem('user', JSON.stringify(nextUser));
            setError(null);
            return true;
        } catch (err) {
            setError(err?.response?.data?.message || 'Login failed');
            return false;
        }
    };

    const register = async ({ name, email, password, currency, timezone }) => {
        try {
            setError(null);
            const response = await publicApi.post('auth/register', {
                name,
                email,
                password,
                currency,
                timezone,
            });
            const nextToken = response.data.token;
            const nextUser = response.data.user;
            setToken(nextToken);
            setUser(nextUser);
            localStorage.setItem('token', nextToken);
            localStorage.setItem('user', JSON.stringify(nextUser));
            setError(null);
            return true;
        } catch (err) {
            if (!err?.response) {
                setError('Cannot reach backend. Make sure backend is running on http://localhost:5001.');
                return false;
            }
            setError(err?.response?.data?.message || 'Registration failed');
            return false;
        }
    };

    const logout = () => {
        clearSession();
        setError(null);
    };

    const getIncomes = useCallback(async () => {
        try {
            const response = await api.get('get-incomes');
            setIncomes(response.data);
        } catch (err) {
            handleProtectedError(err, 'Unable to fetch incomes');
        }
    }, [api, handleProtectedError]);

    const addIncome = async (income) => {
        try {
            await api.post('add-income', income);
            await getIncomes();
        } catch (err) {
            handleProtectedError(err, 'Unable to add income');
        }
    };

    const deleteIncome = async (id) => {
        try {
            await api.delete(`delete-income/${id}`);
            await getIncomes();
        } catch (err) {
            handleProtectedError(err, 'Unable to delete income');
        }
    };

    const totalIncome = () => incomes.reduce((sum, income) => sum + Number(income.amount || 0), 0);

    const getBudgetCopilot = useCallback(async () => {
        try {
            setBudgetError(null);
            setBudgetLoading(true);
            const response = await api.get('ai/budget-copilot');
            const data = response.data || {};
            setBudgetCopilot({ ...data, isML: Boolean(data.isML), mlError: data.mlError || null });
        } catch (err) {
            const msg = err?.response?.data?.message || 'Unable to fetch budget copilot';
            if (err?.response?.status === 401) {
                handleProtectedError(err, msg);
                setBudgetCopilot(null);
                return;
            }

            setBudgetError(msg);
            setBudgetCopilot(null);
            return;
        } finally {
            setBudgetLoading(false);
        }
    }, [api, handleProtectedError]);

    const getExpenses = useCallback(async () => {
        try {
            const response = await api.get('get-expenses');
            setExpenses(response.data);
        } catch (err) {
            handleProtectedError(err, 'Unable to fetch expenses');
        }
    }, [api, handleProtectedError]);

    const addExpense = async (expense) => {
        try {
            await api.post('add-expense', expense);
            await getExpenses();
            await getBudgetCopilot();
        } catch (err) {
            handleProtectedError(err, 'Unable to add expense');
        }
    };

    const deleteExpense = async (id) => {
        try {
            await api.delete(`delete-expense/${id}`);
            await getExpenses();
            await getBudgetCopilot();
        } catch (err) {
            handleProtectedError(err, 'Unable to delete expense');
        }
    };

    const totalExpenses = () => expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

    const totalBalance = () => totalIncome() - totalExpenses();

    const transactionHistory = () => {
        const history = [...incomes, ...expenses];
        history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return history.slice(0, 3);
    };

    // Helpers for monthly views
    const _monthKey = (date) => {
        try {
            return new Date(date).toISOString().slice(0, 7); // YYYY-MM
        } catch (e) {
            return null;
        }
    };

    const getMonths = () => {
        const months = new Set();
        [...incomes, ...expenses].forEach((t) => {
            const key = _monthKey(t.date || t.createdAt || t.createdAt);
            if (key) months.add(key);
        });
        return Array.from(months).sort((a, b) => (a < b ? 1 : -1));
    };

    const getTransactionsForMonth = (month, type) => {
        const list = type === 'income' ? incomes : expenses;
        return list.filter((t) => _monthKey(t.date || t.createdAt) === month).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    };

    const monthTotals = (month) => {
        const incomeTotal = incomes.filter((t) => _monthKey(t.date || t.createdAt) === month).reduce((s, i) => s + Number(i.amount || 0), 0);
        const expenseTotal = expenses.filter((t) => _monthKey(t.date || t.createdAt) === month).reduce((s, e) => s + Number(e.amount || 0), 0);
        return { incomeTotal, expenseTotal };
    };

    const currentMonthKey = () => new Date().toISOString().slice(0, 7);


    const askAiChat = useCallback(async (question) => {
        try {
            setChatLoading(true);
            const response = await api.post('ai/chat', { question });
            setChatMessages((currentMessages) => [
                ...currentMessages,
                { role: 'user', content: question },
                { role: 'assistant', content: response.data.answer, followUps: response.data.followUps || [], isML: response.data.isML },
            ]);
            setChatLoading(false);
            return response.data;
        } catch (err) {
            setChatLoading(false);
            handleProtectedError(err, 'Unable to get AI response');
            return null;
        }
    }, [api, handleProtectedError]);


    return (
        <GlobalContext.Provider
            value={{
                addIncome,
                getIncomes,
                incomes,
                deleteIncome,
                expenses,
                totalIncome,
                addExpense,
                getExpenses,
                deleteExpense,
                totalExpenses,
                totalBalance,
                transactionHistory,
                getMonths,
                getTransactionsForMonth,
                monthTotals,
                currentMonthKey,
                error,
                setError,
                token,
                user,
                login,
                register,
                logout,
                budgetCopilot,
                budgetError,
                budgetLoading,
                getBudgetCopilot,
                chatMessages,
                askAiChat,
                chatLoading,
            }}
        >
            {children}
        </GlobalContext.Provider>
    );
};

export const useGlobalContext = () => useContext(GlobalContext);
