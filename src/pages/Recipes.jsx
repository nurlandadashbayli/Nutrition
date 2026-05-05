import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function Recipes() {
  const [foods, setFoods] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null); // 'Milkshake' or 'Custom'
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customRecipeName, setCustomRecipeName] = useState('');
  const [templates, setTemplates] = useState([]);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTemplateIngredients, setNewTemplateIngredients] = useState([
    { label: 'Ingredient 1', tag: '' }
  ]);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [selectedIcon, setSelectedIcon] = useState('🍱');

  const COMMON_EMOJIS = ['🍱', '🥤', '☕️', '🥗', '🥣', '🥪', '🍳', '🥞', '🍕', '🍔', '🌮', '🍣', '🍎', '🍌', '🥝', '🫐', '🥑', '🥦', '🍗', '🥩'];
  
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      fetchFoods();
      fetchTemplates();
    }
  }, [currentUser]);

  async function fetchTemplates() {
    try {
      const q = query(collection(db, 'recipeTemplates'), where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      const templateList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTemplates(templateList);
    } catch (err) {
      console.error(err);
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
    }
  }

  const startRecipe = (recipe) => {
    // It's a saved template
    setSelectedRecipe(recipe);
    setIngredients(recipe.ingredients.map((ing, idx) => ({
      id: idx,
      food: null,
      weight: 0,
      tag: ing.tag,
      label: ing.label
    })));
    setCustomRecipeName(recipe.name);
  };

  async function loadSampleTemplates() {
    try {
      setLoading(true);
      const milkshake = {
        userId: currentUser.uid,
        name: 'Milkshake',
        icon: '🥤',
        ingredients: [
          { label: 'Milk Base', tag: 'milk' },
          { label: 'Fruit', tag: 'fruit' },
          { label: 'Protein / Whey', tag: 'whey' }
        ],
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'recipeTemplates'), milkshake);
      fetchTemplates();
      setMessage('Sample template loaded!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Failed to load sample');
    } finally {
      setLoading(false);
    }
  }

  async function deleteTemplate(e, id) {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'recipeTemplates', id));
      fetchTemplates();
      setMessage('Template deleted');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Failed to delete template');
    } finally {
      setLoading(false);
    }
  }

  function editTemplate(e, template) {
    e.stopPropagation();
    setIsCreatingTemplate(true);
    setEditingTemplateId(template.id);
    setCustomRecipeName(template.name);
    setSelectedIcon(template.icon || '🍱');
    setNewTemplateIngredients(template.ingredients);
  }

  async function saveTemplate() {
    if (!customRecipeName || newTemplateIngredients.length === 0) {
      setMessage('Please enter a name and at least one ingredient');
      return;
    }
    try {
      setLoading(true);
      const templateData = {
        userId: currentUser.uid,
        name: customRecipeName,
        icon: selectedIcon,
        ingredients: newTemplateIngredients,
        updatedAt: new Date().toISOString()
      };

      if (editingTemplateId) {
        await updateDoc(doc(db, 'recipeTemplates', editingTemplateId), templateData);
        setMessage('Template updated!');
      } else {
        await addDoc(collection(db, 'recipeTemplates'), {
          ...templateData,
          createdAt: new Date().toISOString()
        });
        setMessage('Template saved!');
      }

      setIsCreatingTemplate(false);
      setEditingTemplateId(null);
      setCustomRecipeName('');
      setSelectedIcon('🍱');
      setNewTemplateIngredients([{ label: 'Ingredient 1', tag: '' }]);
      fetchTemplates();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Failed to save template');
    } finally {
      setLoading(false);
    }
  }

  const addIngredient = () => {
    setIngredients(prev => [...prev, { id: Date.now(), food: null, weight: 0, tag: '', label: `Ingredient ${prev.length + 1}` }]);
  };

  const removeIngredient = (id) => {
    setIngredients(prev => prev.filter(item => item.id !== id));
  };

  const handleIngredientChange = (id, foodId) => {
    const food = foods.find(f => f.id === foodId);
    setIngredients(prev => prev.map(item => item.id === id ? { ...item, food } : item));
  };

  const handleTagChange = (id, tag) => {
    setIngredients(prev => prev.map(item => item.id === id ? { ...item, tag, food: null } : item));
  };

  const handleWeightChange = (id, weight) => {
    setIngredients(prev => prev.map(item => item.id === id ? { ...item, weight: Number(weight) } : item));
  };

  const calculateTotal = () => {
    let total = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    ingredients.forEach(item => {
      if (item.food) {
        const servingSizeNum = parseFloat(item.food.servingSize) || 100;
        const ratio = item.weight / servingSizeNum;
        total.calories += item.food.calories * ratio;
        total.protein += item.food.protein * ratio;
        total.carbs += (item.food.carbs || 0) * ratio;
        total.fat += (item.food.fat || 0) * ratio;
      }
    });
    return total;
  };

  const totals = calculateTotal();

  async function addToLog() {
    if (!totals.calories) return;
    try {
      setLoading(true);
      const foodNames = ingredients.filter(i => i.food).map(i => i.food.name);

      const intakeData = {
        userId: currentUser.uid,
        date,
        foodName: `${customRecipeName} (${foodNames.join(' + ')})`,
        servingSize: 'Custom Recipe',
        servings: 1,
        totalCalories: Math.round(totals.calories),
        totalProtein: Math.round(totals.protein * 10) / 10,
        totalCarbs: Math.round(totals.carbs * 10) / 10,
        totalFat: Math.round(totals.fat * 10) / 10,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'logs'), intakeData);
      setMessage('Added to Intake Log!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Failed to add to log.');
    } finally {
      setLoading(false);
    }
  }

  const getFoodsByTag = (tag) => {
    if (!tag) return foods;
    return foods.filter(f => f.tags && f.tags.includes(tag.toLowerCase()));
  };

  const allTags = Array.from(new Set(foods.flatMap(f => f.tags || []))).sort();

  return (
    <div className="recipes-page">
      {!selectedRecipe && !isCreatingTemplate ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Recipes</h2>
            <input 
              type="date" 
              className="form-control" 
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              style={{ width: 'auto', height: '48px', padding: '0 0.75rem' }}
            />
          </div>
          <div className="recipe-grid">
            {templates.map(template => (
              <div key={template.id} className="recipe-card" onClick={() => startRecipe(template)} style={{ position: 'relative' }}>
                <div className="recipe-card-actions">
                  <button className="card-action-btn" onClick={(e) => editTemplate(e, template)} title="Edit">✎</button>
                  <button className="card-action-btn delete" onClick={(e) => deleteTemplate(e, template.id)} title="Delete">✕</button>
                </div>
                <div className="icon">{template.icon || '🍱'}</div>
                <span>{template.name}</span>
              </div>
            ))}
            <div className="recipe-card add-new" onClick={() => setIsCreatingTemplate(true)}>
              <div className="icon">➕</div>
              <span>Create New Template</span>
            </div>
          </div>
          {templates.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '3rem' }}>
              <button className="btn btn-outline" onClick={loadSampleTemplates} disabled={loading} style={{ width: 'auto' }}>
                Load Sample Templates (e.g. Milkshake)
              </button>
            </div>
          )}
        </>
      ) : isCreatingTemplate ? (
        <div className="builder-view">
          <div className="builder-header">
            <div style={{ flex: 1 }}>
              <input 
                type="text" 
                className="form-control" 
                placeholder={editingTemplateId ? "Update Name" : "Template Name (e.g. Coffee)"}
                value={customRecipeName} 
                onChange={(e) => setCustomRecipeName(e.target.value)}
                style={{ fontSize: '1.5rem', fontWeight: 'bold', border: 'none', padding: 0, background: 'transparent', boxShadow: 'none' }}
              />
              <p style={{ opacity: 0.6, fontSize: '0.85rem', margin: 0 }}>
                {editingTemplateId ? 'Updating template structure' : 'Define your recipe structure'}
              </p>
            </div>
            <button className="btn btn-outline" style={{ width: 'auto' }} onClick={() => {
              setIsCreatingTemplate(false);
              setEditingTemplateId(null);
              setCustomRecipeName('');
              setSelectedIcon('🍱');
              setNewTemplateIngredients([{ label: 'Ingredient 1', tag: '' }]);
            }}>Cancel</button>
          </div>

          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <label className="form-label">Choose Icon</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginTop: '0.5rem' }}>
              {COMMON_EMOJIS.map(emoji => (
                <button 
                  key={emoji} 
                  className={`card-action-btn ${selectedIcon === emoji ? 'active' : ''}`}
                  onClick={() => setSelectedIcon(emoji)}
                  style={{ width: '40px', height: '40px', fontSize: '1.25rem', borderColor: selectedIcon === emoji ? 'var(--primary-color)' : 'var(--border-color)', background: selectedIcon === emoji ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent' }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="ingredients-list">
            {newTemplateIngredients.map((item, index) => (
              <div key={index} className="ingredient-item">
                <button className="remove-ingredient" onClick={() => setNewTemplateIngredients(prev => prev.filter((_, i) => i !== index))}>✕</button>
                <div className="flex-group" style={{ gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Ingredient Label (e.g. Milk)" 
                    value={item.label}
                    onChange={(e) => {
                      const updated = [...newTemplateIngredients];
                      updated[index].label = e.target.value;
                      setNewTemplateIngredients(updated);
                    }}
                    style={{ flex: 1 }}
                  />
                  <select 
                    className="form-control" 
                    value={item.tag}
                    onChange={(e) => {
                      const updated = [...newTemplateIngredients];
                      updated[index].tag = e.target.value;
                      setNewTemplateIngredients(updated);
                    }}
                    style={{ flex: 1 }}
                  >
                    <option value="">Filter by Tag (Optional)</option>
                    {allTags.map(tag => (
                      <option key={tag} value={tag}>{tag.charAt(0).toUpperCase() + tag.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <button className="add-ingredient-btn" onClick={() => setNewTemplateIngredients([...newTemplateIngredients, { label: `Ingredient ${newTemplateIngredients.length + 1}`, tag: '' }])}>
            <span>+</span> Add Another Ingredient Slot
          </button>

          <div className="recipe-summary-floating">
            <button 
              className="btn btn-primary" 
              onClick={saveTemplate}
              disabled={loading || !customRecipeName}
            >
              {loading ? 'Saving...' : editingTemplateId ? 'Update Template' : 'Save Recipe Template'}
            </button>
            {message && <p className="text-center mt-2" style={{ color: 'var(--accent-color)', fontWeight: '500' }}>{message}</p>}
          </div>
        </div>
      ) : (
        <div className="builder-view">
          <div className="builder-header">
            <div>
              <h2 style={{ margin: 0 }}>{selectedRecipe.name} Builder</h2>
              <p style={{ opacity: 0.6, fontSize: '0.85rem', margin: 0 }}>Log for {date}</p>
            </div>
            <button className="btn btn-outline" style={{ width: 'auto' }} onClick={() => setSelectedRecipe(null)}>Back</button>
          </div>

          <div className="ingredients-list">
            {ingredients.map((item, index) => (
              <div key={item.id} className="ingredient-item">
                <button className="remove-ingredient" onClick={() => removeIngredient(item.id)}>✕</button>
                <label className="form-label">
                  {item.tag ? (item.tag.charAt(0).toUpperCase() + item.tag.slice(1)) : (item.label || `Ingredient ${index + 1}`)}
                </label>
                <div className="flex-group" style={{ gap: '0.5rem' }}>
                  <select 
                    className="form-control" 
                    onChange={(e) => {
                      // Custom builder needs to handle tag filtering too for one-off additions
                      handleIngredientChange(item.id, e.target.value);
                    }}
                    value={item.food?.id || ''}
                    style={{ flex: 3 }}
                  >
                    <option value="">Select {item.tag || 'Food'}</option>
                    {getFoodsByTag(item.tag).map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <div style={{ position: 'relative', flex: 1.2 }}>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={item.weight || ''} 
                      onChange={(e) => handleWeightChange(item.id, e.target.value)}
                      placeholder="0"
                    />
                    <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, fontSize: '0.75rem' }}>g</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button className="add-ingredient-btn" onClick={addIngredient}>
            <span>+</span> Add Custom Ingredient
          </button>

          <div className="recipe-summary-floating">
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              textAlign: 'center', 
              marginBottom: '1.5rem',
              gap: '0.5rem'
            }}>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{Math.round(totals.calories)}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>kcal</div>
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{Math.round(totals.protein * 10) / 10}g</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>P</div>
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{Math.round(totals.carbs * 10) / 10}g</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>C</div>
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{Math.round(totals.fat * 10) / 10}g</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>F</div>
              </div>
            </div>
            
            <button 
              className="btn btn-primary" 
              onClick={addToLog}
              disabled={loading || !totals.calories}
            >
              {loading ? 'Adding...' : 'Add to Daily Intake'}
            </button>
            {message && <p className="text-center mt-2" style={{ color: 'var(--accent-color)', fontWeight: '500' }}>{message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
