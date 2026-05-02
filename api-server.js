import { createServer } from 'http';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCmJFFC4KjAtO6LeiguFnKu8ebSWHOISEQ",
  authDomain: "nutrition-faebd.firebaseapp.com",
  projectId: "nutrition-faebd",
  storageBucket: "nutrition-faebd.firebasestorage.app",
  messagingSenderId: "1036063379439",
  appId: "1:1036063379439:web:3e36b3e04f2f1e898b701a",
  measurementId: "G-JZJ9GN9GB7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
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
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields: username (email), password, date, weight' }));
          return;
        }

        console.log(`Received request to update weight for ${username} on ${date} to ${weight}kg`);

        // Authenticate user
        const userCredential = await signInWithEmailAndPassword(auth, username, password);
        const user = userCredential.user;

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
          console.log(`Updated existing weight entry for ${date}`);
        } else {
          // Add new entry
          weightData.createdAt = new Date().toISOString();
          await addDoc(collection(db, 'weights'), weightData);
          console.log(`Created new weight entry for ${date}`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Weight updated to ${weight} for ${date}` }));
      } catch (error) {
        console.error('Error processing request:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found. Use POST /update-weight' }));
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`\n=========================================`);
  console.log(`🏋️ Weight API Server Running!`);
  console.log(`URL: http://localhost:${PORT}/update-weight`);
  console.log(`=========================================\n`);
  console.log(`Example usage with curl:`);
  console.log(`curl -X POST http://localhost:${PORT}/update-weight \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"username":"your-email@example.com", "password":"your-password", "date":"2026-05-02", "weight":75.5}'\n`);
});
