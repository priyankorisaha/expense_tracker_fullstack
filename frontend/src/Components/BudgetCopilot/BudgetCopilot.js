import React, { useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useGlobalContext } from '../../context/globalContext';

function BudgetCopilot({ onAskFollowUp }) {
    const { budgetCopilot, getBudgetCopilot, budgetError, budgetLoading } = useGlobalContext();

    useEffect(() => {
        getBudgetCopilot();
    }, [getBudgetCopilot]);

    const isInitialLoad = !budgetLoading && !budgetError && !budgetCopilot;
    if (budgetLoading || isInitialLoad) {
        return (
            <LoadingWrapper>
                <div className="loader"></div>
                <p>Analyzing financial logs & preparing ML forecast models...</p>
            </LoadingWrapper>
        );
    }

    if (budgetError || !budgetCopilot) {
        return (
            <ErrorWrapper>
                <div className="error-card">
                    <h2>⚠️ Unable to load AI Budget Copilot</h2>
                    <p>{budgetError || 'Unable to retrieve Budget Copilot results. Please sign in again or retry.'}</p>
                    <button onClick={() => getBudgetCopilot()}>Retry Connection</button>
                </div>
            </ErrorWrapper>
        );
    }

    const { healthScore, safeToSpend, categoryBudgets, recommendations, message, isML, followUps, riskLevel, currency = 'USD', mlError } = budgetCopilot;
    const isMLActive = isML === true;
    const formatMoney = (amount) => `${currency} ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const normalizedRisk = riskLevel || (healthScore >= 80 ? 'excellent' : healthScore >= 50 ? 'medium' : 'high');
    const statusDetail = !isMLActive && mlError ? mlError : null;

    // Get color based on health score
    const getHealthColor = (score) => {
        if (score >= 80) return '#2ecc71';
        if (score >= 50) return '#f1c40f';
        return '#e74c3c';
    };

    return (
        <Wrapper>
            <Header>
                <div className="title-area">
                    <h1>AI Budget Copilot</h1>
                    <p className="subtitle">Real-time budget forecasting & recommendations powered by local Machine Learning models</p>
                </div>
                <StatusBadge isML={isMLActive}>
                    <span className="dot"></span>
                    <span className="text">{isMLActive ? 'Local ML Model Active' : 'ML Service Offline (Rules Fallback)'}</span>
                </StatusBadge>
                {statusDetail && <StatusDetail>{statusDetail}</StatusDetail>}
            </Header>

            <div className="overview-section">
                <Card className="health-card" scoreColor={getHealthColor(healthScore)}>
                    <h3>Projected Financial Health</h3>
                    <div className="score-container">
                        <div className="circle-bg">
                            <span className="score-val">{healthScore}</span>
                            <span className="score-label">Score</span>
                        </div>
                    </div>
                    <p className="health-desc">
                        {normalizedRisk === 'critical' ? 'Critical risk detected. Pause non-essential spending and protect essentials.' :
                         normalizedRisk === 'high' ? 'High utilization forecasted. Review recommended category cuts.' :
                         normalizedRisk === 'medium' ? 'Medium risk pattern predicted. There is room for improvement.' :
                         normalizedRisk === 'low' ? 'Low risk pattern detected. Keep limits active and savings protected.' :
                         'Your budget is in excellent shape! Highly optimized saving rate.'}
                    </p>
                    <span className={`risk-pill ${normalizedRisk}`}>{normalizedRisk} risk</span>
                </Card>

                <Card className="spend-card">
                    <h3>Forecasted Safe To Spend</h3>
                    <div className="amount-container">
                        <span className="amount-val">{formatMoney(safeToSpend)}</span>
                    </div>
                    <p className="spend-desc">{message}</p>
                </Card>
            </div>

            <ContentGrid>
                <div className="grid-col">
                    <h2>Suggested Category Limits</h2>
                    <div className="list-card">
                        {categoryBudgets && categoryBudgets.length > 0 ? (
                            <ul>
                                {categoryBudgets.map((item) => (
                                    <li key={item.category} className="category-item">
                                        <div className="category-header">
                                            <span className="category-name">{item.category}</span>
                                            <span className="category-limit">{formatMoney(item.suggestedLimit)}</span>
                                        </div>
                                        <div className="progress-bar-bg">
                                            <div className="progress-bar-fill" style={{ width: '90%' }}></div>
                                        </div>
                                        <span className="limit-info">Targeting 10% reduction of ML predicted expenditure</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="empty-text">No category predictions available yet. Add transaction records to build historical data for forecasting.</p>
                        )}
                    </div>
                </div>

                <div className="grid-col">
                    <h2>AI Insights & Recommendations</h2>
                    <div className="list-card">
                        {recommendations && recommendations.length > 0 ? (
                            <ul className="rec-list">
                                {recommendations.map((item, index) => (
                                    <li key={`${item}-${index}`} className="rec-item">
                                        <span className="rec-icon">💡</span>
                                        <span className="rec-text">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="empty-text">Add transactions to generate custom budget recommendations.</p>
                        )}
                    </div>

                    {followUps && followUps.length > 0 && (
                        <div className="followups-section">
                            <h4>Suggested Follow-up Questions</h4>
                            <div className="followup-buttons">
                                {followUps.map((q, idx) => (
                                    <button 
                                        key={idx} 
                                        className="followup-btn"
                                        onClick={() => onAskFollowUp?.(q)}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </ContentGrid>
        </Wrapper>
    );
}

const pulse = keyframes`
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(46, 204, 113, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(46, 204, 113, 0); }
`;

const pulseWarning = keyframes`
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(231, 76, 60, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); }
`;

const Wrapper = styled.div`
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    color: #222260;
    max-width: 1200px;
    margin: 0 auto;

    .overview-section {
        display: flex;
        gap: 2rem;
        flex-wrap: wrap;
        width: 100%;
    }
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    border-bottom: 2px dashed rgba(34, 34, 96, 0.15);
    padding-bottom: 1.5rem;

    .title-area {
        h1 {
            font-size: 2.2rem;
            font-weight: 800;
            background: linear-gradient(135deg, #222260 0%, #4a4af0 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .subtitle {
            font-size: 0.95rem;
            color: #666;
            margin-top: 0.2rem;
        }
    }
`;

const StatusBadge = styled.div`
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 1rem;
    border-radius: 50px;
    background: ${props => props.isML ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.12)'};
    border: 1px solid ${props => props.isML ? 'rgba(46, 204, 113, 0.3)' : 'rgba(231, 76, 60, 0.25)'};
    
    .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: ${props => props.isML ? '#2ecc71' : '#e74c3c'};
        animation: ${props => props.isML ? pulse : pulseWarning} 2s infinite ease-in-out;
    }

    .text {
        font-size: 0.85rem;
        font-weight: 700;
        color: ${props => props.isML ? '#27ae60' : '#c0392b'};
    }
