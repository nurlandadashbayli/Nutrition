import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  }

  return (
    <nav className="nav">
      <div className="nav-brand">
        <h2><Link to="/">NutriTrack</Link></h2>
      </div>
      <div className="nav-links">
        {currentUser && (
          <>
            <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>Intake Log</Link>
            <Link to="/recipes" className={`nav-link ${location.pathname === '/recipes' ? 'active' : ''}`}>Recipes</Link>
            <Link to="/foods" className={`nav-link ${location.pathname === '/foods' ? 'active' : ''}`}>Foods</Link>
            <Link to="/weight" className={`nav-link ${location.pathname === '/weight' ? 'active' : ''}`}>Weight</Link>
            <Link to="/profile" className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}>Profile</Link>
            <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '0.4rem 1rem', width: 'auto' }}>Log Out</button>
          </>
        )}
        <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </nav>
  );
}
