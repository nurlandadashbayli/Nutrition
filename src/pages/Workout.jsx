import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, addDoc, deleteDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function Workout() {
  const [exercises, setExercises] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [isCreatingExercise, setIsCreatingExercise] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Exercise form state
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseIcon, setExerciseIcon] = useState('');
  const [editingExerciseId, setEditingExerciseId] = useState(null);

  // New set input state (for the detail view)
  const [newSets, setNewSets] = useState([{ weight: '', reps: '' }]);

  const { currentUser } = useAuth();

  const WORKOUT_EMOJIS = ['💪', '🏋️‍♂️', '🏃‍♂️', '🧘‍♂️', '🚴‍♂️', '🏊‍♂️', '🥊', '🧗‍♂️', '🤸‍♂️', '🔥', '⚡️', '🏆', '👟', '🏔', '🏀', '⚽️', '🎾', '🎳'];

  // Generate initials from exercise name (e.g. "Bench Press" -> "BP")
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  // Render icon or initials fallback
  const renderIcon = (icon, name, size = '2.5rem') => {
    if (icon) return <span style={{ fontSize: size }}>{icon}</span>;
    return (
      <span style={{
        fontSize: `calc(${size} * 0.45)`,
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '12px',
        background: 'var(--primary-color)',
        color: 'var(--button-text)',
        fontWeight: '700',
        letterSpacing: '0.5px',
        flexShrink: 0
      }}>
        {getInitials(name)}
      </span>
    );
  };

  useEffect(() => {
    if (!currentUser) return;

    // 1. Exercises Listener
    const exercisesQ = query(collection(db, 'exercises'), where('userId', '==', currentUser.uid));
    const unsubExercises = onSnapshot(exercisesQ, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setExercises(list);
    });

    // 2. Workout Logs Listener
    const logsQ = query(collection(db, 'workoutLogs'), where('userId', '==', currentUser.uid));
    const unsubLogs = onSnapshot(logsQ, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const valid = all.filter(l => l.exerciseName && Array.isArray(l.sets));
      valid.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setLogs(valid);
    });

    return () => {
      unsubExercises();
      unsubLogs();
    };
  }, [currentUser]);



  // Exercise CRUD
  async function saveExercise() {
    if (!exerciseName) { setMessage('Please enter a name'); return; }
    try {
      setLoading(true);
      const data = { userId: currentUser.uid, name: exerciseName, icon: exerciseIcon, updatedAt: new Date().toISOString() };
      if (editingExerciseId) {
        await updateDoc(doc(db, 'exercises', editingExerciseId), data);
        setMessage('Exercise updated!');
      } else {
        await addDoc(collection(db, 'exercises'), { ...data, createdAt: new Date().toISOString() });
        setMessage('Exercise added!');
      }
      resetForm();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Failed to save exercise');
    } finally { setLoading(false); }
  }

  function resetForm() {
    setIsCreatingExercise(false);
    setEditingExerciseId(null);
    setExerciseName('');
    setExerciseIcon('');
  }

  function editExercise(e, ex) {
    e.stopPropagation();
    setIsCreatingExercise(true);
    setEditingExerciseId(ex.id);
    setExerciseName(ex.name);
    setExerciseIcon(ex.icon || '');
  }

  async function deleteExercise(e, id) {
    e.stopPropagation();
    if (!window.confirm('Delete this exercise card?')) return;
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'exercises', id));
      setMessage('Exercise removed');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  // Open exercise detail view
  function openExercise(ex) {
    setSelectedExercise(ex);
    setNewSets([{ weight: '', reps: '' }]);
  }

  // Set input management
  const addSet = () => setNewSets(prev => [...prev, { weight: '', reps: '' }]);
  const removeSet = (i) => setNewSets(prev => prev.filter((_, idx) => idx !== i));
  const updateSetField = (i, field, value) => {
    setNewSets(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  // Save log
  async function logSession() {
    if (newSets.some(s => !s.weight || !s.reps)) {
      alert('Please fill in all sets');
      return;
    }
    try {
      setLoading(true);
      await addDoc(collection(db, 'workoutLogs'), {
        userId: currentUser.uid,
        exerciseId: selectedExercise.id,
        exerciseName: selectedExercise.name,
        exerciseIcon: selectedExercise.icon || '',
        date,
        sets: newSets.map(s => ({ weight: Number(s.weight), reps: Number(s.reps) })),
        createdAt: new Date().toISOString()
      });
      setNewSets([{ weight: '', reps: '' }]);
      setMessage(`Logged ${selectedExercise.name}!`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Failed to log session');
    } finally { setLoading(false); }
  }

  async function handleDeleteLog(id) {
    if (!window.confirm('Delete this log entry?')) return;
    try {
      await deleteDoc(doc(db, 'workoutLogs', id));
      setMessage('Log deleted');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) { console.error(err); }
  }

  async function loadSampleExercises() {
    try {
      setLoading(true);
      const samples = [
        { name: 'Bench Press', icon: '🔥' },
        { name: 'Squat', icon: '🏋️‍♂️' },
        { name: 'Deadlift', icon: '💪' },
        { name: 'Pull Up', icon: '🧗‍♂️' },
        { name: 'Overhead Press', icon: '⚡️' }
      ];
      for (const s of samples) {
        await addDoc(collection(db, 'exercises'), { ...s, userId: currentUser.uid, createdAt: new Date().toISOString() });
      }
      setMessage('Sample exercises loaded!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const changeDate = (offset) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().split('T')[0]);
  };

  // Logs for the selected exercise
  const exerciseLogs = selectedExercise
    ? logs.filter(l => l.exerciseName === selectedExercise.name)
    : [];
  const exerciseLogsForDate = exerciseLogs.filter(l => l.date === date);

  // Card grid: count today's logs per exercise for badge
  const todayLogCounts = {};
  logs.filter(l => l.date === date).forEach(l => {
    todayLogCounts[l.exerciseName] = (todayLogCounts[l.exerciseName] || 0) + l.sets.length;
  });

  return (
    <div className="workout-page">
      {/* ============ CARD GRID VIEW ============ */}
      {!selectedExercise && !isCreatingExercise ? (
        <>
          <div className="header-flex">
            <h2 style={{ margin: 0 }}>Workout</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <button onClick={() => changeDate(-1)} className="btn btn-outline" style={{ width: '40px', height: '48px', padding: 0 }} title="Previous Day">←</button>
              <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto', height: '48px', textAlign: 'center', flex: 1 }} />
              <button onClick={() => changeDate(1)} className="btn btn-outline" style={{ width: '40px', height: '48px', padding: 0 }} title="Next Day">→</button>
            </div>
          </div>

          <div className="recipe-grid">
            {exercises.map(ex => (
              <div key={ex.id} className="recipe-card" onClick={() => openExercise(ex)} style={{ position: 'relative' }}>
                <div className="recipe-card-actions">
                  <button className="card-action-btn" onClick={(e) => editExercise(e, ex)} title="Edit">✎</button>
                  <button className="card-action-btn delete" onClick={(e) => deleteExercise(e, ex.id)} title="Delete">✕</button>
                </div>
                <div className="icon">{ex.icon ? ex.icon : renderIcon('', ex.name)}</div>
                <span>{ex.name}</span>
                {todayLogCounts[ex.name] && (
                  <p style={{ fontSize: '0.75rem', opacity: 0.6, margin: 0 }}>
                    {todayLogCounts[ex.name]} sets today
                  </p>
                )}
              </div>
            ))}
            <div className="recipe-card add-new" onClick={() => setIsCreatingExercise(true)}>
              <div className="icon">➕</div>
              <span>Add Exercise</span>
            </div>
          </div>

          {exercises.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '3rem' }}>
              <button className="btn btn-outline" onClick={loadSampleExercises} disabled={loading} style={{ width: 'auto' }}>
                Load Sample Exercises
              </button>
            </div>
          )}
        </>

      /* ============ CREATE / EDIT EXERCISE ============ */
      ) : isCreatingExercise ? (
        <div className="builder-view">
          <div className="builder-header">
            <div style={{ flex: 1 }}>
              <input
                type="text"
                className="form-control"
                placeholder={editingExerciseId ? "Update Name" : "Exercise Name (e.g. Squat)"}
                value={exerciseName}
                onChange={e => setExerciseName(e.target.value)}
                style={{ fontSize: '1.5rem', fontWeight: 'bold', border: 'none', padding: 0, background: 'transparent', boxShadow: 'none' }}
              />
              <p style={{ opacity: 0.6, fontSize: '0.85rem', margin: 0 }}>
                {editingExerciseId ? 'Update this exercise' : 'Create a new exercise card'}
              </p>
            </div>
            <button className="btn btn-outline" style={{ width: 'auto' }} onClick={resetForm}>Cancel</button>
          </div>

          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <label className="form-label">Choose Icon</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginTop: '0.5rem' }}>
              <button
                className={`card-action-btn ${exerciseIcon === '' ? 'active' : ''}`}
                onClick={() => setExerciseIcon('')}
                style={{ width: 'auto', padding: '0 1rem', height: '40px', fontSize: '0.85rem', borderColor: exerciseIcon === '' ? 'var(--primary-color)' : 'var(--border-color)', background: exerciseIcon === '' ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent', fontWeight: 'bold' }}
              >
                None (Initials)
              </button>
              {WORKOUT_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  className={`card-action-btn ${exerciseIcon === emoji ? 'active' : ''}`}
                  onClick={() => setExerciseIcon(emoji)}
                  style={{ width: '40px', height: '40px', fontSize: '1.25rem', borderColor: exerciseIcon === emoji ? 'var(--primary-color)' : 'var(--border-color)', background: exerciseIcon === emoji ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent' }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="recipe-summary-floating">
            <button className="btn btn-primary" onClick={saveExercise} disabled={loading || !exerciseName}>
              {loading ? 'Saving...' : editingExerciseId ? 'Update Exercise' : 'Save Exercise'}
            </button>
            {message && <p className="text-center mt-2" style={{ color: 'var(--accent-color)', fontWeight: '500' }}>{message}</p>}
          </div>
        </div>

      /* ============ EXERCISE DETAIL VIEW ============ */
      ) : (
        <div className="builder-view">
          <div className="builder-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {renderIcon(selectedExercise.icon, selectedExercise.name, '2.5rem')}
              <div>
                <h2 style={{ margin: 0 }}>{selectedExercise.name}</h2>
                <p style={{ opacity: 0.6, fontSize: '0.85rem', margin: 0 }}>Log for {date}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={() => changeDate(-1)} className="btn btn-outline" style={{ width: '40px', height: '40px', padding: 0 }}>←</button>
              <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto', height: '40px', textAlign: 'center' }} />
              <button onClick={() => changeDate(1)} className="btn btn-outline" style={{ width: '40px', height: '40px', padding: 0 }}>→</button>
              <button className="btn btn-outline" style={{ width: 'auto' }} onClick={() => setSelectedExercise(null)}>Back</button>
            </div>
          </div>

          {/* New set input */}
          <div className="card" style={{ borderRadius: '20px', marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Add New Entry</h3>
            <div className="sets-list">
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', opacity: 0.5, fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', paddingLeft: '2.5rem' }}>
                <div style={{ flex: 1, textAlign: 'center' }}>Weight (kg)</div>
                <div style={{ flex: 1, textAlign: 'center' }}>Reps</div>
                <div style={{ width: '24px' }}></div>
              </div>
              {newSets.map((set, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ width: '2rem', fontWeight: 'bold', opacity: 0.3 }}>{i + 1}</div>
                  <input type="number" className="form-control" placeholder="0" value={set.weight} onChange={e => updateSetField(i, 'weight', e.target.value)} style={{ textAlign: 'center', height: '40px' }} />
                  <input type="number" className="form-control" placeholder="0" value={set.reps} onChange={e => updateSetField(i, 'reps', e.target.value)} style={{ textAlign: 'center', height: '40px' }} />
                  <button className="card-action-btn delete" onClick={() => removeSet(i)} disabled={newSets.length === 1} style={{ border: 'none', background: 'transparent', opacity: newSets.length === 1 ? 0 : 0.5 }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-outline" style={{ height: '40px', borderStyle: 'dashed' }} onClick={addSet}>+ Add Set</button>
              <button className="btn btn-primary" style={{ height: '40px' }} onClick={logSession} disabled={loading}>
                {loading ? 'Saving...' : 'Save Log'}
              </button>
            </div>
          </div>

          {/* Today's logs for this exercise */}
          {exerciseLogsForDate.length > 0 && (
            <div className="card" style={{ borderRadius: '20px', marginBottom: '2rem' }}>
              <h3>Today's Logs</h3>
              {exerciseLogsForDate.map(log => {
                const totalReps = log.sets.reduce((a, s) => a + Number(s.reps), 0);
                const totalVol = log.sets.reduce((a, s) => a + (Number(s.weight) * Number(s.reps)), 0);
                return (
                  <div key={log.id} style={{ padding: '0.75rem', background: 'var(--bg-color)', borderRadius: '12px', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {log.sets.map((s, i) => (
                          <span key={i} style={{ fontSize: '0.9rem', background: 'var(--secondary-bg)', padding: '3px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: '500' }}>
                            {s.weight}kg × {s.reps}
                          </span>
                        ))}
                      </div>
                      <button onClick={() => handleDeleteLog(log.id)} className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', width: 'auto', borderColor: 'var(--error-color)', color: 'var(--error-color)' }}>
                        Delete
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', opacity: 0.6 }}>
                      <span>{log.sets.length} sets</span>
                      <span>{totalReps} reps</span>
                      <span>{totalVol.toLocaleString()} kg vol</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary for today */}
          {exerciseLogsForDate.length > 0 && (() => {
            const allSets = exerciseLogsForDate.flatMap(l => l.sets);
            const tSets = allSets.length;
            const tReps = allSets.reduce((a, s) => a + Number(s.reps), 0);
            const tVol = allSets.reduce((a, s) => a + (Number(s.weight) * Number(s.reps)), 0);
            const maxWeight = Math.max(...allSets.map(s => Number(s.weight)));
            return (
              <div className="summary-card" style={{ marginBottom: '2rem' }}>
                <div className="summary-item">
                  <div className="summary-value">{tSets}</div>
                  <div className="summary-label">Sets</div>
                </div>
                <div className="summary-item">
                  <div className="summary-value">{tReps}</div>
                  <div className="summary-label">Reps</div>
                </div>
                <div className="summary-item">
                  <div className="summary-value">{tVol.toLocaleString()}</div>
                  <div className="summary-label">Volume (kg)</div>
                </div>
                <div className="summary-item">
                  <div className="summary-value">{maxWeight}</div>
                  <div className="summary-label">Max (kg)</div>
                </div>
              </div>
            );
          })()}

          {/* Full history */}
          <div className="card" style={{ borderRadius: '20px' }}>
            <h3>History</h3>
            {exerciseLogs.length === 0 ? (
              <p style={{ opacity: 0.7 }}>No history yet for this exercise.</p>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {exerciseLogs.map(log => (
                  <div key={log.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: '500', fontSize: '0.85rem' }}>{new Date(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                        {log.sets.map((s, i) => (
                          <span key={i} style={{ fontSize: '0.8rem', opacity: 0.7 }}>{s.weight}×{s.reps}</span>
                        ))}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                      {log.sets.reduce((a, s) => a + (Number(s.weight) * Number(s.reps)), 0).toLocaleString()} kg
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {message && (
        <div className="recipe-summary-floating" style={{ padding: '1rem', bottom: '2rem' }}>
          <p style={{ margin: 0, textAlign: 'center', color: 'var(--accent-color)', fontWeight: 'bold' }}>{message}</p>
        </div>
      )}
    </div>
  );
}
