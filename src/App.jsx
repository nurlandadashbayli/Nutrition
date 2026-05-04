import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './components/Login';
import HeroDashboard from './components/HeroDashboard';
import FoodManagement from './pages/FoodManagement';
import IntakeLog from './pages/IntakeLog';
import WeightManagement from './pages/WeightManagement';
import Profile from './pages/Profile';
import Recipes from './pages/Recipes';
import Workout from './pages/Workout';
import { useAuth } from './contexts/AuthContext';

function PrivateRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
}

function Dashboard() {
  return (
    <div className="continuous-page">
      <section id="home" className="page-section hero-section">
        <HeroDashboard />
      </section>
      <section id="diet" className="page-section">
        <IntakeLog />
      </section>
      <section id="workout" className="page-section">
        <Workout />
      </section>
      <section id="weight" className="page-section">
        <WeightManagement />
      </section>
      <section id="recipes" className="page-section">
        <Recipes />
      </section>
      <section id="foods" className="page-section">
        <FoodManagement />
      </section>
      <section id="profile" className="page-section">
        <Profile />
      </section>
    </div>
  );
}

function App() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />
          {/* Redirect old routes to / */}
          <Route path="/workout" element={<Navigate to="/#workout" replace />} />
          <Route path="/weight" element={<Navigate to="/#weight" replace />} />
          <Route path="/recipes" element={<Navigate to="/#recipes" replace />} />
          <Route path="/foods" element={<Navigate to="/#foods" replace />} />
          <Route path="/profile" element={<Navigate to="/#profile" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
