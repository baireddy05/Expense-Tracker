import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, setDoc, writeBatch } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Only initialize if config is present, otherwise throw a helpful error
let app, db;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error) {
  console.warn("Firebase config is missing or invalid. Please check your .env file.");
}

export const DataService = {
  async getTransactions() {
    if (!db) return [];
    const querySnapshot = await getDocs(collection(db, "transactions"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async addTransaction(transaction) {
    if (!db) throw new Error("Firebase not initialized");
    const newTx = { ...transaction, createdAt: new Date().toISOString() };
    const docRef = await addDoc(collection(db, "transactions"), newTx);
    return { id: docRef.id, ...newTx };
  },

  async updateTransaction(id, updates) {
    if (!db) throw new Error("Firebase not initialized");
    const txRef = doc(db, "transactions", id);
    await updateDoc(txRef, updates);
    return { id, ...updates };
  },

  async deleteTransaction(id) {
    if (!db) throw new Error("Firebase not initialized");
    const txRef = doc(db, "transactions", id);
    await deleteDoc(txRef);
    return true;
  },

  async getCategories() {
    if (!db) return [];
    const querySnapshot = await getDocs(collection(db, "categories"));
    if (querySnapshot.empty) {
      // Seed default categories if none exist
      const defaultCategories = [
        { name: 'Food', color: '#ef4444', icon: 'fa-utensils', type: 'expense' },
        { name: 'Groceries', color: '#f97316', icon: 'fa-shopping-cart', type: 'expense' },
        { name: 'Travel', color: '#eab308', icon: 'fa-plane', type: 'expense' },
        { name: 'Entertainment', color: '#8b5cf6', icon: 'fa-film', type: 'expense' },
        { name: 'Medical', color: '#ec4899', icon: 'fa-notes-medical', type: 'expense' },
        { name: 'From Dad', color: '#22c55e', icon: 'fa-money-bill', type: 'income' },
        { name: 'Trading', color: '#10b981', icon: 'fa-chart-line', type: 'income' }
      ];
      const batch = writeBatch(db);
      const seeded = [];
      for (const cat of defaultCategories) {
        const docRef = doc(collection(db, "categories"));
        batch.set(docRef, cat);
        seeded.push({ id: docRef.id, ...cat });
      }
      await batch.commit();
      return seeded;
    }
    
    const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Deduplicate and cleanup database
    const unique = [];
    const seen = new Set();
    const duplicates = [];
    
    for (const d of docs) {
      const key = d.name + '|' + d.type;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(d);
      } else {
        duplicates.push(d);
      }
    }
    
    if (duplicates.length > 0) {
      Promise.all(duplicates.map(dup => deleteDoc(doc(db, "categories", dup.id))))
        .catch(console.error);
    }
    
    return unique;
  },

  async addCategory(category) {
    if (!db) throw new Error("Firebase not initialized");
    const docRef = await addDoc(collection(db, "categories"), category);
    return { id: docRef.id, ...category };
  },

  async getSettings() {
    if (!db) return { monthlyBudget: 0 };
    const querySnapshot = await getDocs(collection(db, "settings"));
    if (querySnapshot.empty) {
      const defaultSettings = { monthlyBudget: 0 };
      const docRef = doc(collection(db, "settings"), "global");
      await setDoc(docRef, defaultSettings);
      return { id: docRef.id, ...defaultSettings };
    }
    const docData = querySnapshot.docs[0];
    return { id: docData.id, ...docData.data() };
  },

  async updateSettings(id, updates) {
    if (!db) throw new Error("Firebase not initialized");
    const settingsRef = doc(db, "settings", id);
    await updateDoc(settingsRef, updates);
    return { id, ...updates };
  },

  async getLentRecords() {
    if (!db) {
      const local = localStorage.getItem('lent_records');
      return local ? JSON.parse(local) : [];
    }
    try {
      const querySnapshot = await getDocs(collection(db, "lent_records"));
      const records = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      localStorage.setItem('lent_records', JSON.stringify(records));
      return records;
    } catch (e) {
      console.warn("Failed to fetch lent records from Firestore, using local fallback", e);
      const local = localStorage.getItem('lent_records');
      return local ? JSON.parse(local) : [];
    }
  },

  async addLentRecord(record) {
    const amountVal = parseFloat(record.amount) || 0;
    const initialLoans = (record.loans && Array.isArray(record.loans) && record.loans.length > 0)
      ? record.loans
      : [
          {
            id: 'loan_' + Date.now(),
            amount: amountVal,
            date: record.dateLent || new Date().toISOString().split('T')[0],
            note: record.note ? record.note.trim() : 'Initial loan'
          }
        ];

    const newRecord = {
      ...record,
      amount: amountVal,
      returnedAmount: parseFloat(record.returnedAmount) || 0,
      repayments: record.repayments || [],
      loans: initialLoans,
      createdAt: new Date().toISOString()
    };

    if (!db) {
      const id = 'local_' + Date.now();
      const saved = { id, ...newRecord };
      const existing = JSON.parse(localStorage.getItem('lent_records') || '[]');
      existing.unshift(saved);
      localStorage.setItem('lent_records', JSON.stringify(existing));
      return saved;
    }

    try {
      const docRef = await addDoc(collection(db, "lent_records"), newRecord);
      const saved = { id: docRef.id, ...newRecord };
      const existing = JSON.parse(localStorage.getItem('lent_records') || '[]');
      existing.unshift(saved);
      localStorage.setItem('lent_records', JSON.stringify(existing));
      return saved;
    } catch (e) {
      console.warn("Firebase write failed, using local storage fallback", e);
      const id = 'local_' + Date.now();
      const saved = { id, ...newRecord };
      const existing = JSON.parse(localStorage.getItem('lent_records') || '[]');
      existing.unshift(saved);
      localStorage.setItem('lent_records', JSON.stringify(existing));
      return saved;
    }
  },

  async updateLentRecord(id, updates) {
    const existing = JSON.parse(localStorage.getItem('lent_records') || '[]');
    const updatedList = existing.map(item => item.id === id ? { ...item, ...updates } : item);
    localStorage.setItem('lent_records', JSON.stringify(updatedList));

    if (db && !id.startsWith('local_')) {
      try {
        const recordRef = doc(db, "lent_records", id);
        await updateDoc(recordRef, updates);
      } catch (e) {
        console.warn("Failed to update Firestore lent record", e);
      }
    }
    return { id, ...updates };
  },

  async deleteLentRecord(id) {
    const existing = JSON.parse(localStorage.getItem('lent_records') || '[]');
    const updatedList = existing.filter(item => item.id !== id);
    localStorage.setItem('lent_records', JSON.stringify(updatedList));

    if (db && !id.startsWith('local_')) {
      try {
        const recordRef = doc(db, "lent_records", id);
        await deleteDoc(recordRef);
      } catch (e) {
        console.warn("Failed to delete Firestore lent record", e);
      }
    }
    return true;
  },

  // Borrowed Money Actions (Money borrowed from friends)
  async getBorrowedRecords() {
    if (!db) {
      const local = localStorage.getItem('borrowed_records');
      return local ? JSON.parse(local) : [];
    }
    try {
      const querySnapshot = await getDocs(collection(db, "borrowed_records"));
      const records = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      localStorage.setItem('borrowed_records', JSON.stringify(records));
      return records;
    } catch (e) {
      console.warn("Failed to fetch borrowed records from Firestore, using local fallback", e);
      const local = localStorage.getItem('borrowed_records');
      return local ? JSON.parse(local) : [];
    }
  },

  async addBorrowedRecord(record) {
    const amountVal = parseFloat(record.amount) || 0;
    const initialBorrows = (record.borrows && Array.isArray(record.borrows) && record.borrows.length > 0)
      ? record.borrows
      : [
          {
            id: 'borrow_' + Date.now(),
            amount: amountVal,
            date: record.dateBorrowed || new Date().toISOString().split('T')[0],
            note: record.note ? record.note.trim() : 'Initial borrowed money'
          }
        ];

    const newRecord = {
      ...record,
      amount: amountVal,
      returnedAmount: parseFloat(record.returnedAmount) || 0,
      repayments: record.repayments || [],
      borrows: initialBorrows,
      createdAt: new Date().toISOString()
    };

    if (!db) {
      const id = 'local_borrow_' + Date.now();
      const saved = { id, ...newRecord };
      const existing = JSON.parse(localStorage.getItem('borrowed_records') || '[]');
      existing.unshift(saved);
      localStorage.setItem('borrowed_records', JSON.stringify(existing));
      return saved;
    }

    try {
      const docRef = await addDoc(collection(db, "borrowed_records"), newRecord);
      const saved = { id: docRef.id, ...newRecord };
      const existing = JSON.parse(localStorage.getItem('borrowed_records') || '[]');
      existing.unshift(saved);
      localStorage.setItem('borrowed_records', JSON.stringify(existing));
      return saved;
    } catch (e) {
      console.warn("Firebase write failed, using local storage fallback for borrowed record", e);
      const id = 'local_borrow_' + Date.now();
      const saved = { id, ...newRecord };
      const existing = JSON.parse(localStorage.getItem('borrowed_records') || '[]');
      existing.unshift(saved);
      localStorage.setItem('borrowed_records', JSON.stringify(existing));
      return saved;
    }
  },

  async updateBorrowedRecord(id, updates) {
    const existing = JSON.parse(localStorage.getItem('borrowed_records') || '[]');
    const updatedList = existing.map(item => item.id === id ? { ...item, ...updates } : item);
    localStorage.setItem('borrowed_records', JSON.stringify(updatedList));

    if (db && !id.startsWith('local_')) {
      try {
        const recordRef = doc(db, "borrowed_records", id);
        await updateDoc(recordRef, updates);
      } catch (e) {
        console.warn("Failed to update Firestore borrowed record", e);
      }
    }
    return { id, ...updates };
  },

  async deleteBorrowedRecord(id) {
    const existing = JSON.parse(localStorage.getItem('borrowed_records') || '[]');
    const updatedList = existing.filter(item => item.id !== id);
    localStorage.setItem('borrowed_records', JSON.stringify(updatedList));

    if (db && !id.startsWith('local_')) {
      try {
        const recordRef = doc(db, "borrowed_records", id);
        await deleteDoc(recordRef);
      } catch (e) {
        console.warn("Failed to delete Firestore borrowed record", e);
      }
    }
    return true;
  }
};
