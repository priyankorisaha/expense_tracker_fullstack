import React, { useCallback, useContext, useMemo, useState } from 'react';
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api/v1/';

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
    const [chatMessages, setChatMessages] = useState([]);

    const api = useMemo(() => buildApi(token), [token]);

    const clearSession = useCallback(() => {
        setToken('');
        setUser(null);
        setIncomes([]);
        setExpenses([]);
        setBudgetCopilot(null);
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
            const response = await api.get('ai/budget-copilot');
            setBudgetCopilot(response.data);
        } catch (err) {
            const msg = err?.response?.data?.message || 'Unable to fetch budget copilot';
            handleProtectedError(err, 'Unable to fetch budget copilot');

            setBudgetCopilot({
                healthScore: 0,
                safeToSpend: 0,
                categoryBudgets: [],
                recommendations: [msg],
            });
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

    const askAiChat = async (question) => {
        try {
            const response = await api.post('ai/chat', { question });
            const newMessages = [
                ...chatMessages,
                { role: 'user', content: question },
                { role: 'assistant', content: response.data.answer, followUps: response.data.followUps || [] },
            ];
            setChatMessages(newMessages);
            return response.data;
        } catch (err) {
            handleProtectedError(err, 'Unable to get AI response');
            return null;
        }
    };


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
                error,
                setError,
                token,
                user,
                login,
                register,
                logout,
                budgetCopilot,
                getBudgetCopilot,
                chatMessages,
                askAiChat,
            }}
        >
            {children}
        </GlobalContext.Provider>
    );
};

export const useGlobalContext = () => useContext(GlobalContext);