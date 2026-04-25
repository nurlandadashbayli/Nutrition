import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function Profile() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState({
    birthday: '',
    height: '',
    gender: 'male',
    activityLevel: '1.2',
    weeklyLossGoal: 0.5
  });
  const [latestWeight, setLatestWeight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (currentUser) {
      fetchProfile();
      fetchLatestWeight();
    }
  }, [currentUser]);

  async function fetchProfile() {
    try {
      const docRef = doc(db, 'profiles', currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data());
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLatestWeight() {
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const q = query(
        collection(db, 'weights'),
        where('userId', '==', currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const weightList = querySnapshot.docs.map(doc => doc.data());
        weightList.sort((a, b) => b.date.localeCompare(a.date));
        setLatestWeight(weightList[0].weight);
      }
    } catch (err) {
      console.error('Failed to fetch latest weight:', err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage('');
      await setDoc(doc(db, 'profiles', currentUser.uid), profile);
      setMessage('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      setMessage('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  const calculateAge = (birthday) => {
    if (!birthday) return 0;
    const today = new Date();
    const birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const calculateTDEE = () => {
    const { birthday, height, gender, activityLevel } = profile;
    if (!birthday || !height || !latestWeight) return null;

    const age = calculateAge(birthday);
    const h = Number(height);
    const w = Number(latestWeight);
    
    let bmr;
    if (gender === 'male') {
      bmr = 10 * w + 6.25 * h - 5 * age + 5;
    } else {
      bmr = 10 * w + 6.25 * h - 5 * age - 161;
    }

    return Math.round(bmr * Number(activityLevel));
  };

  const tdee = calculateTDEE();

  if (loading) return <div className="container"><p>Loading...</p></div>;

  return (
    <div className="container">
      <div className="card">
        <h2>Your Profile</h2>
        <p style={{ opacity: 0.7, marginBottom: '2rem' }}>Complete your profile to calculate your daily caloric targets.</p>
        
        {message && (
          <div className={`error-msg ${message.includes('successfully') ? 'text-center mb-4' : ''}`} style={{ color: message.includes('successfully') ? 'var(--accent-color)' : 'var(--error-color)' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="flex-group">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Birthday</label>
              <input 
                type="date" 
                className="form-control" 
                value={profile.birthday} 
                onChange={e => setProfile({...profile, birthday: e.target.value})}
                required 
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Height (cm)</label>
              <input 
                type="number" 
                className="form-control" 
                value={profile.height} 
                onChange={e => setProfile({...profile, height: e.target.value})}
                placeholder="175"
                required 
              />
            </div>
          </div>

          <div className="flex-group">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Gender</label>
              <select 
                className="form-control" 
                value={profile.gender}
                onChange={e => setProfile({...profile, gender: e.target.value})}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Activity Level</label>
              <select 
                className="form-control" 
                value={profile.activityLevel}
                onChange={e => setProfile({...profile, activityLevel: e.target.value})}
              >
                <option value="1.2">Sedentary (office job, little exercise)</option>
                <option value="1.375">Lightly Active (1-3 days/week)</option>
                <option value="1.55">Moderately Active (3-5 days/week)</option>
                <option value="1.725">Very Active (6-7 days/week)</option>
                <option value="1.9">Extra Active (physical job & training)</option>
              </select>
            </div>
          </div>

          <div className="form-group mt-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.05em', margin: 0, opacity: 0.7 }}>
                WEEKLY WEIGHT LOSS GOAL
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ 
                  backgroundColor: 'var(--input-bg)', 
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.5rem 1.25rem',
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  minWidth: '80px',
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-color)'
                }}>
                  {profile.weeklyLossGoal.toFixed(1)}
                </div>
                <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>kg</span>
              </div>
            </div>
            
            <div className="custom-slider-container">
              <input 
                type="range" 
                className="modern-slider" 
                min="0" 
                max="1" 
                step="0.1"
                value={profile.weeklyLossGoal} 
                onChange={e => setProfile({...profile, weeklyLossGoal: Number(e.target.value)})}
              />
            </div>
          </div>

          <button disabled={saving} type="submit" className="btn btn-primary mt-4">
            Save Profile
          </button>
        </form>
      </div>

      <div className="summary-card" style={{ marginTop: '2rem' }}>
        <div className="summary-item">
          <div className="summary-value">{latestWeight || '-'}</div>
          <div className="summary-label">Latest Weight (kg)</div>
        </div>
        <div className="summary-item">
          <div className="summary-value">{tdee || '-'}</div>
          <div className="summary-label">TDEE (Maintenance)</div>
        </div>
        <div className="summary-item">
          <div className="summary-value">{tdee ? Math.round(tdee - (profile.weeklyLossGoal * 1100)) : '-'}</div>
          <div className="summary-label">Weight Loss Target (kcal)</div>
        </div>
      </div>

      {!latestWeight && (
        <p className="mt-4" style={{ opacity: 0.6, fontSize: '0.875rem', textAlign: 'center' }}>
          * Please record your weight in the Intake Log to calculate TDEE.
        </p>
      )}
    </div>
  );
}
