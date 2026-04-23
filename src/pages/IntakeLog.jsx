import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function IntakeLog() {
  const [foods, setFoods] = useState([]);
  const [logs, setLogs] = useState([]);
  const [weeklyLogs, setWeeklyLogs] = useState([]);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [servings, setServings] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      fetchFoods();
      fetchWeeklyLogs();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && date) {
      fetchLogs();
    }
  }, [currentUser, date]);

  async function fetchFoods() {
    try {
      const q = query(collection(db, 'foods'), where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      const foodList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFoods(foodList);
      if (foodList.length > 0) {
        setSelectedFoodId(foodList[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchLogs() {
    try {
      const q = query(collection(db, 'logs'), 
        where('userId', '==', currentUser.uid),
        where('date', '==', date)
      );
      const querySnapshot = await getDocs(q);
      const logList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      logList.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setLogs(logList);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch logs.');
    }
  }

  async function fetchWeeklyLogs() {
    try {
      // Get dates for the last 7 days
      const dates = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }

      const earliestDate = dates[dates.length - 1];
      
      // Querying only by userId to avoid composite index requirement for date range
      // We can filter the dates in memory
      const q = query(
        collection(db, 'logs'),
        where('userId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const allUserLogs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter for logs within the last 7 days
      const filteredLogs = allUserLogs.filter(log => log.date >= earliestDate);
      
      setWeeklyLogs(filteredLogs);
    } catch (err) {
      console.error('Failed to fetch weekly logs:', err);
    }
  }

  async function handleAddLog(e) {
    e.preventDefault();
    if (!selectedFoodId || servings <= 0) return;

    const food = foods.find(f => f.id === selectedFoodId);
    if (!food) return;

    const totalCalories = Number((food.calories * servings).toFixed(1));
    const totalProtein = Number((food.protein * servings).toFixed(1));
    const totalFat = Number(((food.fat || 0) * servings).toFixed(1));

    try {
      setError('');
      setLoading(true);
      await addDoc(collection(db, 'logs'), {
        userId: currentUser.uid,
        date,
        foodId: food.id,
        foodName: food.name,
        servingSize: food.servingSize,
        servings: Number(servings),
        totalCalories,
        totalProtein,
        totalFat,
        createdAt: new Date().toISOString()
      });
      setServings(1);
      fetchLogs();
      fetchWeeklyLogs();
    } catch (err) {
      setError('Failed to add log.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteLog(id) {
    try {
      await deleteDoc(doc(db, 'logs', id));
      fetchLogs();
      fetchWeeklyLogs();
    } catch (err) {
      console.error('Failed to delete log', err);
    }
  }

  const dailyCalories = logs.reduce((sum, log) => sum + log.totalCalories, 0);
  const dailyProtein = logs.reduce((sum, log) => sum + log.totalProtein, 0);
  const dailyFat = logs.reduce((sum, log) => sum + (log.totalFat || 0), 0);

  // Calculate weekly data
  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        calories: 0
      });
    }
    return days;
  };

  const weeklyData = getLast7Days().map(day => {
    const dayCalories = weeklyLogs
      .filter(log => log.date === day.date)
      .reduce((sum, log) => sum + log.totalCalories, 0);
    return { ...day, calories: dayCalories };
  });

  const maxCalories = Math.max(...weeklyData.map(d => d.calories), 2000);

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>Intake Log</h2>
          <div>
            <input 
              type="date" 
              className="form-control" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
            />
          </div>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleAddLog} className="food-picker">
          <div>
            <label className="form-label">Food</label>
            <select 
              className="form-control" 
              value={selectedFoodId} 
              onChange={e => setSelectedFoodId(e.target.value)}
              disabled={foods.length === 0}
            >
              {foods.length === 0 && <option value="">No foods available</option>}
              {foods.map(food => (
                <option key={food.id} value={food.id}>
                  {food.name} ({food.calories} kcal / {food.servingSize})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Servings</label>
            <input 
              type="number" 
              className="form-control" 
              value={servings} 
              onChange={e => setServings(e.target.value)} 
              min="0.1" 
              step="0.1" 
              required 
              disabled={foods.length === 0}
            />
          </div>
          <div className="action">
            <button disabled={loading || foods.length === 0} type="submit" className="btn btn-primary" style={{ height: '48px' }}>
              Add
            </button>
          </div>
        </form>
      </div>

      <div className="summary-card">
        <div className="summary-item">
          <div className="summary-value">{dailyCalories.toFixed(1)}</div>
          <div className="summary-label">Total Calories (kcal)</div>
        </div>
        <div className="summary-item">
          <div className="summary-value">{dailyProtein.toFixed(1)}</div>
          <div className="summary-label">Total Protein (g)</div>
        </div>
        <div className="summary-item">
          <div className="summary-value">{dailyFat.toFixed(1)}</div>
          <div className="summary-label">Total Fat (g)</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h3>Logs for {date}</h3>
        {logs.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No intake logged for this date.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Food</th>
                <th>Servings</th>
                <th>Calories</th>
                <th>Protein</th>
                <th>Fat</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>
                    {log.foodName}
                    <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{log.servingSize} per serving</div>
                  </td>
                  <td>{log.servings}</td>
                  <td>{log.totalCalories}</td>
                  <td>{log.totalProtein}g</td>
                  <td>{log.totalFat !== undefined ? log.totalFat : '-'}g</td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      onClick={() => handleDeleteLog(log.id)}
                      className="btn btn-outline" 
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', width: 'auto', borderColor: 'var(--error-color)', color: 'var(--error-color)' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h3>Weekly Calorie Intake</h3>
        <div className="chart-container">
          {weeklyData.map((day, idx) => (
            <div key={day.date} className="chart-column">
              <div className="chart-bar-wrapper">
                <div 
                  className="chart-bar" 
                  style={{ height: `${(day.calories / maxCalories) * 100}%` }}
                >
                  <div className="chart-value">{day.calories.toFixed(0)}</div>
                  <div className="chart-tooltip">{day.calories.toFixed(0)} kcal</div>
                </div>
              </div>
              <div className="chart-label">{day.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
