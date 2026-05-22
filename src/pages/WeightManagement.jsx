import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, addDoc, deleteDoc, updateDoc, doc, setDoc, onSnapshot, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import CollapsibleCard from '../components/CollapsibleCard';

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
    if (!currentUser) return;

    const q = query(
      collection(db, 'weights'),
      where('userId', '==', currentUser.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const weightList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort chronologically for the chart
      weightList.sort((a, b) => a.date.localeCompare(b.date));
      // Limit to last 30 entries
      setWeights(weightList.slice(-30));
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser]);



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

      // Use a deterministic document ID so the web app and the iOS REST Shortcut stay perfectly in sync
      const docId = `${currentUser.uid}_${date}`;

      if (editingId && editingId !== docId) {
        // If they are editing an old random-ID document, update that specific one
        await updateDoc(doc(db, 'weights', editingId), weightData);
        setEditingId(null);
      } else {
        // Use setDoc to overwrite or create for this specific date
        // Note: we use merge: true so we don't blow away createdAt if it exists
        await setDoc(doc(db, 'weights', docId), {
            ...weightData,
            createdAt: weightData.createdAt || new Date().toISOString()
        }, { merge: true });
      }

      setWeight('');
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
    } catch (err) {
      setError('Failed to delete.');
    }
  }

  async function handleExportData() {
    try {
      setSaving(true);
      setError('');
      const q = query(collection(db, 'weights'), where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      const allWeights = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          date: data.date,
          weight: data.weight,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        };
      });
      
      allWeights.sort((a, b) => a.date.localeCompare(b.date));

      const dataStr = JSON.stringify({ weights: allWeights }, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `weight_data_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError('Failed to export weight data.');
    } finally {
      setSaving(false);
    }
  }

  const maxWeight = weights.length > 0 ? Math.max(...weights.map(w => w.weight)) * 1.1 : 100;
  const minWeight = weights.length > 0 ? Math.min(...weights.map(w => w.weight)) * 0.9 : 0;
  const range = maxWeight - minWeight;

  return (
    <div>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Weight Tracking</h2>
            <p style={{ opacity: 0.7, marginBottom: '2rem' }}>Showing your last 30 entries</p>
          </div>
          <button onClick={handleExportData} className="btn btn-outline" disabled={saving}>
            {saving ? 'Exporting...' : 'Export Data (JSON)'}
          </button>
        </div>

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
        <CollapsibleCard title="History" count={weights.length}>
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
        </CollapsibleCard>
      )}
    </div>
  );
}
