import React, { useState } from 'react';
import styled from 'styled-components';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useGlobalContext } from '../../context/globalContext';
import IncomeItem from '../IncomeItem/IncomeItem';

function MonthlyHistory({ type }) {
    const { getTransactionsForMonth, monthTotals, user } = useGlobalContext();
    const [selectedMonthDate, setSelectedMonthDate] = useState(() => {
        const date = new Date();
        date.setDate(1);
        return date;
    });
    const selectedMonth = selectedMonthDate.toISOString().slice(0, 7);
    const transactions = getTransactionsForMonth(selectedMonth, type);
    const totals = monthTotals(selectedMonth);

    const currency = user?.currency === 'USD' ? '$' : (user?.currency === 'INR' ? '₹' : (user?.currency || '₹'));

    return (
        <MonthlyHistoryStyled>
            <h1>{type === 'income' ? 'Monthly Income' : 'Monthly Expenses'}</h1>
            <div className="summary-row">
                <div>
                    <h3>Selected month</h3>
                    <p>{selectedMonth}</p>
                </div>
                <div>
                    <h3>Month total</h3>
                    <p>
                        {currency}{type === 'income' ? totals.incomeTotal.toFixed(2) : totals.expenseTotal.toFixed(2)}
                    </p>
                </div>
            </div>
            <div className="month-picker">
                <label htmlFor="monthPicker">Pick month and year</label>
                <DatePicker
                    id="monthPicker"
                    selected={selectedMonthDate}
                    onChange={(date) => {
                        if (!date) return;
                        const normalized = new Date(date);
                        normalized.setDate(1);
                        setSelectedMonthDate(normalized);
                    }}
                    dateFormat="MM/yyyy"
                    showMonthYearPicker
                    showFullMonthYearPicker
                    className="month-dropdown"
                />
            </div>
            <div className="transactions-list">
                {transactions.length > 0 ? (
                    transactions.map((item) => (
                        <IncomeItem
                            key={item._id}
                            id={item._id}
                            title={item.title}
                            description={item.description}
                            amount={item.amount}
                            date={item.date}
                            type={item.type}
                            category={item.category}
                            indicatorColor={type === 'expense' ? '#e74c3c' : 'var(--color-green)'}
                        />
                    ))
                ) : (
                    <div className="no-data">
                        <h3>No transactions in this month</h3>
                        <p>Try a different month or add some {type === 'expense' ? 'expenses' : 'income'}.</p>
                    </div>
                )}
            </div>
        </MonthlyHistoryStyled>
    );
}

const MonthlyHistoryStyled = styled.div`
    padding: 1rem 2rem;
    h1 {
        margin-bottom: 1.5rem;
    }

    .summary-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
        div {
            background: #FCF6F9;
            border: 2px solid #FFFFFF;
            border-radius: 20px;
            box-shadow: 0px 1px 15px rgba(0, 0, 0, 0.06);
            padding: 1rem;
            h3 {
                margin-bottom: 0.5rem;
                font-size: 1rem;
                color: rgba(34, 34, 96, 0.7);
            }
            p {
                font-size: 2rem;
                font-weight: 700;
                color: #222260;
            }
        }
    }

    .month-picker {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
        label {
            font-size: 0.95rem;
            color: rgba(34, 34, 96, 0.7);
        }
        .month-dropdown {
            width: 220px;
            padding: 0.85rem 1rem;
            border: 1px solid rgba(34, 34, 96, 0.15);
            border-radius: 14px;
            background: #fff;
            color: #222260;
            font-size: 1rem;
            cursor: pointer;
        }
    }

    .transactions-list {
        display: grid;
        gap: 1rem;
    }

    .no-data {
        background: #FCF6F9;
        border: 2px solid #FFFFFF;
        border-radius: 20px;
        box-shadow: 0px 1px 15px rgba(0, 0, 0, 0.06);
        padding: 2rem;
        text-align: center;
        h3 {
            margin-bottom: 0.5rem;
        }
        p {
            color: rgba(34, 34, 96, 0.7);
        }
    }
`;

export default MonthlyHistory;
