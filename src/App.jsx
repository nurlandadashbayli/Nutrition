import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './components/Login';
import FoodManagement from './pages/FoodManagement';
import IntakeLog from './pages/IntakeLog';
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
        </Routes>
      </main>
    </>
  );
}

export default App;
