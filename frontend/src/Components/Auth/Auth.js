import React, { useState } from 'react';
import styled from 'styled-components';
import { useGlobalContext } from '../../context/globalContext';

function Auth() {
    const { login, register, error } = useGlobalContext();
    const [isLogin, setIsLogin] = useState(true);
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        currency: 'USD',
        timezone: 'UTC',
    });

    const onSubmit = async (e) => {
        e.preventDefault();
        if (isLogin) {
            await login({ email: form.email, password: form.password });
        } else {
            await register(form);
        }
    };

    return (
        <AuthStyled>
            <h1>{isLogin ? 'Login' : 'Create Account'}</h1>
            <form onSubmit={onSubmit}>
                {!isLogin && (
                    <input
                        type="text"
                        placeholder="Name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                    />
                )}
                <input
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                />
                {!isLogin && (
                    <div className="row">
                        <input
                            type="text"
                            placeholder="Currency code (USD/INR)"
                            value={form.currency}
                            onChange={(e) => setForm({ ...form, currency: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="Timezone (UTC or Asia/Kolkata)"
                            value={form.timezone}
                            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                        />
                    </div>
                )}
                {!isLogin && <small>Examples: currency = USD or INR, timezone = UTC or Asia/Kolkata.</small>}
                <button type="submit">{isLogin ? 'Login' : 'Register'}</button>
                <p>{error}</p>
            </form>

            <button className="switch" onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
            </button>
        </AuthStyled>
    );
}

const AuthStyled = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 600px;
    margin: 4rem auto;
    padding: 2rem;
    background: #fcf6f9;
    border-radius: 1rem;

    form {
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
    }

    input {
        padding: 0.8rem;
        border-radius: 0.5rem;
        border: 1px solid #ccc;
        transition: all 0.3s ease;
        font-size: 1rem;

        &:hover {
            border-color: #222260;
            box-shadow: 0 0 8px rgba(34, 34, 96, 0.2);
            transform: translateY(-2px);
        }

        &:focus {
            outline: none;
            border-color: #222260;
            box-shadow: 0 0 12px rgba(34, 34, 96, 0.3);
        }
    }

    .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.8rem;

        @media (max-width: 768px) {
            grid-template-columns: 1fr;
        }
    }

    button {
        padding: 0.8rem;
        border: none;
        border-radius: 0.5rem;
        background: #222260;
        color: white;
        cursor: pointer;
        transition: all 0.3s ease;
        font-weight: 600;
        font-size: 1rem;

        &:hover {
            background: #16213e;
            transform: translateY(-3px);
            box-shadow: 0 8px 20px rgba(34, 34, 96, 0.3);
        }

        &:active {
            transform: translateY(-1px);
        }
    }

    .switch {
        background: transparent;
        color: #222260;
        text-decoration: underline;
        padding: 0.5rem;

        &:hover {
            background: rgba(34, 34, 96, 0.05);
            color: #16213e;
            transform: none;
            box-shadow: none;
        }
    }

    p {
        color: #d63031;
        min-height: 1.2rem;
    }

    small {
        color: #555;
    }
`;

export default Auth;