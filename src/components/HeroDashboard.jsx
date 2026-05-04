import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

const getLocalDateString = (d = new Date()) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function HeroDashboard() {
  const { currentUser } = useAuth();
  const [dietData, setDietData] = useState(null);
  const [weightData, setWeightData] = useState(null);
  const [workoutData, setWorkoutData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeCard, setActiveCard] = useState(0);
  const cardsRef = useRef(null);

  const today = getLocalDateString();

  useEffect(() => {
    if (currentUser) fetchAll();
  }, [currentUser]);

  const handleScroll = useCallback(() => {
    const container = cardsRef.current;
    if (!container || !container.firstElementChild) return;
    const cardWidth = container.firstElementChild.offsetWidth;
    const gap = 16;
    const index = Math.round(container.scrollLeft / (cardWidth + gap));
    setActiveCard(Math.min(index, 2));
  }, []);

  const scrollToCard = (index) => {
    const container = cardsRef.current;
    if (!container || !container.firstElementChild) return;
    const cardWidth = container.firstElementChild.offsetWidth;
    const gap = 16;
    container.scrollTo({ left: index * (cardWidth + gap), behavior: 'smooth' });
  };

  async function fetchAll() {
    try {
      const profSnap = await getDoc(doc(db, 'profiles', currentUser.uid));
      const profData = profSnap.exists() ? profSnap.data() : null;
      setProfile(profData);

      const logsQ = query(collection(db, 'logs'), where('userId', '==', currentUser.uid), where('date', '==', today));
      const logsSnap = await getDocs(logsQ);
      const logs = logsSnap.docs.map(d => d.data());
      const totalCal = logs.reduce((s, l) => s + (l.totalCalories || 0), 0);
      const totalProtein = logs.reduce((s, l) => s + (l.totalProtein || 0), 0);
      const totalCarbs = logs.reduce((s, l) => s + (l.totalCarbs || 0), 0);
      const totalFat = logs.reduce((s, l) => s + (l.totalFat || 0), 0);

      const weightsQ = query(collection(db, 'weights'), where('userId', '==', currentUser.uid));
      const weightsSnap = await getDocs(weightsQ);
      const allWeights = weightsSnap.docs.map(d => d.data());
      allWeights.sort((a, b) => b.date.localeCompare(a.date));
      const latestWeight = allWeights.length > 0 ? allWeights[0] : null;
      const todayWeight = allWeights.find(w => w.date === today);

      let targetCal = 2400;
      let targetProtein = 150;
      if (profData && latestWeight) {
        const birthDate = new Date(profData.birthday);
        const now = new Date();
        let age = now.getFullYear() - birthDate.getFullYear();
        if (now.getMonth() < birthDate.getMonth() || (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate())) age--;
        const h = Number(profData.height);
        const w = latestWeight.weight;
        let bmr = profData.gender === 'male' ? 10 * w + 6.25 * h - 5 * age + 5 : 10 * w + 6.25 * h - 5 * age - 161;
        const tdee = Math.round(bmr * Number(profData.activityLevel));
        const weeklyGoal = profData.weeklyLossGoal ?? 0.5;
        targetCal = Math.round(tdee - weeklyGoal * 1100);
        targetProtein = Math.round(w * 2.2);
      }

      setDietData({
        calories: Math.round(totalCal),
        targetCalories: targetCal,
        protein: Math.round(totalProtein),
        targetProtein,
        carbs: Math.round(totalCarbs),
        fat: Math.round(totalFat),
        logCount: logs.length
      });

      const last7 = allWeights.slice(0, 7).reverse();
      const weekAgoWeight = last7.length > 1 ? last7[0].weight : null;
      const currentWeight = latestWeight ? latestWeight.weight : null;
      const weekDelta = weekAgoWeight && currentWeight ? (currentWeight - weekAgoWeight).toFixed(1) : null;
      setWeightData({
        current: currentWeight,
        todayLogged: !!todayWeight,
        weekDelta,
        trend: last7.map(w => w.weight),
        latestDate: latestWeight ? latestWeight.date : null
      });

      const workQ = query(collection(db, 'workoutLogs'), where('userId', '==', currentUser.uid), where('date', '==', today));
      const workSnap = await getDocs(workQ);
      const workLogs = workSnap.docs.map(d => d.data()).filter(l => l.exerciseName && Array.isArray(l.sets));
      const totalSets = workLogs.reduce((s, l) => s + l.sets.length, 0);
      const totalVolume = workLogs.reduce((s, l) => s + l.sets.reduce((a, set) => a + Number(set.weight) * Number(set.reps), 0), 0);
      const exerciseNames = [...new Set(workLogs.map(l => l.exerciseName))];
      setWorkoutData({
        exercises: exerciseNames.length,
        sets: totalSets,
        volume: totalVolume,
        names: exerciseNames
      });
    } catch (err) {
      console.error('HeroDashboard fetch error:', err);
    }
  }

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const Sparkline = ({ data, color = '#3b82f6' }) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data) * 0.998;
    const max = Math.max(...data) * 1.002;
    const range = max - min || 1;
    const w = 140;
    const h = 50;
    const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {(() => {
          const lastX = w;
          const lastY = h - ((data[data.length - 1] - min) / range) * h;
          return <circle cx={lastX} cy={lastY} r="4" fill={color} />;
        })()}
      </svg>
    );
  };

  const CircularProgress = ({ value, max, color = '#3b82f6', size = 110, strokeWidth = 7 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const pct = Math.min(value / max, 1);
    const offset = circumference - pct * circumference;
    return (
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--hero-muted)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
    );
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const cardLabels = ['Diet', 'Weight', 'Workout'];

  return (
    <div className="hero-dashboard">
      <div className="hero-header">
        <h1 className="hero-greeting">{greeting()} 👋</h1>
        <p className="hero-date">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="hero-cards" ref={cardsRef} onScroll={handleScroll}>
        {/* Diet Card */}
        <div className="hero-card" onClick={() => scrollTo('diet')}>
          <div className="hero-card-header">
            <div className="hero-card-icon">🍽️</div>
            <span className="hero-card-title">Diet</span>
          </div>
          {dietData ? (
            <div className="hero-card-body">
              <div className="hero-card-main-row">
                <div className="hero-card-ring">
                  <CircularProgress value={dietData.calories} max={dietData.targetCalories} color="#3b82f6" />
                  <div className="hero-ring-label">
                    <span className="hero-ring-value">{dietData.calories}</span>
                    <span className="hero-ring-unit">kcal</span>
                  </div>
                </div>
                <div className="hero-card-stats">
                  <div className="hero-stat">
                    <span className="hero-stat-dot" style={{ background: '#6CA34D' }}></span>
                    <span className="hero-stat-label">Protein</span>
                    <span className="hero-stat-value">{dietData.protein}g</span>
                  </div>
                  <div className="hero-stat">
                    <span className="hero-stat-dot" style={{ background: '#E47A2E' }}></span>
                    <span className="hero-stat-label">Carbs</span>
                    <span className="hero-stat-value">{dietData.carbs}g</span>
                  </div>
                  <div className="hero-stat">
                    <span className="hero-stat-dot" style={{ background: '#F3B605' }}></span>
                    <span className="hero-stat-label">Fat</span>
                    <span className="hero-stat-value">{dietData.fat}g</span>
                  </div>
                </div>
              </div>
              <div className="hero-card-footer">
                <span>{Math.max(0, dietData.targetCalories - dietData.calories)} kcal remaining</span>
                <span>{dietData.logCount} entries</span>
              </div>
            </div>
          ) : (
            <div className="hero-card-loading">Loading...</div>
          )}
        </div>

        {/* Weight Card */}
        <div className="hero-card" onClick={() => scrollTo('weight')}>
          <div className="hero-card-header">
            <div className="hero-card-icon">⚖️</div>
            <span className="hero-card-title">Weight</span>
          </div>
          {weightData ? (
            <div className="hero-card-body">
              <div className="hero-card-main-row">
                <div>
                  <div className="hero-weight-number">{weightData.current ?? '—'}<span className="hero-weight-unit"> kg</span></div>
                  {weightData.weekDelta !== null && (
                    <div className={`hero-weight-delta ${Number(weightData.weekDelta) <= 0 ? 'positive' : 'negative'}`}>
                      {Number(weightData.weekDelta) > 0 ? '+' : ''}{weightData.weekDelta} kg this week
                    </div>
                  )}
                </div>
                <div className="hero-sparkline">
                  <Sparkline data={weightData.trend} color={Number(weightData.weekDelta) <= 0 ? '#10b981' : '#ef4444'} />
                </div>
              </div>
              <div className="hero-card-footer">
                <span>{weightData.todayLogged ? '✓ Logged today' : '○ Not logged today'}</span>
                <span>{weightData.trend.length} entries</span>
              </div>
            </div>
          ) : (
            <div className="hero-card-loading">Loading...</div>
          )}
        </div>

        {/* Workout Card */}
        <div className="hero-card" onClick={() => scrollTo('workout')}>
          <div className="hero-card-header">
            <div className="hero-card-icon">💪</div>
            <span className="hero-card-title">Workout</span>
          </div>
          {workoutData ? (
            <div className="hero-card-body">
              <div className="hero-workout-stats">
                <div className="hero-workout-stat">
                  <span className="hero-workout-big">{workoutData.exercises}</span>
                  <span className="hero-workout-label">Exercises</span>
                </div>
                <div className="hero-workout-divider"></div>
                <div className="hero-workout-stat">
                  <span className="hero-workout-big">{workoutData.sets}</span>
                  <span className="hero-workout-label">Sets</span>
                </div>
                <div className="hero-workout-divider"></div>
                <div className="hero-workout-stat">
                  <span className="hero-workout-big">{workoutData.volume > 999 ? `${(workoutData.volume / 1000).toFixed(1)}k` : workoutData.volume}</span>
                  <span className="hero-workout-label">Volume (kg)</span>
                </div>
              </div>
              <div className="hero-card-footer">
                {workoutData.names.length > 0 ? (
                  <span>{workoutData.names.join(', ')}</span>
                ) : (
                  <span>No workout today</span>
                )}
              </div>
            </div>
          ) : (
            <div className="hero-card-loading">Loading...</div>
          )}
        </div>
      </div>

      <div className="hero-dots">
        {cardLabels.map((label, i) => (
          <button key={label} className={`hero-dot ${activeCard === i ? 'active' : ''}`} onClick={() => scrollToCard(i)} aria-label={label} />
        ))}
      </div>
    </div>
  );
}
