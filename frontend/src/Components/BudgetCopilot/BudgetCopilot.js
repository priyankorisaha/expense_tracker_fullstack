import React, { useEffect } from 'react';
import styled from 'styled-components';
import { useGlobalContext } from '../../context/globalContext';

function BudgetCopilot() {
    const { budgetCopilot, getBudgetCopilot, error } = useGlobalContext();

    useEffect(() => {
        getBudgetCopilot();
    }, [getBudgetCopilot]);

    if (error) {
        return <p style={{ color: 'red' }}>Unable to load AI budget copilot: {error}</p>;
    }

    if (!budgetCopilot) {
        return <p>Loading AI budget copilot...</p>;
    }

    return (
        <Wrapper>
            <h1>AI Budget Copilot</h1>
            <div className="cards">
                <div className="card">
                    <h3>Health Score</h3>
                    <p>{budgetCopilot.healthScore}</p>
                </div>
                <div className="card">
                    <h3>Safe To Spend</h3>
                    <p>{budgetCopilot.safeToSpend}</p>
                </div>
            </div>

            <h2>Suggested Category Limits</h2>
            <ul>
                {budgetCopilot.categoryBudgets?.map((item) => (
                    <li key={item.category}>
                        {item.category}: {item.suggestedLimit}
                    </li>
                ))}
            </ul>

            <h2>Recommendations</h2>
            <ul>
                {budgetCopilot.recommendations?.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                ))}
            </ul>
        </Wrapper>
    );
}

const Wrapper = styled.div`
    padding: 1rem;
    .cards {
        display: flex;
        gap: 1rem;
    }
    .card {
        background: #fcf6f9;
        border-radius: 1rem;
        padding: 1rem;
        min-width: 180px;
    }
`;

export default BudgetCopilot;
