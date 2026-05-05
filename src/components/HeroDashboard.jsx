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

  // Drag-and-drop state for diet subcards
  const [dietWidgetOrder, setDietWidgetOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('dietWidgetOrder');
      return saved ? JSON.parse(saved) : ['ring', 'macros'];
    } catch { return ['ring', 'macros']; }
  });
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const handleDragStart = useCallback((e, id) => {
    dragItem.current = id;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Need a tiny timeout so the drag ghost renders properly
    setTimeout(() => e.target.classList.add('dragging'), 0);
  }, []);

  const handleDragOver = useCallback((e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverItem.current = id;
    setDragOverId(id);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const from = dragItem.current;
    const to = dragOverItem.current;
    if (from && to && from !== to) {
      setDietWidgetOrder(prev => {
        const newOrder = [...prev];
        const fromIdx = newOrder.indexOf(from);
        const toIdx = newOrder.indexOf(to);
        if (fromIdx !== -1 && toIdx !== -1) {
          [newOrder[fromIdx], newOrder[toIdx]] = [newOrder[toIdx], newOrder[fromIdx]];
        }
        localStorage.setItem('dietWidgetOrder', JSON.stringify(newOrder));
        return newOrder;
      });
    }
    dragItem.current = null;
    dragOverItem.current = null;
    setDraggingId(null);
    setDragOverId(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragItem.current = null;
    dragOverItem.current = null;
    setDraggingId(null);
    setDragOverId(null);
  }, []);
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
      allWeights.sort((a, b) => a.date.localeCompare(b.date));
      const latestWeight = allWeights.length > 0 ? allWeights[allWeights.length - 1] : null;
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

      // Get last 14 entries for the trend chart
      const last14 = allWeights.slice(-14);
      const last7ForDelta = allWeights.slice(-7);
      const weekAgoWeight = last7ForDelta.length > 1 ? last7ForDelta[0].weight : null;
      const currentWeight = latestWeight ? latestWeight.weight : null;
      const weekDelta = weekAgoWeight && currentWeight ? (currentWeight - weekAgoWeight).toFixed(1) : null;
      setWeightData({
        current: currentWeight,
        todayLogged: !!todayWeight,
        weekDelta,
        trend: last14.map(w => w.weight),
        trendDates: last14.map(w => w.date),
        totalEntries: allWeights.length,
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

  // Linear regression helper
  const linearRegression = (data) => {
    if (!data || data.length < 2) return null;
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    data.forEach((y, x) => {
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
  };

  const WeightTrendChart = ({ data, dates, color = '#3b82f6' }) => {
    if (!data || data.length < 2) return (
      <div style={{ textAlign: 'center', opacity: 0.4, padding: '1rem 0', fontSize: '0.875rem' }}>
        Need at least 2 entries to show trend
      </div>
    );

    const chartW = 200;
    const chartH = 110;
    const padLeft = 30;
    const padRight = 8;
    const padTop = 10;
    const padBottom = 20;
    const plotW = chartW - padLeft - padRight;
    const plotH = chartH - padTop - padBottom;

    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    // Add padding to range so points aren't at the very edges
    const valRange = maxVal - minVal || 1;
    const yMin = minVal - valRange * 0.15;
    const yMax = maxVal + valRange * 0.15;
    const yRange = yMax - yMin;

    const toX = (i) => padLeft + (i / (data.length - 1)) * plotW;
    const toY = (v) => padTop + plotH - ((v - yMin) / yRange) * plotH;

    // Data points polyline
    const dataPoints = data.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');

    // Gradient fill area
    const areaPoints = `${toX(0)},${padTop + plotH} ${dataPoints} ${toX(data.length - 1)},${padTop + plotH}`;

    // Linear regression line
    const reg = linearRegression(data);
    const regY0 = reg.intercept;
    const regY1 = reg.slope * (data.length - 1) + reg.intercept;

    // Y-axis labels (3 labels: min, mid, max)
    const yLabels = [
      { val: minVal, y: toY(minVal) },
      { val: (minVal + maxVal) / 2, y: toY((minVal + maxVal) / 2) },
      { val: maxVal, y: toY(maxVal) },
    ];

    // X-axis date labels (first, middle, last)
    const dateLabels = [];
    if (dates && dates.length > 0) {
      const fmt = (d) => {
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      };
      dateLabels.push({ label: fmt(dates[0]), x: toX(0) });
      if (dates.length > 2) {
        const midIdx = Math.floor(dates.length / 2);
        dateLabels.push({ label: fmt(dates[midIdx]), x: toX(midIdx) });
      }
      dateLabels.push({ label: fmt(dates[dates.length - 1]), x: toX(dates.length - 1) });
    }

    const trendGoingDown = reg.slope <= 0;
    const trendColor = trendGoingDown ? '#10b981' : '#ef4444';
    const gradId = 'weightGrad';

    // Per-week rate
    const perDay = reg.slope;
    const perWeek = (perDay * 7).toFixed(2);

    return (
      <div className="hero-weight-chart">
        <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines */}
          {yLabels.map((yl, i) => (
            <line key={i} x1={padLeft} y1={yl.y} x2={chartW - padRight} y2={yl.y}
              stroke="var(--hero-muted)" strokeWidth="0.5" strokeDasharray="4,3" />
          ))}

          {/* Y-axis labels */}
          {yLabels.map((yl, i) => (
            <text key={i} x={padLeft - 4} y={yl.y + 3} textAnchor="end"
              fontSize="7" fill="var(--hero-text)" opacity="0.5" fontFamily="inherit">
              {yl.val.toFixed(1)}
            </text>
          ))}

          {/* X-axis date labels */}
          {dateLabels.map((dl, i) => (
            <text key={i} x={dl.x} y={chartH - 3} textAnchor="middle"
              fontSize="7" fill="var(--hero-text)" opacity="0.45" fontFamily="inherit">
              {dl.label}
            </text>
          ))}

          {/* Gradient fill area under data line */}
          <polygon points={areaPoints} fill={`url(#${gradId})`} />

          {/* Data polyline */}
          <polyline points={dataPoints} fill="none" stroke={color} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />

          {/* Linear trend line */}
          <line x1={toX(0)} y1={toY(regY0)} x2={toX(data.length - 1)} y2={toY(regY1)}
            stroke={trendColor} strokeWidth="1" strokeDasharray="4,3" opacity="0.7" />

          {/* Data point dots */}
          {data.map((v, i) => (
            <circle key={i} cx={toX(i)} cy={toY(v)} r={i === data.length - 1 ? 3 : 1.8}
              fill={i === data.length - 1 ? color : 'var(--hero-bg)'}
              stroke={color} strokeWidth={i === data.length - 1 ? 0 : 1} />
          ))}
        </svg>
        <div className="hero-weight-trend-label">
          <span className="hero-weight-trend-line" style={{ borderColor: trendColor }} />
          <span style={{ color: trendColor }}>{perWeek > 0 ? '+' : ''}{perWeek} kg/week</span>
        </div>
      </div>
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
        <h1 className="hero-greeting">{greeting()}</h1>
        <p className="hero-date">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="hero-cards" ref={cardsRef} onScroll={handleScroll}>
        {/* Diet Card */}
        <div className="hero-card" onClick={() => scrollTo('diet')}>
          <div className="hero-card-header">
            <span className="hero-card-title">Diet</span>
          </div>
          {dietData ? (
            <div className="hero-card-body">
              <div className="hero-card-main-row">
                {dietWidgetOrder.map(id => {
                  const isRing = id === 'ring';
                  return (
                    <div
                      key={id}
                      draggable="true"
                      onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, id); }}
                      onDragOver={(e) => { e.stopPropagation(); handleDragOver(e, id); }}
                      onDragLeave={(e) => { e.stopPropagation(); handleDragLeave(e); }}
                      onDrop={(e) => { e.stopPropagation(); handleDrop(e); }}
                      onDragEnd={(e) => { e.stopPropagation(); handleDragEnd(e); }}
                      className={`hero-subcard ${isRing ? 'ring-widget' : 'diet-widget'} ${draggingId === id ? 'dragging' : ''} ${dragOverId === id && draggingId !== id ? 'drag-over' : ''}`}
                    >
                      {isRing ? (
                        <div className="hero-card-ring">
                          <CircularProgress value={dietData.calories} max={dietData.targetCalories} color="#3b82f6" />
                          <div className="hero-ring-label">
                            <span className="hero-ring-value">{dietData.calories}</span>
                            <span className="hero-ring-unit">kcal</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="subcard-row">
                            <div className="subcard-label">
                              <span className="subcard-dot" style={{ background: '#6CA34D' }}></span>
                              Protein
                            </div>
                            <div className="subcard-value">{dietData.protein}g</div>
                          </div>
                          <div className="subcard-row">
                            <div className="subcard-label">
                              <span className="subcard-dot" style={{ background: '#E47A2E' }}></span>
                              Carbs
                            </div>
                            <div className="subcard-value">{dietData.carbs}g</div>
                          </div>
                          <div className="subcard-row">
                            <div className="subcard-label">
                              <span className="subcard-dot" style={{ background: '#F3B605' }}></span>
                              Fat
                            </div>
                            <div className="subcard-value">{dietData.fat}g</div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
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
                <div className="hero-weight-inset">
                  <WeightTrendChart
                    data={weightData.trend}
                    dates={weightData.trendDates}
                    color={Number(weightData.weekDelta) <= 0 ? '#10b981' : '#3b82f6'}
                  />
                </div>
              </div>
              <div className="hero-card-footer">
                <span>{weightData.todayLogged ? '✓ Logged today' : '○ Not logged today'}</span>
                <span>{weightData.totalEntries} total entries</span>
              </div>
            </div>
          ) : (
            <div className="hero-card-loading">Loading...</div>
          )}
        </div>

        {/* Workout Card */}
        <div className="hero-card" onClick={() => scrollTo('workout')}>
          <div className="hero-card-header">
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
