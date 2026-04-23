import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit, addDoc, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function WeightManagement() {
  const [weights, setWeights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingId, setEditingId] = useState(null);

  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      fetchWeights();
    }
  }, [currentUser]);

  async function fetchWeights() {
    try {
      const q = query(
        collection(db, 'weights'),
        where('userId', '==', currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const weightList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort chronologically for the chart
      weightList.sort((a, b) => a.date.localeCompare(b.date));
      
      // Limit to last 30 entries if needed
      const last30Weights = weightList.slice(-30);
      
      setWeights(last30Weights);
    } catch (err) {
      console.error('Failed to fetch weights:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!weight || !date) return;

    try {
      setError('');
      setSaving(true);
      const weightData = {
        userId: currentUser.uid,
        date,
        weight: Number(weight),
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'weights', editingId), weightData);
        setEditingId(null);
      } else {
        // Check if weight for this date already exists
        const existing = weights.find(w => w.date === date);
        if (existing) {
          await updateDoc(doc(db, 'weights', existing.id), weightData);
        } else {
          await addDoc(collection(db, 'weights'), {
            ...weightData,
            createdAt: new Date().toISOString()
          });
        }
      }

      setWeight('');
      fetchWeights();
    } catch (err) {
      setError('Failed to save weight.');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(entry) {
    setEditingId(entry.id);
    setWeight(entry.weight);
    setDate(entry.date);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this weight entry?')) return;
    try {
      await deleteDoc(doc(db, 'weights', id));
      fetchWeights();
    } catch (err) {
      setError('Failed to delete.');
    }
  }

  const maxWeight = weights.length > 0 ? Math.max(...weights.map(w => w.weight)) * 1.1 : 100;
  const minWeight = weights.length > 0 ? Math.min(...weights.map(w => w.weight)) * 0.9 : 0;
  const range = maxWeight - minWeight;

  return (
    <div className="container">
      <div className="card">
        <h2>{editingId ? 'Edit Weight' : 'Log Daily Weight'}</h2>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit} className="flex-group">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Weight (kg)</label>
            <input 
              type="number" 
              className="form-control" 
              value={weight} 
              onChange={e => setWeight(e.target.value)} 
              step="0.1" 
              required 
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Date</label>
            <input 
              type="date" 
              className="form-control" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              required 
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
            <button disabled={saving} type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
              {editingId ? 'Update' : 'Log'}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setWeight(''); }} className="btn btn-outline" style={{ width: 'auto' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Weight Tracking</h2>
        <p style={{ opacity: 0.7, marginBottom: '2rem' }}>Showing your last 30 entries</p>

        {loading ? (
          <p>Loading data...</p>
        ) : weights.length === 0 ? (
          <div className="text-center" style={{ padding: '3rem 0' }}>
            <p style={{ opacity: 0.5 }}>No weight data recorded yet.</p>
            <p style={{ fontSize: '0.875rem' }}>Add your weight above to see it here.</p>
          </div>
        ) : (
          <div className="card">
            <h3>Weight Trend (kg)</h3>
            <div className="chart-container" style={{ height: '300px', position: 'relative' }}>
              {/* Trend Line SVG */}
              <svg 
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  pointerEvents: 'none',
                  zIndex: 5
                }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <polyline
                  points={weights.map((entry, idx) => {
                    const x = ((idx + 0.5) / weights.length) * 100;
                    const y = 100 - (((entry.weight - minWeight) / range) * 100);
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="0.5"
                  strokeOpacity="0.8"
                  strokeDasharray="2,2"
                />
              </svg>

              {weights.map((entry) => (
                <div key={entry.id} className="chart-column">
                  <div className="chart-bar-wrapper">
                    <div 
                      className="chart-bar" 
                      style={{ 
                        height: `${((entry.weight - minWeight) / range) * 100}%`,
                        minHeight: '2px',
                        zIndex: 6
                      }}
                    >
                      <div className="chart-value">{entry.weight}</div>
                      <div className="chart-tooltip">
                        {new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: {entry.weight} kg
                      </div>
                    </div>
                  </div>
                  <div className="chart-label" style={{ fontSize: '0.6rem' }}>
                    {new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {weights.length > 0 && (
        <div className="card">
          <h3>History</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Weight (kg)</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...weights].reverse().map(entry => (
                <tr key={entry.id}>
                  <td>{new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                  <td>{entry.weight} kg</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleEdit(entry)}
                        className="btn btn-outline" 
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(entry.id)}
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
        </div>
      )}
    </div>
  );
}
