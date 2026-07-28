import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import fs from "fs";

const envStr = fs.readFileSync(".env", "utf8");
const env = {};
envStr.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fix() {
  const updates = [
    { id: 'ZdMXQxpWoAO1FJYVoiJ9', categoryId: 'Gf1fL7YlE6CH3CdUHGLy' }, // Food
    { id: 'dbMY9bVor2LcHbjrcf24', categoryId: 'Gf1fL7YlE6CH3CdUHGLy' }, // Food
    { id: 'gSstm2XEp1IBiawtbRrA', categoryId: 'Gf1fL7YlE6CH3CdUHGLy' }, // Food
    { id: 'zaxwrwmrh1qpxQs6Z6TP', categoryId: 'S2h9MbUcXuCeUf38YC6e' }  // Entertainment
  ];

  for (const u of updates) {
    await updateDoc(doc(db, "transactions", u.id), { categoryId: u.categoryId });
    console.log(`Updated transaction ${u.id} to category ${u.categoryId}`);
  }
  
  process.exit(0);
}

fix().catch(console.error);
