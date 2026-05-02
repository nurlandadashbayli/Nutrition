import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './components/Login';
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
                <IntakeLog />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/foods" 
            element={
              <PrivateRoute>
                <FoodManagement />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/recipes" 
            element={
              <PrivateRoute>
                <Recipes />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/workout" 
            element={
              <PrivateRoute>
                <Workout />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/weight" 
            element={
              <PrivateRoute>
                <WeightManagement />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            } 
          />
        </Routes>
      </main>
    </>
  );
}

export default App;
