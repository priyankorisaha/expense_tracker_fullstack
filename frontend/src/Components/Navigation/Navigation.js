import React from 'react'
import styled from 'styled-components'
import image1 from '../../img/image1.png'
import { signout } from '../../utils/Icons'
import { menuItems } from '../../utils/menuItems'
import { useGlobalContext } from '../../context/globalContext'

function Navigation({active, setActive}) {
    const { logout, user } = useGlobalContext()

    return (
        <NavStyled>
            <div className="user-con">
                <img src={image1} alt="" />
                <div className="text">
                    <h2>{user?.name || 'PROFILE'}</h2>
                    <p>{user?.email || 'Your Money'}</p>
                </div>
            </div>
            <ul className="menu-items">
                {menuItems.map((item) => {
                    return <li
                        key={item.id}
                        onClick={() => setActive(item.id)}
                        className={active === item.id ? 'active': ''}
                    >
                        {item.icon}
                        <span>{item.title}</span>
                    </li>
                })}
            </ul>
            <div className="bottom-nav">
                <li onClick={logout}>
                    {signout} Sign Out
                </li>
            </div>
        </NavStyled>
    )
}

const NavStyled = styled.nav`
    padding: 2rem 1.5rem;
    width: 374px;
    height: 100%;
    background: rgba(252, 246, 249, 0.78);
    border: 3px solid #FFFFFF;
    backdrop-filter: blur(4.5px);
    border-radius: 32px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 2rem;
    .user-con{
        height: 100px;
        display: flex;
        align-items: center;
        gap: 1rem;
        img{
            width: 80px;
            height: 80px;
            border-radius: 50%;
            object-fit: cover;
            background: #fcf6f9;
            border: 2px solid #FFFFFF;
            padding: .2rem;
            box-shadow: 0px 1px 17px rgba(0, 0, 0, 0.06);
        }
        h2{
            color: rgba(34, 34, 96, 1);
        }
        p{
            color: rgba(34, 34, 96, .6);
        }
    }

    .menu-items{
        flex: 1;
        display: flex;
        flex-direction: column;
        li{
            display: grid;
            grid-template-columns: 40px auto;
            align-items: center;
            margin: .6rem 0;
            font-weight: 500;
            cursor: pointer;
            transition: all .4s ease-in-out;
            color: rgba(34, 34, 96, .6);
            padding-left: 1rem;
            position: relative;
            i{
                color: rgba(34, 34, 96, 0.6);
                font-size: 1.4rem;
                transition: all .4s ease-in-out;
            }

            &:hover {
                background: rgba(34, 34, 96, 0.08);
                color: rgba(34, 34, 96, 0.9);
                transform: translateX(5px);

                i {
                    color: rgba(34, 34, 96, 0.9);
                    transform: scale(1.1);
                }
            }
        }
    }

    .bottom-nav {
        li {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: rgba(34, 34, 96, 0.6);
            padding: 0.8rem 1rem;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;

            &:hover {
                background: rgba(231, 76, 60, 0.1);
                color: #e74c3c;
                transform: translateX(5px);

                svg, i {
                    color: #e74c3c;
                    transform: scale(1.15);
                }
            }

            svg, i {
                transition: all 0.3s ease;
            }
        }
    }
`;

export default Navigation