import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function FoodManagement() {
  const [foods, setFoods] = useState([]);
  const [name, setName] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      fetchFoods();
    }
  }, [currentUser]);

  async function fetchFoods() {
    try {
      const q = query(collection(db, 'foods'), where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      const foodList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFoods(foodList);
    } catch (err) {
      console.error(err);
      setError('Failed to load foods.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name || !servingSize || !calories || !protein) return;

    try {
      setError('');
      setLoading(true);
      await addDoc(collection(db, 'foods'), {
        userId: currentUser.uid,
        name,
        servingSize,
        calories: Number(calories),
        protein: Number(protein)
      });
      setName('');
      setServingSize('');
      setCalories('');
      setProtein('');
      fetchFoods();
    } catch (err) {
      setError('Failed to add food.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Add New Food</h2>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Food Name (e.g., Quark)</label>
            <input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Serving Size (e.g., 250g, 1 cup)</label>
            <input type="text" className="form-control" value={servingSize} onChange={e => setServingSize(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Calories (per serving)</label>
              <input type="number" className="form-control" value={calories} onChange={e => setCalories(e.target.value)} required min="0" step="0.1" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Protein (g per serving)</label>
              <input type="number" className="form-control" value={protein} onChange={e => setProtein(e.target.value)} required min="0" step="0.1" />
            </div>
          </div>
          <button disabled={loading} type="submit" className="btn btn-primary mt-2">Add Food</button>
        </form>
      </div>

      <div className="card">
        <h2>Your Foods</h2>
        {foods.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No foods added yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Serving Size</th>
                <th>Calories</th>
                <th>Protein (g)</th>
              </tr>
            </thead>
            <tbody>
              {foods.map(food => (
                <tr key={food.id}>
                  <td>{food.name}</td>
                  <td>{food.servingSize}</td>
                  <td>{food.calories}</td>
                  <td>{food.protein}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
