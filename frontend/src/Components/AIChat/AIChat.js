import React, { useState } from 'react';
import styled from 'styled-components';
import { useGlobalContext } from '../../context/globalContext';

function AIChat() {
    const [question, setQuestion] = useState('');
    const { chatMessages, askAiChat } = useGlobalContext();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!question.trim()) return;
        await askAiChat(question.trim());
        setQuestion('');
    };

    return (
        <Wrapper>
            <h1>AI Finance Chat</h1>
            <div className="chat-box">
                {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`msg ${msg.role}`}>
                        <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong> {msg.content}
                    </div>
                ))}
            </div>
            <form onSubmit={handleSubmit}>
                <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about your spending..." />
                <button type="submit">Ask</button>
            </form>
        </Wrapper>
    );
}

const Wrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1rem;

    .chat-box {
        min-height: 300px;
        max-height: 420px;
        overflow: auto;
        padding: 1rem;
        background: #fcf6f9;
        border-radius: 1rem;
        border: 1px solid #ddd;
    }

    .msg {
        margin-bottom: 0.8rem;
    }

    .assistant {
        color: #222260;
    }

    .user {
        color: #2d3436;
    }

    form {
        display: flex;
        gap: 0.5rem;
    }

    input {
        flex: 1;
        padding: 0.8rem;
        border-radius: 0.5rem;
        border: 1px solid #ccc;
    }

    button {
        padding: 0.8rem 1.2rem;
        border: none;
        border-radius: 0.5rem;
        background: #222260;
        color: white;
        cursor: pointer;
    }
`;

export default AIChat;