`;

const StatusDetail = styled.div`
    margin-top: 0.75rem;
    color: #a94442;
    font-size: 0.85rem;
    line-height: 1.4;
    max-width: 500px;
`;

const Card = styled.div`
    background: #ffffff;
    border: 1px solid rgba(34, 34, 96, 0.08);
    border-radius: 24px;
    padding: 2rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
    transition: transform 0.3s ease, box-shadow 0.3s ease;

    &:hover {
        transform: translateY(-5px);
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.06);
    }

    &.health-card {
        flex: 1;
        min-width: 300px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        
        .score-container {
            margin: 1rem 0;
        }
        
        .circle-bg {
            width: 130px;
            height: 130px;
            border-radius: 50%;
            border: 8px solid ${props => props.scoreColor || '#2ecc71'};
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background: rgba(34, 34, 96, 0.02);
            transition: all 0.4s ease;
        }

        .score-val {
            font-size: 2.8rem;
            font-weight: 850;
            color: #222260;
            line-height: 1;
        }

        .score-label {
            font-size: 0.65rem;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #777;
            margin-top: 2px;
        }

        .health-desc {
            font-size: 0.92rem;
            color: #555;
            line-height: 1.4;
        }

        .risk-pill {
            margin-top: 0.8rem;
            padding: 0.35rem 0.75rem;
            border-radius: 20px;
            text-transform: capitalize;
            font-size: 0.72rem;
            font-weight: 800;
            background: rgba(46, 204, 113, 0.12);
            color: #238a4d;
        }

        .risk-pill.low {
            background: rgba(52, 152, 219, 0.12);
            color: #2471a3;
        }

        .risk-pill.medium {
            background: rgba(241, 196, 15, 0.16);
            color: #9a6b00;
        }

        .risk-pill.high,
        .risk-pill.critical {
            background: rgba(231, 76, 60, 0.12);
            color: #c0392b;
        }
    }

    &.spend-card {
        flex: 1.5;
        min-width: 320px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        background: linear-gradient(135deg, #222260 0%, #3f3f9e 100%);
        color: #ffffff;
        border: none;
        
        h3 {
            color: rgba(255, 255, 255, 0.8);
            font-size: 1.1rem;
        }

        .amount-container {
            margin: 1.5rem 0;
        }

        .amount-val {
            font-size: 3.2rem;
            font-weight: 850;
            color: #ffffff;
            letter-spacing: -1px;
            line-height: 1;
        }

        .spend-desc {
            font-size: 0.95rem;
            color: rgba(255, 255, 255, 0.85);
            line-height: 1.5;
            border-top: 1px solid rgba(255, 255, 255, 0.15);
            padding-top: 1rem;
        }
    }
`;

const ContentGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 2rem;

    h2 {
        font-size: 1.4rem;
        font-weight: 700;
        margin-bottom: 1rem;
        padding-left: 0.5rem;
    }

    .list-card {
        background: #ffffff;
        border-radius: 24px;
        padding: 1.8rem;
        border: 1px solid rgba(34, 34, 96, 0.08);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
        min-height: 250px;
    }

    .category-item {
        list-style: none;
        margin-bottom: 1.2rem;
        
        .category-header {
            display: flex;
            justify-content: space-between;
            font-weight: 700;
            font-size: 1rem;
            margin-bottom: 0.4rem;
        }

        .category-name {
            text-transform: capitalize;
        }

        .category-limit {
            color: #4a4af0;
        }

        .progress-bar-bg {
            height: 8px;
            background: #f1f3f6;
            border-radius: 10px;
            overflow: hidden;
        }

        .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #4a4af0, #00d2ff);
            border-radius: 10px;
        }

        .limit-info {
            font-size: 0.75rem;
            color: #888;
            margin-top: 0.2rem;
            display: block;
        }
    }

    .rec-item {
        list-style: none;
        display: flex;
        gap: 0.8rem;
        margin-bottom: 1rem;
        padding: 0.8rem;
        border-radius: 12px;
        background: #fafbfe;
        border-left: 4px solid #4a4af0;

        .rec-icon {
            font-size: 1.2rem;
        }
        
        .rec-text {
            font-size: 0.92rem;
            line-height: 1.4;
            color: #444;
        }
    }

    .followups-section {
        margin-top: 1.5rem;
        padding: 1rem;
        background: rgba(74, 74, 240, 0.04);
        border-radius: 20px;
        border: 1px dashed rgba(74, 74, 240, 0.2);

        h4 {
            font-size: 0.9rem;
            margin-bottom: 0.8rem;
            font-weight: 700;
        }

        .followup-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 0.6rem;
        }

        .followup-btn {
            background: #ffffff;
            border: 1px solid rgba(74, 74, 240, 0.25);
            padding: 0.5rem 0.9rem;
            border-radius: 30px;
            font-size: 0.8rem;
            cursor: pointer;
            color: #4a4af0;
            font-weight: 600;
            transition: all 0.2s ease;

            &:hover {
                background: #4a4af0;
                color: #ffffff;
                border-color: #4a4af0;
                transform: translateY(-1px);
            }
        }
    }

    .status-detail {
        margin-top: 0.75rem;
        color: #a94442;
        font-size: 0.85rem;
        line-height: 1.4;
        max-width: 500px;
    }

    .empty-text {
        color: #888;
        font-style: italic;
        text-align: center;
        margin-top: 2rem;
    }
`;

const ErrorWrapper = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    height: 80vh;

    .error-card {
        background: #ffffff;
        border: 2px solid #e74c3c;
        border-radius: 24px;
        padding: 2.5rem;
        text-align: center;
        max-width: 450px;
        box-shadow: 0 10px 30px rgba(231, 76, 60, 0.08);

        h2 {
            color: #e74c3c;
            margin-bottom: 1rem;
        }

        p {
            color: #666;
            margin-bottom: 1.5rem;
            line-height: 1.5;
        }

        button {
            background: #e74c3c;
            color: white;
            border: none;
            padding: 0.8rem 1.8rem;
            border-radius: 30px;
            font-weight: 700;
            cursor: pointer;
            transition: transform 0.2s;

            &:hover {
                transform: scale(1.05);
            }
        }
    }
`;

const spin = keyframes`
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
`;

const LoadingWrapper = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 70vh;
    gap: 1.5rem;
    color: #666;

    .loader {
        border: 4px solid #f1f3f6;
        border-top: 4px solid #4a4af0;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: ${spin} 1.2s linear infinite;
    }
`;

export default BudgetCopilot;
