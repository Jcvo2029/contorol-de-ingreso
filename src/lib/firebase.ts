// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAI1k22CsW3wt59HfwejTiGBvBMf2-yjg0",
  authDomain: "control-de-ingreso-641b9.firebaseapp.com",
  projectId: "control-de-ingreso-641b9",
  storageBucket: "control-de-ingreso-641b9.firebasestorage.app",
  messagingSenderId: "976708497064",
  appId: "1:976708497064:web:9423ab1467e27d9b801c9d"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };


