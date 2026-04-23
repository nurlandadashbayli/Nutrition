import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function FoodManagement() {
  const [foods, setFoods] = useState([]);
  const [name, setName] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  
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
    if (!name || !servingSize || calories === '' || protein === '' || fat === '') return;

    try {
      setError('');
      setLoading(true);
      
      const foodData = {
        userId: currentUser.uid,
        name,
        servingSize,
        calories: Number(calories),
        protein: Number(protein),
        fat: Number(fat)
      };

      if (editingId) {
        await updateDoc(doc(db, 'foods', editingId), foodData);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'foods'), foodData);
      }
      
      setName('');
      setServingSize('');
      setCalories('');
      setProtein('');
      setFat('');
      fetchFoods();
    } catch (err) {
      setError('Failed to save food.');
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(food) {
    setEditingId(food.id);
    setName(food.name);
    setServingSize(food.servingSize);
    setCalories(food.calories);
    setProtein(food.protein);
    setFat(food.fat !== undefined ? food.fat : 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setName('');
    setServingSize('');
    setCalories('');
    setProtein('');
    setFat('');
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this food?')) return;
    try {
      await deleteDoc(doc(db, 'foods', id));
      fetchFoods();
    } catch (err) {
      console.error(err);
      setError('Failed to delete food.');
    }
  }

  return (
    <div>
      <div className="card">
        <h2>{editingId ? 'Edit Food' : 'Add New Food'}</h2>
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
          <div className="flex-group">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Calories</label>
              <input type="number" className="form-control" value={calories} onChange={e => setCalories(e.target.value)} required min="0" step="0.1" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Protein (g)</label>
              <input type="number" className="form-control" value={protein} onChange={e => setProtein(e.target.value)} required min="0" step="0.1" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Fat (g)</label>
              <input type="number" className="form-control" value={fat} onChange={e => setFat(e.target.value)} required min="0" step="0.1" />
            </div>
          </div>
          <div className="flex-group">
            <button disabled={loading} type="submit" className="btn btn-primary mt-2">
              {editingId ? 'Update Food' : 'Add Food'}
            </button>
            {editingId && (
              <button type="button" onClick={handleCancelEdit} className="btn btn-outline mt-2" style={{ padding: '0 1.5rem', width: 'auto' }}>
                Cancel
              </button>
            )}
          </div>
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
                <th>Fat (g)</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {foods.map(food => (
                <tr key={food.id}>
                  <td>{food.name}</td>
                  <td>{food.servingSize}</td>
                  <td>{food.calories}</td>
                  <td>{food.protein}</td>
                  <td>{food.fat !== undefined ? food.fat : '-'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleEdit(food)}
                        className="btn btn-outline" 
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(food.id)}
                        className="btn btn-outline" 
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', width: 'auto', borderColor: 'var(--error-color)', color: 'var(--error-color)' }}
                      >
                        Delete
                      </button>
                    </div>
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
