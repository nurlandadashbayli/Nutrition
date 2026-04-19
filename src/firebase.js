import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
export const auth = getAuth(app);
export const db = getFirestore(app);
