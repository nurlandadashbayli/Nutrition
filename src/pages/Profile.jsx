import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
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

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Failed to log out", error);
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
    <div className="container" style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>Profile</h1>
        <p style={{ opacity: 0.6, margin: 0 }}>Configure your details for accurate targets</p>
      </div>

      {message && (
        <div style={{
          padding: '1rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          textAlign: 'center',
          backgroundColor: message.includes('successfully') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: message.includes('successfully') ? '#10b981' : '#ef4444',
          fontWeight: '500'
        }}>
          {message}
        </div>
      )}

      {/* Stats Summary Widget */}
      <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', boxShadow: 'var(--shadow-color)' }}>
        <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{latestWeight || '-'}</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.25rem' }}>Current (kg)</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{tdee || '-'}</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.25rem' }}>TDEE (kcal)</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
            {tdee ? Math.round(tdee - (profile.weeklyLossGoal * 1100)) : '-'}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.25rem' }}>Target (kcal)</div>
        </div>
      </div>

      <div className="card" style={{ padding: '2rem', borderRadius: '16px', boxShadow: 'var(--shadow-color)' }}>
        <form onSubmit={handleSubmit}>
          <div className="flex-group">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ fontWeight: '500', opacity: 0.8 }}>Birthday</label>
              <input
                type="date"
                className="form-control"
                value={profile.birthday}
                onChange={e => setProfile({ ...profile, birthday: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ fontWeight: '500', opacity: 0.8 }}>Height (cm)</label>
              <input
                type="number"
                className="form-control"
                value={profile.height}
                onChange={e => setProfile({ ...profile, height: e.target.value })}
                placeholder="175"
                required
              />
            </div>
          </div>

          <div className="flex-group">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ fontWeight: '500', opacity: 0.8 }}>Gender</label>
              <select
                className="form-control"
                value={profile.gender}
                onChange={e => setProfile({ ...profile, gender: e.target.value })}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ fontWeight: '500', opacity: 0.8 }}>Activity Level</label>
              <select
                className="form-control"
                value={profile.activityLevel}
                onChange={e => setProfile({ ...profile, activityLevel: e.target.value })}
              >
                <option value="1.2">Sedentary (office)</option>
                <option value="1.375">Lightly Active (1-3 days)</option>
                <option value="1.55">Moderately Active (3-5 days)</option>
                <option value="1.725">Very Active (6-7 days)</option>
                <option value="1.9">Extra Active (training)</option>
              </select>
            </div>
          </div>

          <div className="form-group mt-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: '600', letterSpacing: '0.05em', margin: 0, opacity: 0.8 }}>
                WEEKLY WEIGHT LOSS GOAL
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.4rem 1rem',
                  fontSize: '1.2rem',
                  fontWeight: '600',
                  minWidth: '70px',
                  textAlign: 'center',
                }}>
                  {profile.weeklyLossGoal.toFixed(1)}
                </div>
                <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>kg</span>
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
                onChange={e => setProfile({ ...profile, weeklyLossGoal: Number(e.target.value) })}
              />
            </div>
          </div>

          <button disabled={saving} type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '2rem', padding: '1rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: '600' }}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      {!latestWeight && (
        <p className="mt-4" style={{ opacity: 0.5, fontSize: '0.85rem', textAlign: 'center' }}>
          * Record your weight in the Diet Log to unlock TDEE calculations.
        </p>
      )}

      {/* Logout Card */}
      <div className="card" style={{ padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-color)', marginTop: '2rem' }}>
        <button
          onClick={handleLogout}
          className="btn"
          style={{
            width: '100%',
            padding: '1rem',
            borderRadius: '12px',
            fontSize: '1.1rem',
            fontWeight: '600',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)'
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
