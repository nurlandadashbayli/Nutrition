import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { currentUser } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <nav className="nav">
      <div className="nav-brand">
        <h2><Link to="/">NutriTrack</Link></h2>
      </div>
      <div className="nav-links">
        {currentUser && (
          <>
            <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>Diet Log</Link>
            <Link to="/workout" className={`nav-link ${location.pathname === '/workout' ? 'active' : ''}`}>Workout</Link>
            <Link to="/weight" className={`nav-link ${location.pathname === '/weight' ? 'active' : ''}`}>Weight</Link>
            <Link to="/recipes" className={`nav-link ${location.pathname === '/recipes' ? 'active' : ''}`}>Recipes</Link>
            <Link to="/foods" className={`nav-link ${location.pathname === '/foods' ? 'active' : ''}`}>Foods</Link>
            <Link to="/profile" className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}>Profile</Link>
          </>
        )}
        <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </nav>
  );
}
