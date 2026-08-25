import { initializeApp, getApps } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDzyDZxtkn6qBW94fuof4CsRm53FFEVcho",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "expense-tracker-321ba.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "expense-tracker-321ba",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "expense-tracker-321ba.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "611669328733",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:611669328733:web:c09579cfa91d9aecff1eb4"
};

let app;
let auth;
let db;
let googleProvider;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

export { 
  app, 
  auth, 
  db, 
  googleProvider,
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged 
};
