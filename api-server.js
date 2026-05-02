import { createServer } from 'http';

// Configuration from Environment Variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  projectId: process.env.FIREBASE_PROJECT_ID,
};

// Check if variables exist
const missingKeys = Object.entries(firebaseConfig)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0) {
  console.error(`❌ Error: Missing Environment Variables: ${missingKeys.join(', ')}`);
  process.exit(1);
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Wake up endpoint
  if (req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'awake' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/update-weight') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { username, password, date, weight } = data;

        if (!username || !password || !date || !weight) {
          console.error('❌ Missing fields:', { username: !!username, password: !!password, date, weight });
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields: username (email), password, date, weight' }));
          return;
        }

        console.log(`⏳ Attempting login for: ${username}`);

        // 1. Authenticate user via REST API
        const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`;
        const authRes = await fetch(authUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: username, password, returnSecureToken: true })
        });
        const authData = await authRes.json();

        if (!authRes.ok) {
           throw new Error(authData.error?.message || 'Authentication failed');
        }
        
        const idToken = authData.idToken;
        const localId = authData.localId; // This is the userId
        console.log(`✅ Login successful for UID: ${localId}`);

        // 2. We don't need to check if it exists, we can use a custom Document ID and PATCH it.
        // Document ID format: userId_date
        const docId = `${localId}_${date}`;
        
        console.log(`⏳ Updating weight on date: ${date}`);

        // Firestore REST API URL
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/weights/${docId}`;
        
        // Use PATCH to create or update
        const updateRes = await fetch(firestoreUrl, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            fields: {
              userId: { stringValue: localId },
              date: { stringValue: date },
              weight: { doubleValue: Number(weight) },
              updatedAt: { stringValue: new Date().toISOString() },
              createdAt: { stringValue: new Date().toISOString() } // It's okay if this overwrites on update for simplicity
            }
          })
        });

        if (!updateRes.ok) {
            const errData = await updateRes.json();
            throw new Error(errData.error?.message || 'Failed to update Firestore');
        }

        console.log(`✨ Successfully updated weight for ${date}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Weight updated to ${weight} for ${date}` }));
      } catch (error) {
        console.error('Error:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
});
