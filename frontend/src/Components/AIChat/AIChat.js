import React, { useState, useRef, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useGlobalContext } from '../../context/globalContext';

function AIChat({ queuedQuestion }) {
    const [question, setQuestion] = useState('');
    const [isPending, setIsPending] = useState(false);
    const { chatMessages, askAiChat } = useGlobalContext();
    const chatEndRef = useRef(null);
    const processedQueuedQuestionRef = useRef(null);

    // Auto scroll to bottom on new messages
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isPending]);

    useEffect(() => {
        if (!queuedQuestion?.question || isPending) return;
        if (processedQueuedQuestionRef.current === queuedQuestion.queuedAt) return;

        processedQueuedQuestionRef.current = queuedQuestion.queuedAt;
        setIsPending(true);
        askAiChat(queuedQuestion.question).finally(() => setIsPending(false));
    }, [queuedQuestion, askAiChat, isPending]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!question.trim() || isPending) return;
        
        setIsPending(true);
        const query = question.trim();
        setQuestion('');
        await askAiChat(query);
        setIsPending(false);
    };

    const handleSuggestionClick = async (suggestion) => {
        if (isPending) return;
        setIsPending(true);
        await askAiChat(suggestion);
        setIsPending(false);
    };

    // Helper to format text with basic markdown **bold** support
    const formatMessageContent = (content) => {
        if (!content) return '';
        const parts = content.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, idx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={idx}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    // Get the follow-up suggestions from the last assistant message
    const getLastFollowUps = () => {
        const lastMsg = [...chatMessages].reverse().find(msg => msg.role === 'assistant');
        return lastMsg?.followUps || [
            'How can I save more money?',
            'Give me a weekly spending budget',
            'Where am I spending too much?',
            'Help me split my salary'
        ];
    };

    return (
        <Wrapper>
            <ChatHeader>
                <div>
                    <h1>AI Finance Copilot Chat</h1>
                    <p className="subtitle">Ask questions about your budget, savings goals, or spending distribution</p>
                </div>
                <EngineStatus>
                    <span className="pulse-dot"></span>
                    <span className="engine-text">Local Intent Classifier Active</span>
                </EngineStatus>
            </ChatHeader>

            <div className="chat-box">
                {chatMessages.length === 0 ? (
                    <WelcomePanel>
                        <div className="icon">💬</div>
                        <h3>Welcome to your Financial Assistant!</h3>
                        <p>I analyze your inquiries locally using an ML intent classification pipeline to deliver custom budget advice.</p>
                        <div className="start-suggestions">
                            {['How can I save more money?', 'Show me a weekly budget plan', 'Where can I cut expenses?'].map((q, idx) => (
                                <button key={idx} onClick={() => handleSuggestionClick(q)}>
                                    {q}
                                </button>
                            ))}
                        </div>
                    </WelcomePanel>
                ) : (
                    chatMessages.map((msg, idx) => (
                        <div key={idx} className={`msg-row ${msg.role === 'user' ? 'row-user' : 'row-ai'}`}>
                            <div className="bubble">
                                <div className="bubble-header">
                                    <span className="sender">{msg.role === 'user' ? 'You' : 'Finance Copilot'}</span>
                                    {msg.role === 'assistant' && (
                                        <Badge isML={msg.isML}>
                                            {msg.isML ? 'Local ML Model' : 'Rule Logic'}
                                        </Badge>
                                    )}
                                </div>
                                <div className="content">{formatMessageContent(msg.content)}</div>
                            </div>
                        </div>
                    ))
                )}

                {isPending && (
                    <div className="msg-row row-ai">
                        <div className="bubble loading-bubble">
                            <div className="typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                            <span className="loading-text">Analyzing query intent...</span>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {chatMessages.length > 0 && !isPending && (
                <SuggestionsBar>
                    {getLastFollowUps().slice(0, 3).map((suggestion, idx) => (
                        <button key={idx} className="suggestion-pill" onClick={() => handleSuggestionClick(suggestion)}>
                            💡 {suggestion}
                        </button>
                    ))}
                </SuggestionsBar>
            )}

            <form onSubmit={handleSubmit} className="input-form">
                <input 
                    value={question} 
                    onChange={(e) => setQuestion(e.target.value)} 
                    placeholder="Ask about your financial health, budget rules, or saving models..." 
                    disabled={isPending}
                />
                <button type="submit" disabled={isPending || !question.trim()}>
                    {isPending ? 'Sending...' : 'Send Query'}
                </button>
            </form>
        </Wrapper>
    );
}

const pulse = keyframes`
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 74, 240, 0.4); }
    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(74, 74, 240, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 74, 240, 0); }
`;

const bounce = keyframes`
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
`;

