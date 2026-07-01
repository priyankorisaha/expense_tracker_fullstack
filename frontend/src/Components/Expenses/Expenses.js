import React, { useEffect } from 'react'
import styled from 'styled-components'
import { useGlobalContext } from '../../context/globalContext';
import { InnerLayout } from '../../styles/Layouts';
import IncomeItem from '../IncomeItem/IncomeItem';
import ExpenseForm from './ExpenseForm';

function Expenses() {
    const {expenses, getExpenses, deleteExpense, user} = useGlobalContext()

    useEffect(() => {
        getExpenses()
    }, [getExpenses])

    const now = new Date();
    const monthLabel = now.toLocaleString(undefined, { month: 'long' });
    const year = now.getFullYear();

    const currency = user?.currency === 'USD' ? '$' : (user?.currency === 'INR' ? '₹' : (user?.currency || '₹'));

    const parseDate = (value) => {
        if (!value) return null;
        if (value instanceof Date) return value;
        if (typeof value === 'number') return new Date(value);
        if (typeof value === 'string') {
            const trimmed = value.trim();
            const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (dmy) {
                const [, day, month, year] = dmy;
                return new Date(Number(year), Number(month) - 1, Number(day));
            }
            const parsed = new Date(trimmed);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }
        if (value?.$date) return new Date(value.$date);
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const monthlyExpenses = expenses.filter(i => {
        const d = parseDate(i.date || i.createdAt);
        return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const monthlyTotal = monthlyExpenses.reduce((s, it) => s + Number(it.amount || 0), 0);

    return (
        <ExpenseStyled>
            <InnerLayout>
                <h1>Expenses — {monthLabel} {year}</h1>
                <h2 className="total-income">Current Month Total: <span>{currency}{monthlyTotal}</span></h2>
                <div className="income-content">
                    <div className="form-container">
                        <ExpenseForm />
                    </div>
                    <div className="incomes">
                        {monthlyExpenses.map((income) => {
                            const {_id, title, amount, date, category, description, type} = income;
                            return <IncomeItem
                                key={_id}
                                id={_id} 
                                title={title} 
                                description={description} 
                                amount={amount} 
                                date={date} 
                                type={type}
                                category={category} 
                                indicatorColor="var(--color-green)"
                                deleteItem={deleteExpense}
                            />
                        })}
                    </div>
                </div>
            </InnerLayout>
        </ExpenseStyled>
    )
}

const ExpenseStyled = styled.div`
    display: flex;
    overflow: auto;
    .total-income{
        display: flex;
        justify-content: center;
        align-items: center;
        background: #FCF6F9;
        border: 2px solid #FFFFFF;
        box-shadow: 0px 1px 15px rgba(0, 0, 0, 0.06);
        border-radius: 20px;
        padding: 1rem;
        margin: 1rem 0;
        font-size: 2rem;
        gap: .5rem;
        span{
            font-size: 2.5rem;
            font-weight: 800;
            color: var(--color-green);
        }
    }
    .income-content{
        display: flex;
        gap: 2rem;
        .incomes{
            flex: 1;
        }
    }
`;

export default Expenses