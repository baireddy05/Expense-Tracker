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
  // Transactions (users/{userId}/transactions)
  // ----------------------------------------------------
  async getTransactions(userId) {
    if (!userId || !db) {
      const local = localStorage.getItem('local_transactions');
      return local ? JSON.parse(local) : [];
    }

    try {
      const colRef = collection(db, "users", userId, "transactions");
      const q = query(colRef, orderBy("date", "desc"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      localStorage.setItem(`cache_transactions_${userId}`, JSON.stringify(list));
      return list;
    } catch (e) {
      console.warn("Firestore fetch transactions failed, trying cached data", e);
      const cached = localStorage.getItem(`cache_transactions_${userId}`);
      return cached ? JSON.parse(cached) : [];
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

    try {
      const colRef = collection(db, "users", userId, "transactions");
      const docRef = await addDoc(colRef, newTx);
      return { id: docRef.id, ...newTx };
    } catch (e) {
      console.error("Failed to add transaction to Firestore", e);
      throw e;
    }
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
      const seeded = DEFAULT_CATEGORIES.map((c, i) => ({ id: 'cat_' + i, ...c }));
      localStorage.setItem('local_categories', JSON.stringify(seeded));
      return seeded;
    }

    try {
      const colRef = collection(db, "users", userId, "categories");
      const snapshot = await getDocs(colRef);
      
      if (snapshot.empty) {
        // Seed default categories for this specific user
        const batch = writeBatch(db);
        const seeded = [];
        for (const cat of DEFAULT_CATEGORIES) {
          const newDocRef = doc(colRef);
          batch.set(newDocRef, cat);
          seeded.push({ id: newDocRef.id, ...cat });
        }
        await batch.commit();
        localStorage.setItem(`cache_categories_${userId}`, JSON.stringify(seeded));
        return seeded;
      }

      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      localStorage.setItem(`cache_categories_${userId}`, JSON.stringify(list));
      return list;
    } catch (e) {
      console.warn("Firestore fetch categories failed, using cached", e);
      const cached = localStorage.getItem(`cache_categories_${userId}`);
      return cached ? JSON.parse(cached) : DEFAULT_CATEGORIES.map((c, i) => ({ id: 'cat_' + i, ...c }));
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
      if (!snap.exists()) {
        await setDoc(docRef, defaultSettings);
        return { id: 'config', ...defaultSettings };
      }
      return { id: snap.id, ...snap.data() };
    } catch (e) {
      console.warn("Firestore fetch settings failed", e);
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
      const local = localStorage.getItem('local_lent_records');
      return local ? JSON.parse(local) : [];
    }

    try {
      const colRef = collection(db, "users", userId, "lent_records");
      const snapshot = await getDocs(colRef);
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      localStorage.setItem(`cache_lent_${userId}`, JSON.stringify(list));
      return list;
    } catch (e) {
      console.warn("Firestore fetch lent records failed", e);
      const cached = localStorage.getItem(`cache_lent_${userId}`);
      return cached ? JSON.parse(cached) : [];
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
      const local = localStorage.getItem('local_borrowed_records');
      return local ? JSON.parse(local) : [];
    }

    try {
      const colRef = collection(db, "users", userId, "borrowed_records");
      const snapshot = await getDocs(colRef);
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      localStorage.setItem(`cache_borrowed_${userId}`, JSON.stringify(list));
      return list;
    } catch (e) {
      console.warn("Firestore fetch borrowed records failed", e);
      const cached = localStorage.getItem(`cache_borrowed_${userId}`);
      return cached ? JSON.parse(cached) : [];
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
  // Cloud Sync & Comprehensive Legacy Data Migration
  // ----------------------------------------------------
  async migrateLocalDataToCloud(userId) {
    if (!userId || !db) return { count: 0 };
    let count = 0;

    try {
      // 1. Fetch current user transactions to prevent duplicates
      const existingUserTx = await this.getTransactions(userId);
      const existingTxKeys = new Set(
        existingUserTx.map(t => `${t.date}_${t.amount}_${t.categoryId || ''}_${t.note || ''}`)
      );

      const existingUserLent = await this.getLentRecords(userId);
      const existingLentNames = new Set(
        existingUserLent.map(l => `${l.borrowerName || l.personName || ''}_${l.amount}`)
      );

      const existingUserBorrowed = await this.getBorrowedRecords(userId);
      const existingBorrowNames = new Set(
        existingUserBorrowed.map(b => `${b.lenderName || b.personName || ''}_${b.amount}`)
      );

      const batch = writeBatch(db);
      let batchCount = 0;

      // Helper to safely commit if batch hits limit (Firestore batch limit is 500)
      const addToBatch = async (ref, data) => {
        batch.set(ref, data);
        batchCount++;
        count++;
        if (batchCount >= 450) {
          await batch.commit();
          batchCount = 0;
        }
      };

      // 2. Check local storage legacy keys
      const localTx1 = JSON.parse(localStorage.getItem('local_transactions') || '[]');
      const localTx2 = JSON.parse(localStorage.getItem('transactions') || '[]');
      const allLocalTx = [...localTx1, ...localTx2];

      for (const item of allLocalTx) {
        const key = `${item.date}_${item.amount}_${item.categoryId || ''}_${item.note || ''}`;
        if (!existingTxKeys.has(key)) {
          existingTxKeys.add(key);
          const { id, ...data } = item;
          const ref = doc(collection(db, "users", userId, "transactions"));
          await addToBatch(ref, data);
        }
      }
      localStorage.removeItem('local_transactions');
      localStorage.removeItem('transactions');

      // Lent records from localStorage (legacy 'lent_records' and 'local_lent_records')
      const localLent1 = JSON.parse(localStorage.getItem('local_lent_records') || '[]');
      const localLent2 = JSON.parse(localStorage.getItem('lent_records') || '[]');
      const allLocalLent = [...localLent1, ...localLent2];

      for (const item of allLocalLent) {
        const key = `${item.borrowerName || item.personName || ''}_${item.amount}`;
        if (!existingLentNames.has(key)) {
          existingLentNames.add(key);
          const { id, ...data } = item;
          const ref = doc(collection(db, "users", userId, "lent_records"));
          await addToBatch(ref, data);
        }
      }
      localStorage.removeItem('local_lent_records');
      localStorage.removeItem('lent_records');

      // Borrowed records from localStorage (legacy 'borrowed_records' and 'local_borrowed_records')
      const localBorrow1 = JSON.parse(localStorage.getItem('local_borrowed_records') || '[]');
      const localBorrow2 = JSON.parse(localStorage.getItem('borrowed_records') || '[]');
      const allLocalBorrow = [...localBorrow1, ...localBorrow2];

      for (const item of allLocalBorrow) {
        const key = `${item.lenderName || item.personName || ''}_${item.amount}`;
        if (!existingBorrowNames.has(key)) {
          existingBorrowNames.add(key);
          const { id, ...data } = item;
          const ref = doc(collection(db, "users", userId, "borrowed_records"));
          await addToBatch(ref, data);
        }
      }
      localStorage.removeItem('local_borrowed_records');
      localStorage.removeItem('borrowed_records');

      // 3. Check legacy root collections in Firestore (if any existed before per-user isolation)
      try {
        const rootTxSnap = await getDocs(collection(db, "transactions"));
        for (const d of rootTxSnap.docs) {
          const item = d.data();
          const key = `${item.date}_${item.amount}_${item.categoryId || ''}_${item.note || ''}`;
          if (!existingTxKeys.has(key)) {
            existingTxKeys.add(key);
            const ref = doc(collection(db, "users", userId, "transactions"));
            await addToBatch(ref, item);
          }
        }
      } catch (err) {
        // Root collections may not exist or may be restricted by security rules
        console.log("Root Firestore transactions check skipped:", err.message);
      }

      try {
        const rootLentSnap = await getDocs(collection(db, "lent_records"));
        for (const d of rootLentSnap.docs) {
          const item = d.data();
          const key = `${item.borrowerName || item.personName || ''}_${item.amount}`;
          if (!existingLentNames.has(key)) {
            existingLentNames.add(key);
            const ref = doc(collection(db, "users", userId, "lent_records"));
            await addToBatch(ref, item);
          }
        }
      } catch (err) {
        console.log("Root Firestore lent_records check skipped:", err.message);
      }

      try {
        const rootBorrowSnap = await getDocs(collection(db, "borrowed_records"));
        for (const d of rootBorrowSnap.docs) {
          const item = d.data();
          const key = `${item.lenderName || item.personName || ''}_${item.amount}`;
          if (!existingBorrowNames.has(key)) {
            existingBorrowNames.add(key);
            const ref = doc(collection(db, "users", userId, "borrowed_records"));
            await addToBatch(ref, item);
          }
        }
      } catch (err) {
        console.log("Root Firestore borrowed_records check skipped:", err.message);
      }

      // Commit any remaining writes in batch
      if (batchCount > 0) {
        await batch.commit();
      }

      return { count };
    } catch (e) {
      console.error("Migration error:", e);
      return { count };
    }
  }
};
