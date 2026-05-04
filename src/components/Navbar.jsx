import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { currentUser } = useAuth();
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    if (!currentUser) return;

    const sectionIds = ['home', 'diet', 'workout', 'weight', 'recipes', 'foods', 'profile'];
    const visibilityMap = {};

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibilityMap[entry.target.id] = entry.intersectionRatio;
        });

        // Pick the section with the highest visibility ratio
        let best = 'home';
        let bestRatio = 0;
        for (const id of sectionIds) {
          if ((visibilityMap[id] || 0) > bestRatio) {
            bestRatio = visibilityMap[id];
            best = id;
          }
        }
        setActiveSection(best);
      },
      {
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [currentUser]);

  const scrollTo = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="nav-wrapper">
      <nav className="pill-nav">
        {currentUser && (
          <div className="nav-links-center">
            <a href="#home" onClick={(e) => { e.preventDefault(); scrollTo('home'); }} className={`nav-link ${activeSection === 'home' ? 'active' : ''}`}>Home</a>
            <a href="#diet" onClick={(e) => { e.preventDefault(); scrollTo('diet'); }} className={`nav-link ${activeSection === 'diet' ? 'active' : ''}`}>Diet</a>
            <a href="#workout" onClick={(e) => { e.preventDefault(); scrollTo('workout'); }} className={`nav-link ${activeSection === 'workout' ? 'active' : ''}`}>Workout</a>
            <a href="#weight" onClick={(e) => { e.preventDefault(); scrollTo('weight'); }} className={`nav-link ${activeSection === 'weight' ? 'active' : ''}`}>Weight</a>
            <a href="#recipes" onClick={(e) => { e.preventDefault(); scrollTo('recipes'); }} className={`nav-link ${activeSection === 'recipes' ? 'active' : ''}`}>Recipes</a>
            <a href="#foods" onClick={(e) => { e.preventDefault(); scrollTo('foods'); }} className={`nav-link ${activeSection === 'foods' ? 'active' : ''}`}>Foods</a>
            <a href="#profile" onClick={(e) => { e.preventDefault(); scrollTo('profile'); }} className={`nav-link ${activeSection === 'profile' ? 'active' : ''}`}>Profile</a>
          </div>
        )}
      </nav>
    </div>
  );
}
