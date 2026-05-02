import { createServer } from 'http';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';

// Configuration from Environment Variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Check if variables exist
const missingKeys = Object.entries(firebaseConfig)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0) {
  console.error(`❌ Error: Missing Environment Variables: ${missingKeys.join(', ')}`);
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
setPersistence(auth, inMemoryPersistence);
const db = getFirestore(app);

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

        // Authenticate user
        const userCredential = await signInWithEmailAndPassword(auth, username, password);
        const user = userCredential.user;
        
        console.log(`✅ Login successful for UID: ${user.uid}`);
        console.log(`⏳ Checking for existing weight on date: ${date}`);

        // Check if weight for this date exists
        const q = query(
          collection(db, 'weights'),
          where('userId', '==', user.uid),
          where('date', '==', date)
        );
        const querySnapshot = await getDocs(q);

        const weightData = {
          userId: user.uid,
          date: date,
          weight: Number(weight),
          updatedAt: new Date().toISOString()
        };

        if (!querySnapshot.empty) {
          // Update existing entry
          const docId = querySnapshot.docs[0].id;
          await updateDoc(doc(db, 'weights', docId), weightData);
          console.log(`✨ Updated existing weight for ${date}`);
        } else {
          // Add new entry
          weightData.createdAt = new Date().toISOString();
          await addDoc(collection(db, 'weights'), weightData);
          console.log(`✨ Created new weight entry for ${date}`);
        }

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