const Wrapper = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 80vh;
    padding: 1.8rem;
    gap: 1.2rem;
    color: #222260;

    .chat-box {
        flex: 1;
        min-height: 380px;
        overflow-y: auto;
        padding: 1.5rem;
        background: #ffffff;
        border-radius: 24px;
        border: 1px solid rgba(34, 34, 96, 0.08);
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.02);
        display: flex;
        flex-direction: column;
        gap: 1rem;

        &::-webkit-scrollbar {
            width: 6px;
        }
        &::-webkit-scrollbar-thumb {
            background-color: rgba(34, 34, 96, 0.1);
            border-radius: 10px;
        }
    }

    .msg-row {
        display: flex;
        width: 100%;
    }

    .row-user {
        justify-content: flex-end;
        .bubble {
            background: linear-gradient(135deg, #222260 0%, #3f3f9e 100%);
            color: #ffffff;
            border-radius: 20px 20px 4px 20px;
            box-shadow: 0 4px 15px rgba(34, 34, 96, 0.1);
            .sender {
                color: rgba(255, 255, 255, 0.85);
            }
        }
    }

    .row-ai {
        justify-content: flex-start;
        .bubble {
            background: #f8fafc;
            color: #222260;
            border-radius: 20px 20px 20px 4px;
            border: 1px solid rgba(34, 34, 96, 0.05);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.01);
            .sender {
                color: #4a4af0;
            }
        }
    }

    .bubble {
        max-width: 75%;
        padding: 1rem 1.2rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;

        .bubble-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1.5rem;
            font-size: 0.75rem;
            font-weight: 700;
        }

        .content {
            font-size: 0.95rem;
            line-height: 1.5;
            white-space: pre-wrap;
        }
    }

    .loading-bubble {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.8rem;
        background: #f8fafc;
        border-radius: 20px;
        padding: 0.8rem 1.2rem;
        border: 1px dashed rgba(74, 74, 240, 0.2);

        .loading-text {
            font-size: 0.82rem;
            color: #666;
            font-style: italic;
        }
    }

    .typing-indicator {
        display: flex;
        gap: 0.25rem;

        span {
            width: 7px;
            height: 7px;
            background: #4a4af0;
            border-radius: 50%;
            animation: ${bounce} 1s infinite ease-in-out;

            &:nth-child(2) {
                animation-delay: 0.2s;
            }
            &:nth-child(3) {
                animation-delay: 0.4s;
            }
        }
    }

    .input-form {
        display: flex;
        gap: 0.8rem;

        input {
            flex: 1;
            padding: 1rem 1.2rem;
            border-radius: 16px;
            border: 1px solid rgba(34, 34, 96, 0.15);
            background: #ffffff;
            color: #222260;
            font-size: 0.95rem;
            outline: none;
            transition: border-color 0.2s;

            &:focus {
                border-color: #4a4af0;
                box-shadow: 0 0 0 3px rgba(74, 74, 240, 0.08);
            }

            &:disabled {
                background: #f1f3f6;
                cursor: not-allowed;
            }
        }

        button {
            padding: 1rem 1.8rem;
            border: none;
            border-radius: 16px;
            background: linear-gradient(135deg, #222260 0%, #4a4af0 100%);
            color: white;
            font-weight: 700;
            cursor: pointer;
            transition: opacity 0.2s, transform 0.1s;

            &:hover:not(:disabled) {
                opacity: 0.95;
            }

            &:active:not(:disabled) {
                transform: scale(0.98);
            }

            &:disabled {
                background: #ccc;
                cursor: not-allowed;
            }
        }
    }
`;

const ChatHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px dashed rgba(34, 34, 96, 0.15);
    padding-bottom: 1.2rem;
    flex-wrap: wrap;
    gap: 1rem;

    h1 {
        font-size: 1.8rem;
        font-weight: 800;
        background: linear-gradient(135deg, #222260 0%, #4a4af0 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .subtitle {
        font-size: 0.88rem;
        color: #666;
        margin-top: 0.1rem;
    }
`;

const EngineStatus = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.9rem;
    background: rgba(74, 74, 240, 0.06);
    border-radius: 20px;
    border: 1px solid rgba(74, 74, 240, 0.15);

    .pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4a4af0;
        animation: ${pulse} 2s infinite ease-in-out;
    }

    .engine-text {
        font-size: 0.8rem;
        font-weight: 700;
        color: #4a4af0;
    }
`;

const Badge = styled.span`
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 700;
    background: ${props => props.isML ? 'rgba(46, 204, 113, 0.15)' : 'rgba(34, 34, 96, 0.08)'};
    color: ${props => props.isML ? '#27ae60' : '#222260'};
`;

const SuggestionsBar = styled.div`
    display: flex;
    gap: 0.6rem;
    overflow-x: auto;
    padding: 0.2rem 0;
    margin-top: -0.2rem;

    .suggestion-pill {
        background: #ffffff;
        border: 1px solid rgba(34, 34, 96, 0.12);
        padding: 0.5rem 0.9rem;
        border-radius: 20px;
        font-size: 0.8rem;
        cursor: pointer;
        color: #222260;
        white-space: nowrap;
        transition: all 0.2s;

        &:hover {
            border-color: #4a4af0;
            background: rgba(74, 74, 240, 0.02);
            color: #4a4af0;
        }
    }
`;

const WelcomePanel = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: auto;
    max-width: 480px;
    text-align: center;
    padding: 2rem;

    .icon {
        font-size: 3rem;
        margin-bottom: 1rem;
    }

    h3 {
        font-size: 1.2rem;
        margin-bottom: 0.6rem;
        font-weight: 700;
    }

    p {
        font-size: 0.9rem;
        color: #666;
        line-height: 1.5;
        margin-bottom: 1.5rem;
    }

    .start-suggestions {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        width: 100%;

        button {
            background: #f8fafc;
            border: 1px solid rgba(34, 34, 96, 0.08);
            padding: 0.7rem 1.2rem;
            border-radius: 12px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            color: #222260;
            transition: all 0.2s;

            &:hover {
                background: #4a4af0;
                color: white;
                border-color: #4a4af0;
            }
        }
    }
`;

export default AIChat;
