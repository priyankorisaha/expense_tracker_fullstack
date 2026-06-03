import { dashboard, expenses, trend, categories, users } from '../utils/Icons';

export const menuItems = [
    {
        id: 1,
        title: 'Dashboard',
        icon: dashboard,
        link: '/dashboard',
    },
    {
        id: 3,
        title: 'Incomes',
        icon: trend,
        link: '/dashboard',
    },
    {
        id: 4,
        title: 'Expenses',
        icon: expenses,
        link: '/dashboard',
    },
    {
        id: 5,
        title: 'AI Budget Copilot',
        icon: categories,
        link: '/dashboard',
    },
    {
        id: 6,
        title: 'AI Chat',
        icon: users,
        link: '/dashboard',
    },
];