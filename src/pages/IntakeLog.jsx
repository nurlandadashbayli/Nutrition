import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function IntakeLog() {
  const [foods, setFoods] = useState([]);
  const [logs, setLogs] = useState([]);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [servings, setServings] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      fetchFoods();
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
      setLogs(logList);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch logs.');
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
    } catch (err) {
      console.error('Failed to delete log', err);
    }
  }

  const dailyCalories = logs.reduce((sum, log) => sum + log.totalCalories, 0);
  const dailyProtein = logs.reduce((sum, log) => sum + log.totalProtein, 0);
  const dailyFat = logs.reduce((sum, log) => sum + (log.totalFat || 0), 0);

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
    </div>
  );
}
