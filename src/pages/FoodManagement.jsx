import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import CollapsibleCard from '../components/CollapsibleCard';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function FoodManagement() {
  const [foods, setFoods] = useState([]);
  const [name, setName] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      fetchFoods();
    }
  }, [currentUser]);

  useEffect(() => {
    let scanner = null;
    if (isScanning) {
      scanner = new Html5QrcodeScanner('reader', {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true
      }, false);

      scanner.render((decodedText) => {
        handleBarcodeScanned(decodedText);
        scanner.clear().catch(err => console.error("Failed to clear scanner", err));
        setIsScanning(false);
      }, (error) => {
        // console.warn(error);
      });
    }
    return () => {
      if (scanner) {
        scanner.clear().catch(err => console.error("Cleanup error", err));
      }
    };
  }, [isScanning]);

  async function handleBarcodeScanned(barcode) {
    try {
      setScanStatus('Searching for product...');
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();
      
      if (data.status === 1) {
        const product = data.product;
        setName(product.product_name || '');
        setServingSize(product.serving_size || '100g');
        
        // Open Food Facts nutriments are usually per 100g
        const nutriments = product.nutriments;
        setCalories(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || '');
        setProtein(nutriments.proteins_100g || nutriments.proteins || '');
        setFat(nutriments.fat_100g || nutriments.fat || '');
        setCarbs(nutriments.carbohydrates_100g || nutriments.carbohydrates || '');
        setScanStatus('');
      } else {
        setError('Product not found in Open Food Facts database.');
        setScanStatus('');
      }
    } catch (err) {
      console.error('Barcode fetch error:', err);
      setError('Failed to fetch product data.');
      setScanStatus('');
    }
  }

  async function fetchFoods() {
    try {
      const q = query(collection(db, 'foods'), where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      const foodList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      foodList.sort((a, b) => a.name.localeCompare(b.name));
      setFoods(foodList);
    } catch (err) {
      console.error(err);
      setError('Failed to load foods.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name || !servingSize || calories === '' || protein === '' || fat === '' || carbs === '') return;

    try {
      setError('');
      setLoading(true);
      
      const tagsArray = tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag !== '');

      const foodData = {
        userId: currentUser.uid,
        name,
        servingSize,
        calories: Number(calories),
        protein: Number(protein),
        fat: Number(fat),
        carbs: Number(carbs),
        tags: tagsArray
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
      setCarbs('');
      setTags('');
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
    setCarbs(food.carbs !== undefined ? food.carbs : 0);
    setTags(food.tags ? food.tags.join(', ') : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setName('');
    setServingSize('');
    setCalories('');
    setProtein('');
    setFat('');
    setCarbs('');
    setTags('');
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

  async function handleExportData() {
    try {
      setLoading(true);
      setError('');
      const q = query(collection(db, 'logs'), where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      const logList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          date: data.date,
          foodName: data.foodName,
          servingSize: data.servingSize,
          weight: data.weight,
          totalCalories: data.totalCalories,
          totalProtein: data.totalProtein,
          totalCarbs: data.totalCarbs,
          totalFat: data.totalFat,
          createdAt: data.createdAt
        };
      });

      const exportData = {
        foods: foods.map(f => ({
          name: f.name,
          servingSize: f.servingSize,
          calories: f.calories,
          protein: f.protein,
          fat: f.fat,
          carbs: f.carbs,
          tags: f.tags
        })),
        intakes: logList
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nutrition_data_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError('Failed to export data.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="card">
        <h2>{editingId ? 'Edit Food' : 'Add New Food'}</h2>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Food Name (e.g., Quark)
              <button 
                type="button" 
                onClick={() => setIsScanning(true)} 
                className="btn btn-outline"
                style={{ padding: '4px 8px', height: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
              >
                <span role="img" aria-label="camera">📷</span> Scan Barcode
              </button>
            </label>
            <input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          {scanStatus && <div style={{ fontSize: '0.8rem', color: 'var(--primary-color)', marginBottom: '1rem' }}>{scanStatus}</div>}
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
              <label className="form-label">Carbs (g)</label>
              <input type="number" className="form-control" value={carbs} onChange={e => setCarbs(e.target.value)} required min="0" step="0.1" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Fat (g)</label>
              <input type="number" className="form-control" value={fat} onChange={e => setFat(e.target.value)} required min="0" step="0.1" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Tags (e.g., milk, fruit, whey - comma separated)</label>
            <input type="text" className="form-control" value={tags} onChange={e => setTags(e.target.value)} placeholder="milk, fruit, whey" />
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

      <CollapsibleCard title="Your Foods" count={foods.length}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button onClick={handleExportData} className="btn btn-outline" disabled={loading}>
            {loading ? 'Exporting...' : 'Export Data (JSON)'}
          </button>
        </div>
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
                <th>Carbs (g)</th>
                <th>Fat (g)</th>
                <th>Tags</th>
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
                  <td>{food.carbs !== undefined ? food.carbs : '-'}</td>
                  <td>{food.fat !== undefined ? food.fat : '-'}</td>
                  <td>
                    {food.tags && food.tags.map(tag => (
                      <span key={tag} className="tag-badge">
                        {tag}
                      </span>
                    ))}
                  </td>
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
      </CollapsibleCard>

      {isScanning && (
        <div className="scanner-overlay" onClick={() => setIsScanning(false)}>
          <div className="scanner-container" onClick={e => e.stopPropagation()}>
            <div className="header-flex" style={{ marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Scan Barcode</h3>
              <button onClick={() => setIsScanning(false)} className="btn btn-outline" style={{ width: '40px', height: '40px', padding: 0 }}>×</button>
            </div>
            <div id="reader" style={{ width: '100%' }}></div>
            <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '1rem', textAlign: 'center' }}>
              Point the camera at the product's barcode
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
