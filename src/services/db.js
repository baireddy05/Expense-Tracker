import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc, 
  writeBatch,
  query,
  orderBy
} from "firebase/firestore";
import { db } from "./firebase";

const DEFAULT_CATEGORIES = [
  { name: 'Food', color: '#ef4444', icon: 'fa-utensils', type: 'expense' },
  { name: 'Groceries', color: '#f97316', icon: 'fa-shopping-cart', type: 'expense' },
  { name: 'Travel', color: '#eab308', icon: 'fa-plane', type: 'expense' },
  { name: 'Entertainment', color: '#8b5cf6', icon: 'fa-film', type: 'expense' },
  { name: 'Medical', color: '#ec4899', icon: 'fa-notes-medical', type: 'expense' },
  { name: 'From Dad', color: '#22c55e', icon: 'fa-money-bill', type: 'income' },
  { name: 'Trading', color: '#10b981', icon: 'fa-chart-line', type: 'income' }
];

export const DataService = {
  // ----------------------------------------------------
  // Privacy & Local Cache Purge
  // ----------------------------------------------------
  purgeAllLocalData() {
    const keysToPurge = [
      'local_transactions',
      'transactions',
      'local_lent_records',
      'lent_records',
      'local_borrowed_records',
      'borrowed_records',
      'local_categories',
      'local_settings',
      'extrack_guest_mode'
    ];

    keysToPurge.forEach(k => localStorage.removeItem(k));

    // Also remove any cache_* keys dynamically
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(k => {
      if (k.startsWith('cache_')) {
        localStorage.removeItem(k);
      }
    });

    sessionStorage.clear();
    return true;
  },

  // ----------------------------------------------------
  // Transactions (users/{userId}/transactions)
  // ----------------------------------------------------
  async getTransactions(userId) {
    if (!userId || !db) {
      const local = localStorage.getItem('local_transactions') || localStorage.getItem('transactions');
      return local ? JSON.parse(local) : [];
    }

    try {
      const colRef = collection(db, "users", userId, "transactions");
      let snapshot;
      try {
        const q = query(colRef, orderBy("date", "desc"));
        snapshot = await getDocs(q);
      } catch (err) {
        snapshot = await getDocs(colRef);
      }

      const seen = new Set();
      const uniqueList = [];
      const duplicateDocIds = [];

      snapshot.docs.forEach(d => {
        const data = d.data();
        const dateStr = (data.date || '').split('T')[0];
        const noteStr = (data.note || '').trim().toLowerCase();
        const amtStr = parseFloat(data.amount || 0).toFixed(2);
        const typeStr = data.type || 'expense';
        const catStr = data.categoryId || '';
        const fingerprint = `${dateStr}__${amtStr}__${typeStr}__${noteStr}__${catStr}`;

        if (seen.has(fingerprint)) {
          duplicateDocIds.push(d.id);
        } else {
          seen.add(fingerprint);
          uniqueList.push({ id: d.id, ...data });
        }
      });

      // Silently clean up redundant duplicate documents in Firestore
      if (duplicateDocIds.length > 0) {
        const batch = writeBatch(db);
        duplicateDocIds.forEach(dupId => {
          batch.delete(doc(db, "users", userId, "transactions", dupId));
        });
        batch.commit().catch(e => console.warn("Deduplicate batch error:", e));
      }

      uniqueList.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      // Automatically purge any remaining plain local storage copies for security
      DataService.purgeAllLocalData();
      return uniqueList;
    } catch (e) {
      console.warn("Firestore fetch transactions error:", e);
      return [];
    }
  },

  async addTransaction(transaction, userId) {
    const newTx = {
      ...transaction,
      createdAt: new Date().toISOString()
    };

    if (!userId || !db) {
      const id = 'local_tx_' + Date.now();
      const item = { id, ...newTx };
      const local = JSON.parse(localStorage.getItem('local_transactions') || '[]');
      local.unshift(item);
      localStorage.setItem('local_transactions', JSON.stringify(local));
      return item;
    }

    const colRef = collection(db, "users", userId, "transactions");
    const docRef = await addDoc(colRef, newTx);
    return { id: docRef.id, ...newTx };
  },

  async updateTransaction(id, updates, userId) {
    if (!userId || !db || id.startsWith('local_')) {
      const local = JSON.parse(localStorage.getItem('local_transactions') || '[]');
      const updated = local.map(t => t.id === id ? { ...t, ...updates } : t);
      localStorage.setItem('local_transactions', JSON.stringify(updated));
      return { id, ...updates };
    }

    const docRef = doc(db, "users", userId, "transactions", id);
    await updateDoc(docRef, updates);
    return { id, ...updates };
  },

  async deleteTransaction(id, userId) {
    if (!userId || !db || id.startsWith('local_')) {
      const local = JSON.parse(localStorage.getItem('local_transactions') || '[]');
      const filtered = local.filter(t => t.id !== id);
      localStorage.setItem('local_transactions', JSON.stringify(filtered));
      return true;
    }

    const docRef = doc(db, "users", userId, "transactions", id);
    await deleteDoc(docRef);
    return true;
  },

  // ----------------------------------------------------
  // Categories (users/{userId}/categories)
  // ----------------------------------------------------
  async getCategories(userId) {
    if (!userId || !db) {
      const local = localStorage.getItem('local_categories');
      if (local) return JSON.parse(local);
      return DEFAULT_CATEGORIES.map((c, i) => ({ id: 'cat_' + i, ...c }));
    }

    try {
      const colRef = collection(db, "users", userId, "categories");
      const snapshot = await getDocs(colRef);
      
      if (snapshot.empty) {
        // Seed default categories for this user
        const batch = writeBatch(db);
        const seeded = [];
        for (const cat of DEFAULT_CATEGORIES) {
          const newDocRef = doc(colRef);
          batch.set(newDocRef, cat);
          seeded.push({ id: newDocRef.id, ...cat });
        }
        await batch.commit();
        return seeded;
      }

      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Firestore fetch categories error:", e);
      return DEFAULT_CATEGORIES.map((c, i) => ({ id: 'cat_' + i, ...c }));
    }
  },

  async addCategory(category, userId) {
    if (!userId || !db) {
      const id = 'local_cat_' + Date.now();
      const newCat = { id, ...category };
      const local = JSON.parse(localStorage.getItem('local_categories') || '[]');
      local.push(newCat);
      localStorage.setItem('local_categories', JSON.stringify(local));
      return newCat;
    }

    const colRef = collection(db, "users", userId, "categories");
    const docRef = await addDoc(colRef, category);
    return { id: docRef.id, ...category };
  },

  // ----------------------------------------------------
  // Settings (users/{userId}/settings/config)
  // ----------------------------------------------------
  async getSettings(userId) {
    const defaultSettings = { monthlyBudget: 0 };
    if (!userId || !db) {
      const local = localStorage.getItem('local_settings');
      return local ? JSON.parse(local) : defaultSettings;
    }

    try {
      const docRef = doc(db, "users", userId, "settings", "config");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
      await setDoc(docRef, defaultSettings);
      return { id: 'config', ...defaultSettings };
    } catch (e) {
      console.warn("User settings fetch error:", e);
      return defaultSettings;
    }
  },

  async updateSettings(updates, userId) {
    if (!userId || !db) {
      const local = JSON.parse(localStorage.getItem('local_settings') || '{"monthlyBudget":0}');
      const updated = { ...local, ...updates };
      localStorage.setItem('local_settings', JSON.stringify(updated));
      return updated;
    }

    const docRef = doc(db, "users", userId, "settings", "config");
    await setDoc(docRef, updates, { merge: true });
    return updates;
  },

  // ----------------------------------------------------
  // Lent Records (users/{userId}/lent_records)
  // ----------------------------------------------------
  async getLentRecords(userId) {
    if (!userId || !db) {
      const local = JSON.parse(localStorage.getItem('local_lent_records') || localStorage.getItem('lent_records') || '[]');
      return local;
    }

    try {
      const colRef = collection(db, "users", userId, "lent_records");
      const snapshot = await getDocs(colRef);
      const seen = new Set();
      const uniqueList = [];
      const duplicateDocIds = [];

      snapshot.docs.forEach(d => {
        const data = d.data();
        const nameStr = (data.borrowerName || data.name || '').trim().toLowerCase();
        const amtStr = parseFloat(data.amount || 0).toFixed(2);
        const dateStr = (data.dateLent || data.date || '').split('T')[0];
        const fingerprint = `${nameStr}__${amtStr}__${dateStr}`;

        if (seen.has(fingerprint)) {
          duplicateDocIds.push(d.id);
        } else {
          seen.add(fingerprint);
          uniqueList.push({ id: d.id, ...data });
        }
      });

      if (duplicateDocIds.length > 0) {
        const batch = writeBatch(db);
        duplicateDocIds.forEach(dupId => {
          batch.delete(doc(db, "users", userId, "lent_records", dupId));
        });
        batch.commit().catch(e => console.warn("Deduplicate lent error:", e));
      }

      return uniqueList;
    } catch (e) {
      console.warn("Error fetching user lent records:", e);
      return [];
    }
  },

  async addLentRecord(record, userId) {
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

    if (!userId || !db) {
      const id = 'local_lent_' + Date.now();
      const saved = { id, ...newRecord };
      const existing = JSON.parse(localStorage.getItem('local_lent_records') || '[]');
      existing.unshift(saved);
      localStorage.setItem('local_lent_records', JSON.stringify(existing));
      return saved;
    }

    const colRef = collection(db, "users", userId, "lent_records");
    const docRef = await addDoc(colRef, newRecord);
    return { id: docRef.id, ...newRecord };
  },

  async updateLentRecord(id, updates, userId) {
    if (!userId || !db || id.startsWith('local_')) {
      const existing = JSON.parse(localStorage.getItem('local_lent_records') || '[]');
      const updatedList = existing.map(item => item.id === id ? { ...item, ...updates } : item);
      localStorage.setItem('local_lent_records', JSON.stringify(updatedList));
      return { id, ...updates };
    }

    const docRef = doc(db, "users", userId, "lent_records", id);
    await updateDoc(docRef, updates);
    return { id, ...updates };
  },

  async deleteLentRecord(id, userId) {
    if (!userId || !db || id.startsWith('local_')) {
      const existing = JSON.parse(localStorage.getItem('local_lent_records') || '[]');
      const updatedList = existing.filter(item => item.id !== id);
      localStorage.setItem('local_lent_records', JSON.stringify(updatedList));
      return true;
    }

    const docRef = doc(db, "users", userId, "lent_records", id);
    await deleteDoc(docRef);
    return true;
  },

  // ----------------------------------------------------
  // Borrowed Records (users/{userId}/borrowed_records)
  // ----------------------------------------------------
  async getBorrowedRecords(userId) {
    if (!userId || !db) {
      const local = JSON.parse(localStorage.getItem('local_borrowed_records') || localStorage.getItem('borrowed_records') || '[]');
      return local;
    }

    try {
      const colRef = collection(db, "users", userId, "borrowed_records");
      const snapshot = await getDocs(colRef);
      const seen = new Set();
      const uniqueList = [];
      const duplicateDocIds = [];

      snapshot.docs.forEach(d => {
        const data = d.data();
        const nameStr = (data.lenderName || data.name || '').trim().toLowerCase();
        const amtStr = parseFloat(data.amount || 0).toFixed(2);
        const dateStr = (data.dateBorrowed || data.date || '').split('T')[0];
        const fingerprint = `${nameStr}__${amtStr}__${dateStr}`;

        if (seen.has(fingerprint)) {
          duplicateDocIds.push(d.id);
        } else {
          seen.add(fingerprint);
          uniqueList.push({ id: d.id, ...data });
        }
      });

      if (duplicateDocIds.length > 0) {
        const batch = writeBatch(db);
        duplicateDocIds.forEach(dupId => {
          batch.delete(doc(db, "users", userId, "borrowed_records", dupId));
        });
        batch.commit().catch(e => console.warn("Deduplicate borrowed error:", e));
      }

      return uniqueList;
    } catch (e) {
      console.warn("Error fetching user borrowed records:", e);
      return [];
    }
  },

  async addBorrowedRecord(record, userId) {
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

    if (!userId || !db) {
      const id = 'local_borrow_' + Date.now();
      const saved = { id, ...newRecord };
      const existing = JSON.parse(localStorage.getItem('local_borrowed_records') || '[]');
      existing.unshift(saved);
      localStorage.setItem('local_borrowed_records', JSON.stringify(existing));
      return saved;
    }

    const colRef = collection(db, "users", userId, "borrowed_records");
    const docRef = await addDoc(colRef, newRecord);
    return { id: docRef.id, ...newRecord };
  },

  async updateBorrowedRecord(id, updates, userId) {
    if (!userId || !db || id.startsWith('local_')) {
      const existing = JSON.parse(localStorage.getItem('local_borrowed_records') || '[]');
      const updatedList = existing.map(item => item.id === id ? { ...item, ...updates } : item);
      localStorage.setItem('local_borrowed_records', JSON.stringify(updatedList));
      return { id, ...updates };
    }

    const docRef = doc(db, "users", userId, "borrowed_records", id);
    await updateDoc(docRef, updates);
    return { id, ...updates };
  },

  async deleteBorrowedRecord(id, userId) {
    if (!userId || !db || id.startsWith('local_')) {
      const existing = JSON.parse(localStorage.getItem('local_borrowed_records') || '[]');
      const updatedList = existing.filter(item => item.id !== id);
      localStorage.setItem('local_borrowed_records', JSON.stringify(updatedList));
      return true;
    }

    const docRef = doc(db, "users", userId, "borrowed_records", id);
    await deleteDoc(docRef);
    return true;
  },

  // ----------------------------------------------------
  // Clean Legacy Root Firestore Collections
  // ----------------------------------------------------
  async cleanRootCollections() {
    if (!db) return;
    try {
      const colNames = ["transactions", "lent_records", "borrowed_records"];
      for (const colName of colNames) {
        const snap = await getDocs(collection(db, colName));
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }
    } catch (e) {
      console.log("Root cleanup note:", e.message);
    }
  },

  async migrateLocalDataToCloud(userId) {
    this.purgeAllLocalData();
    return { count: 0 };
  }
};
