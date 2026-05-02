import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

const getLocalDateString = (d = new Date()) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function IntakeLog() {
  const [foods, setFoods] = useState([]);
  const [logs, setLogs] = useState([]);
  const [weeklyLogs, setWeeklyLogs] = useState([]);
  
  const [date, setDate] = useState(getLocalDateString());
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [weight, setWeight] = useState('');
  const [weightId, setWeightId] = useState(null);
  const [savingWeight, setSavingWeight] = useState(false);
  
  const [weeklyWeights, setWeeklyWeights] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  
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
      fetchWeight();
    }
  }, [currentUser, date]);

  async function fetchFoods() {
    try {
      const q = query(collection(db, 'foods'), where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      const foodList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      foodList.sort((a, b) => a.name.localeCompare(b.name));
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
      logList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setLogs(logList);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch logs.');
    }
  }

  async function fetchWeight() {
    try {
      setWeight('');
      setWeightId(null);
      const q = query(collection(db, 'weights'), 
        where('userId', '==', currentUser.uid),
        where('date', '==', date)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const weightDoc = querySnapshot.docs[0];
        setWeight(weightDoc.data().weight);
        setWeightId(weightDoc.id);
      }
    } catch (err) {
      console.error('Failed to fetch weight:', err);
    }
  }

  async function handleSaveWeight() {
    if (!weight || weight <= 0) return;
    try {
      setSavingWeight(true);
      const weightData = {
        userId: currentUser.uid,
        date,
        weight: Number(weight),
        updatedAt: new Date().toISOString()
      };

      if (weightId) {
        await updateDoc(doc(db, 'weights', weightId), weightData);
      } else {
        await addDoc(collection(db, 'weights'), {
          ...weightData,
          createdAt: new Date().toISOString()
        });
        fetchWeight(); // Refresh to get the new ID
      }
      fetchWeeklyLogs();
    } catch (err) {
      console.error('Failed to save weight:', err);
    } finally {
      setSavingWeight(false);
    }
  }

  async function fetchWeeklyLogs() {
    try {
      // Get dates for the last 7 days
      const dates = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(getLocalDateString(d));
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

      // Fetch weights for the same period
      const weightsQ = query(
        collection(db, 'weights'),
        where('userId', '==', currentUser.uid)
      );
      const weightsSnapshot = await getDocs(weightsQ);
      const allWeights = weightsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filteredWeights = allWeights.filter(w => w.date >= earliestDate);
      setWeeklyWeights(filteredWeights);

      // Fetch Profile
      const profRef = doc(db, 'profiles', currentUser.uid);
      const profSnap = await getDoc(profRef);
      if (profSnap.exists()) {
        setUserProfile(profSnap.data());
      }
    } catch (err) {
      console.error('Failed to fetch weekly logs:', err);
    }
  }

  async function handleAddLog(e) {
    e.preventDefault();
    if (!selectedFoodId || weightInput <= 0) return;

    const food = foods.find(f => f.id === selectedFoodId);
    if (!food) return;

    const baseWeight = parseFloat(food.servingSize) || 100;
    const ratio = Number(weightInput) / baseWeight;

    const totalCalories = Number((food.calories * ratio).toFixed(1));
    const totalProtein = Number((food.protein * ratio).toFixed(1));
    const totalCarbs = Number(((food.carbs || 0) * ratio).toFixed(1));
    const totalFat = Number(((food.fat || 0) * ratio).toFixed(1));

    try {
      setError('');
      setLoading(true);
      await addDoc(collection(db, 'logs'), {
        userId: currentUser.uid,
        date,
        foodId: food.id,
        foodName: food.name,
        servingSize: food.servingSize,
        weight: Number(weightInput),
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat,
        createdAt: new Date().toISOString()
      });
      setWeightInput('');
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

  const changeDate = (offset) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(getLocalDateString(d));
  };

  const dailyCalories = logs.reduce((sum, log) => sum + log.totalCalories, 0);
  const dailyProtein = logs.reduce((sum, log) => sum + log.totalProtein, 0);
  const dailyCarbs = logs.reduce((sum, log) => sum + (log.totalCarbs || 0), 0);
  const dailyFat = logs.reduce((sum, log) => sum + (log.totalFat || 0), 0);

  // Calculate weekly data
  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        date: getLocalDateString(d),
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dateLabel: `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`,
        calories: 0
      });
    }
    return days;
  };

  const calculateTDEE = (w) => {
    if (!userProfile || !w) return null;
    const birthDate = new Date(userProfile.birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) {
      age--;
    }
    const h = Number(userProfile.height);
    let bmr;
    if (userProfile.gender === 'male') {
      bmr = 10 * w + 6.25 * h - 5 * age + 5;
    } else {
      bmr = 10 * w + 6.25 * h - 5 * age - 161;
    }
    return Math.round(bmr * Number(userProfile.activityLevel));
  };

  const weeklyData = getLast7Days().map(day => {
    const dayLogs = weeklyLogs.filter(log => log.date === day.date);
    const dayCalories = dayLogs.reduce((sum, log) => sum + log.totalCalories, 0);
    const dayProtein = dayLogs.reduce((sum, log) => sum + log.totalProtein, 0);
    
    const dayWeight = weeklyWeights.find(w => w.date === day.date)?.weight || 0;
    const targetProtein = dayWeight ? Number((dayWeight * 2.2).toFixed(1)) : 0;
    
    const maintenance = calculateTDEE(dayWeight) || 2480;
    const weeklyGoal = userProfile?.weeklyLossGoal ?? 0.5;
    const loss = maintenance - (weeklyGoal * 1100);
    
    return { ...day, calories: dayCalories, protein: dayProtein, targetProtein, maintenance, loss, hasWeight: !!dayWeight };
  });

  const selectedDayWeight = weight || 0;
  const selectedDayTarget = selectedDayWeight ? Number((selectedDayWeight * 2.2).toFixed(1)) : 0;

  const maxCalories = Math.max(...weeklyData.map(d => Math.max(d.calories, d.maintenance)), 2000);
  const maxProtein = Math.max(...weeklyData.map(d => Math.max(d.protein, d.targetProtein, selectedDayTarget)), 100);

  return (
    <div>
      <div className="card">
        <div className="header-flex">
          <h2 style={{ margin: 0 }}>Intake Log</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button 
              onClick={() => changeDate(-1)} 
              className="btn btn-outline" 
              style={{ width: '40px', height: '40px', padding: 0 }}
              title="Previous Day"
            >
              ←
            </button>
            <input 
              type="date" 
              className="form-control" 
              style={{ width: 'auto' }}
              value={date} 
              onChange={e => setDate(e.target.value)} 
            />
            <button 
              onClick={() => changeDate(1)} 
              className="btn btn-outline" 
              style={{ width: '40px', height: '40px', padding: 0 }}
              title="Next Day"
            >
              →
            </button>
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
            <label className="form-label">Weight (g/ml)</label>
            <input 
              type="number" 
              className="form-control" 
              value={weightInput} 
              onChange={e => setWeightInput(e.target.value)} 
              placeholder="e.g. 150"
              min="1" 
              step="1" 
              required 
              disabled={foods.length === 0}
            />
          </div>
          <div className="action">
            <button disabled={loading || foods.length === 0} type="submit" className="btn btn-primary">
              Add
            </button>
          </div>
        </form>
      </div>

      <div className="card weight-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h3 style={{ margin: 0 }}>Daily Weight</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="number" 
                className="form-control" 
                style={{ width: '100px', height: '40px' }}
                placeholder="0.0"
                step="0.1"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                onBlur={handleSaveWeight}
              />
              <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>kg</span>
            </div>
          </div>
          {savingWeight && <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>Saving...</span>}
        </div>
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
          <div className="summary-value">{dailyCarbs.toFixed(1)}</div>
          <div className="summary-label">Total Carbs (g)</div>
        </div>
        <div className="summary-item">
          <div className="summary-value">{dailyFat.toFixed(1)}</div>
          <div className="summary-label">Total Fat (g)</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h3>Logs for {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
        {logs.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No intake logged for this date.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Food</th>
                <th>Weight</th>
                <th>Calories</th>
                <th>Protein</th>
                <th>Carbs</th>
                <th>Fat</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>
                    {log.foodName}
                    <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{log.servingSize} base</div>
                  </td>
                  <td>{log.weight !== undefined ? `${log.weight}g` : `${log.servings} serv`}</td>
                   <td>{log.totalCalories}</td>
                  <td>{log.totalProtein}g</td>
                  <td>{log.totalCarbs !== undefined ? log.totalCarbs : '-'}g</td>
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
                {/* Maintenance Target Marker */}
                {day.hasWeight && (
                  <div 
                    style={{ 
                      position: 'absolute',
                      bottom: `${(day.maintenance / maxCalories) * 100}%`,
                      width: '70%',
                      maxWidth: '40px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      height: '2px',
                      backgroundColor: 'var(--error-color)',
                      zIndex: 7,
                      pointerEvents: 'none'
                    }}
                  >
                    <div style={{ 
                      position: 'absolute', 
                      top: '-18px', 
                      left: '50%', 
                      transform: 'translateX(-50%)',
                      fontSize: '0.6rem',
                      fontWeight: '800',
                      color: 'var(--error-color)',
                      whiteSpace: 'nowrap',
                      textShadow: '0 0 4px var(--secondary-bg)'
                    }}>
                      {day.maintenance}
                    </div>
                  </div>
                )}

                {/* Loss Target Marker */}
                {day.hasWeight && (
                  <div 
                    style={{ 
                      position: 'absolute',
                      bottom: `${(day.loss / maxCalories) * 100}%`,
                      width: '70%',
                      maxWidth: '40px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      height: '2px',
                      backgroundColor: 'rgb(100, 116, 139)',
                      zIndex: 7,
                      pointerEvents: 'none'
                    }}
                  >
                    <div style={{ 
                      position: 'absolute', 
                      top: '-18px', 
                      left: '50%', 
                      transform: 'translateX(-50%)',
                      fontSize: '0.6rem',
                      fontWeight: '800',
                      color: 'rgb(100, 116, 139)',
                      whiteSpace: 'nowrap',
                      textShadow: '0 0 4px var(--secondary-bg)'
                    }}>
                      {day.loss}
                    </div>
                  </div>
                )}

                <div 
                  className="chart-bar" 
                  style={{ height: `${(day.calories / maxCalories) * 100}%`, zIndex: 6 }}
                >
                  <div className="chart-value" style={{ bottom: '5px', top: 'auto', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                    {day.calories.toFixed(0)}
                  </div>
                  <div className="chart-tooltip">
                    {day.calories.toFixed(0)} kcal consumed
                    {day.hasWeight && (
                      <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '0.25rem' }}>
                        Maintenance: {day.maintenance} kcal<br/>
                        Weight Loss: {day.loss} kcal
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="chart-label" style={{ textAlign: 'center', width: '100%' }}>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{day.dateLabel}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.75rem', opacity: 0.7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '2px' }}></div>
            <span>Intake</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ width: '12px', height: '2px', backgroundColor: 'var(--error-color)' }}></div>
            <span>Maintenance</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ width: '12px', height: '2px', backgroundColor: 'rgb(100, 116, 139)' }}></div>
            <span>Weight Loss Target</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h3>Weekly Protein Intake</h3>
        <div className="chart-container">
          {weeklyData.map((day, idx) => (
            <div key={day.date} className="chart-column">
              <div className="chart-bar-wrapper">
                {/* Daily Target Marker */}
                {day.targetProtein > 0 && (
                  <div 
                    style={{ 
                      position: 'absolute',
                      bottom: `${(day.targetProtein / maxProtein) * 100}%`,
                      width: '70%',
                      maxWidth: '40px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      height: '2px',
                      backgroundColor: 'var(--error-color)',
                      zIndex: 7,
                      pointerEvents: 'none'
                    }}
                  >
                    <div style={{ 
                      position: 'absolute', 
                      top: '-18px', 
                      left: '50%', 
                      transform: 'translateX(-50%)',
                      fontSize: '0.65rem',
                      fontWeight: '800',
                      color: 'var(--error-color)',
                      whiteSpace: 'nowrap',
                      textShadow: '0 0 4px var(--secondary-bg)'
                    }}>
                      {day.targetProtein.toFixed(0)}
                    </div>
                  </div>
                )}

                <div 
                  className="chart-bar protein" 
                  style={{ height: `${(day.protein / maxProtein) * 100}%`, zIndex: 6 }}
                >
                  <div className="chart-value" style={{ bottom: '5px', top: 'auto', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                    {day.protein.toFixed(0)}
                  </div>
                  <div className="chart-tooltip">
                    {day.protein.toFixed(1)} g consumed
                    {day.targetProtein > 0 && <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>Target: {day.targetProtein} g</div>}
                  </div>
                </div>
              </div>
              <div className="chart-label" style={{ textAlign: 'center', width: '100%' }}>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{day.dateLabel}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', opacity: 0.7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '2px' }}></div>
            <span>Intake</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ width: '12px', height: '2px', backgroundColor: 'var(--error-color)' }}></div>
            <span>Daily Target (BW x 2.2)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
