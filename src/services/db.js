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
  // Transactions (users/{userId}/transactions + root fallback)
  // ----------------------------------------------------
  async getTransactions(userId) {
    if (!db) {
      const local = localStorage.getItem('local_transactions') || localStorage.getItem('transactions');
      return local ? JSON.parse(local) : [];
    }

    let userTxList = [];
    let rootTxList = [];
    const seenTxKeys = new Set();
    const mergedList = [];

    // 1. Fetch from user's subcollection if logged in
    if (userId) {
      try {
        const colRef = collection(db, "users", userId, "transactions");
        const q = query(colRef, orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        userTxList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        userTxList.forEach(t => {
          const key = `${t.date}_${t.amount}_${t.categoryId || ''}_${t.note || ''}`;
          seenTxKeys.add(key);
          mergedList.push(t);
        });
      } catch (e) {
        console.warn("Error fetching user transactions:", e);
      }
    }

    // 2. Fetch from root transactions collection (previous/legacy database)
    try {
      const rootColRef = collection(db, "transactions");
      const rootSnapshot = await getDocs(rootColRef);
      rootTxList = rootSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      const toSyncToUser = [];
      rootTxList.forEach(t => {
        const key = `${t.date}_${t.amount}_${t.categoryId || ''}_${t.note || ''}`;
        if (!seenTxKeys.has(key)) {
          seenTxKeys.add(key);
          mergedList.push(t);
          if (userId) {
            toSyncToUser.push(t);
          }
        }
      });

      // Background sync missing root transactions to the logged in user
      if (userId && toSyncToUser.length > 0) {
        const batch = writeBatch(db);
        toSyncToUser.forEach(item => {
          const { id, ...data } = item;
          const newDocRef = doc(collection(db, "users", userId, "transactions"));
          batch.set(newDocRef, data);
        });
        batch.commit().catch(err => console.warn("Background sync error:", err));
      }
    } catch (e) {
      console.log("Root transactions not accessible or empty:", e.message);
    }

    // 3. Merge any localStorage legacy transactions
    const localTx = JSON.parse(localStorage.getItem('local_transactions') || localStorage.getItem('transactions') || '[]');
    if (localTx.length > 0) {
      const toSyncFromLocal = [];
      localTx.forEach(t => {
        const key = `${t.date}_${t.amount}_${t.categoryId || ''}_${t.note || ''}`;
        if (!seenTxKeys.has(key)) {
          seenTxKeys.add(key);
          mergedList.push(t);
          if (userId) toSyncFromLocal.push(t);
        }
      });
      if (userId && toSyncFromLocal.length > 0) {
        const batch = writeBatch(db);
        toSyncFromLocal.forEach(item => {
          const { id, ...data } = item;
          const newDocRef = doc(collection(db, "users", userId, "transactions"));
          batch.set(newDocRef, data);
        });
        batch.commit().catch(err => console.warn("Local sync error:", err));
      }
    }

    // Sort descending by date
    mergedList.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    if (userId) {
      localStorage.setItem(`cache_transactions_${userId}`, JSON.stringify(mergedList));
    }
    return mergedList;
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

    try {
      const docRef = doc(db, "users", userId, "transactions", id);
      await updateDoc(docRef, updates);
    } catch (err) {
      // If doc exists in root collection
      try {
        const rootDocRef = doc(db, "transactions", id);
        await updateDoc(rootDocRef, updates);
      } catch (e) {
        console.warn("Failed to update transaction doc", e);
      }
    }
    return { id, ...updates };
  },

  async deleteTransaction(id, userId) {
    if (!userId || !db || id.startsWith('local_')) {
      const local = JSON.parse(localStorage.getItem('local_transactions') || '[]');
      const filtered = local.filter(t => t.id !== id);
      localStorage.setItem('local_transactions', JSON.stringify(filtered));
      return true;
    }

    try {
      const docRef = doc(db, "users", userId, "transactions", id);
      await deleteDoc(docRef);
    } catch (err) {
      try {
        const rootDocRef = doc(db, "transactions", id);
        await deleteDoc(rootDocRef);
      } catch (e) {
        console.warn("Failed to delete transaction doc", e);
      }
    }
    return true;
  },

  // ----------------------------------------------------
  // Categories (users/{userId}/categories + root fallback)
  // ----------------------------------------------------
  async getCategories(userId) {
    if (!db) {
      const local = localStorage.getItem('local_categories');
      if (local) return JSON.parse(local);
      return DEFAULT_CATEGORIES.map((c, i) => ({ id: 'cat_' + i, ...c }));
    }

    const mergedCategories = [];
    const seenCatKeys = new Set();

    // 1. Fetch user categories if logged in
    if (userId) {
      try {
        const colRef = collection(db, "users", userId, "categories");
        const snapshot = await getDocs(colRef);
        const userCats = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        userCats.forEach(c => {
          const key = (c.name || '').toLowerCase() + '_' + (c.type || 'expense');
          seenCatKeys.add(key);
          mergedCategories.push(c);
        });
      } catch (e) {
        console.warn("Error fetching user categories:", e);
      }
    }

    // 2. Fetch root categories (previous database)
    try {
      const rootColRef = collection(db, "categories");
      const rootSnapshot = await getDocs(rootColRef);
      const rootCats = rootSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      rootCats.forEach(c => {
        const key = (c.name || '').toLowerCase() + '_' + (c.type || 'expense');
        if (!seenCatKeys.has(key)) {
          seenCatKeys.add(key);
          mergedCategories.push(c);
        }
      });
    } catch (e) {
      console.log("Root categories query skipped:", e.message);
    }

    // 3. Fallback to default categories if empty
    if (mergedCategories.length === 0) {
      DEFAULT_CATEGORIES.forEach((c, i) => {
        mergedCategories.push({ id: 'cat_' + i, ...c });
      });

      if (userId) {
        const batch = writeBatch(db);
        const colRef = collection(db, "users", userId, "categories");
        for (const cat of DEFAULT_CATEGORIES) {
          const newDocRef = doc(colRef);
          batch.set(newDocRef, cat);
        }
        batch.commit().catch(console.warn);
      }
    }

    return mergedCategories;
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
  // Settings (users/{userId}/settings/config + root fallback)
  // ----------------------------------------------------
  async getSettings(userId) {
    const defaultSettings = { monthlyBudget: 0 };
    if (!db) {
      const local = localStorage.getItem('local_settings');
      return local ? JSON.parse(local) : defaultSettings;
    }

    if (userId) {
      try {
        const docRef = doc(db, "users", userId, "settings", "config");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() };
        }
      } catch (e) {
        console.warn("User settings fetch error:", e);
      }
    }

    // Try root settings
    try {
      const rootSnap = await getDocs(collection(db, "settings"));
      if (!rootSnap.empty) {
        const data = rootSnap.docs[0].data();
        if (userId) {
          await setDoc(doc(db, "users", userId, "settings", "config"), data, { merge: true });
        }
        return { id: rootSnap.docs[0].id, ...data };
      }
    } catch (e) {
      console.log("Root settings query skipped:", e.message);
    }

    return defaultSettings;
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
  // Lent Records (users/{userId}/lent_records + root + local fallback)
  // ----------------------------------------------------
  async getLentRecords(userId) {
    const mergedList = [];
    const seenKeys = new Set();

    // 1. User collection
    if (userId && db) {
      try {
        const colRef = collection(db, "users", userId, "lent_records");
        const snapshot = await getDocs(colRef);
        snapshot.docs.forEach(d => {
          const item = { id: d.id, ...d.data() };
          const key = `${item.borrowerName || item.personName || ''}_${item.amount}`;
          seenKeys.add(key);
          mergedList.push(item);
        });
      } catch (e) {
        console.warn("Error fetching user lent records:", e);
      }
    }

    // 2. Root Firestore lent_records
    if (db) {
      try {
        const rootSnap = await getDocs(collection(db, "lent_records"));
        rootSnap.docs.forEach(d => {
          const item = { id: d.id, ...d.data() };
          const key = `${item.borrowerName || item.personName || ''}_${item.amount}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            mergedList.push(item);
          }
        });
      } catch (e) {
        console.log("Root lent_records skipped:", e.message);
      }
    }

    // 3. LocalStorage
    const local = JSON.parse(localStorage.getItem('local_lent_records') || localStorage.getItem('lent_records') || '[]');
    local.forEach(item => {
      const key = `${item.borrowerName || item.personName || ''}_${item.amount}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        mergedList.push(item);
      }
    });

    if (userId) {
      localStorage.setItem(`cache_lent_${userId}`, JSON.stringify(mergedList));
    }
    return mergedList;
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

    try {
      const docRef = doc(db, "users", userId, "lent_records", id);
      await updateDoc(docRef, updates);
    } catch (err) {
      try {
        const rootDocRef = doc(db, "lent_records", id);
        await updateDoc(rootDocRef, updates);
      } catch (e) {
        console.warn("Failed to update lent doc", e);
      }
    }
    return { id, ...updates };
  },

  async deleteLentRecord(id, userId) {
    if (!userId || !db || id.startsWith('local_')) {
      const existing = JSON.parse(localStorage.getItem('local_lent_records') || '[]');
      const updatedList = existing.filter(item => item.id !== id);
      localStorage.setItem('local_lent_records', JSON.stringify(updatedList));
      return true;
    }

    try {
      const docRef = doc(db, "users", userId, "lent_records", id);
      await deleteDoc(docRef);
    } catch (err) {
      try {
        const rootDocRef = doc(db, "lent_records", id);
        await deleteDoc(rootDocRef);
      } catch (e) {
        console.warn("Failed to delete lent doc", e);
      }
    }
    return true;
  },

  // ----------------------------------------------------
  // Borrowed Records (users/{userId}/borrowed_records + root + local fallback)
  // ----------------------------------------------------
  async getBorrowedRecords(userId) {
    const mergedList = [];
    const seenKeys = new Set();

    // 1. User collection
    if (userId && db) {
      try {
        const colRef = collection(db, "users", userId, "borrowed_records");
        const snapshot = await getDocs(colRef);
        snapshot.docs.forEach(d => {
          const item = { id: d.id, ...d.data() };
          const key = `${item.lenderName || item.personName || ''}_${item.amount}`;
          seenKeys.add(key);
          mergedList.push(item);
        });
      } catch (e) {
        console.warn("Error fetching user borrowed records:", e);
      }
    }

    // 2. Root Firestore borrowed_records
    if (db) {
      try {
        const rootSnap = await getDocs(collection(db, "borrowed_records"));
        rootSnap.docs.forEach(d => {
          const item = { id: d.id, ...d.data() };
          const key = `${item.lenderName || item.personName || ''}_${item.amount}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            mergedList.push(item);
          }
        });
      } catch (e) {
        console.log("Root borrowed_records skipped:", e.message);
      }
    }

    // 3. LocalStorage
    const local = JSON.parse(localStorage.getItem('local_borrowed_records') || localStorage.getItem('borrowed_records') || '[]');
    local.forEach(item => {
      const key = `${item.lenderName || item.personName || ''}_${item.amount}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        mergedList.push(item);
      }
    });

    if (userId) {
      localStorage.setItem(`cache_borrowed_${userId}`, JSON.stringify(mergedList));
    }
    return mergedList;
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

    try {
      const docRef = doc(db, "users", userId, "borrowed_records", id);
      await updateDoc(docRef, updates);
    } catch (err) {
      try {
        const rootDocRef = doc(db, "borrowed_records", id);
        await updateDoc(rootDocRef, updates);
      } catch (e) {
        console.warn("Failed to update borrowed doc", e);
      }
    }
    return { id, ...updates };
  },

  async deleteBorrowedRecord(id, userId) {
    if (!userId || !db || id.startsWith('local_')) {
      const existing = JSON.parse(localStorage.getItem('local_borrowed_records') || '[]');
      const updatedList = existing.filter(item => item.id !== id);
      localStorage.setItem('local_borrowed_records', JSON.stringify(updatedList));
      return true;
    }

    try {
      const docRef = doc(db, "users", userId, "borrowed_records", id);
      await deleteDoc(docRef);
    } catch (err) {
      try {
        const rootDocRef = doc(db, "borrowed_records", id);
        await deleteDoc(rootDocRef);
      } catch (e) {
        console.warn("Failed to delete borrowed doc", e);
      }
    }
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
      const userColRef = collection(db, "users", userId, "transactions");
      const userTxSnap = await getDocs(userColRef);
      const existingTxKeys = new Set(
        userTxSnap.docs.map(d => {
          const t = d.data();
          return `${t.date}_${t.amount}_${t.categoryId || ''}_${t.note || ''}`;
        })
      );

      const userLentSnap = await getDocs(collection(db, "users", userId, "lent_records"));
      const existingLentNames = new Set(
        userLentSnap.docs.map(d => {
          const l = d.data();
          return `${l.borrowerName || l.personName || ''}_${l.amount}`;
        })
      );

      const userBorrowSnap = await getDocs(collection(db, "users", userId, "borrowed_records"));
      const existingBorrowNames = new Set(
        userBorrowSnap.docs.map(d => {
          const b = d.data();
          return `${b.lenderName || b.personName || ''}_${b.amount}`;
        })
      );

      const batch = writeBatch(db);
      let batchCount = 0;

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
      const localTx = [
        ...JSON.parse(localStorage.getItem('local_transactions') || '[]'),
        ...JSON.parse(localStorage.getItem('transactions') || '[]')
      ];

      for (const item of localTx) {
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

      // Lent records from localStorage
      const allLocalLent = [
        ...JSON.parse(localStorage.getItem('local_lent_records') || '[]'),
        ...JSON.parse(localStorage.getItem('lent_records') || '[]')
      ];

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

      // Borrowed records from localStorage
      const allLocalBorrow = [
        ...JSON.parse(localStorage.getItem('local_borrowed_records') || '[]'),
        ...JSON.parse(localStorage.getItem('borrowed_records') || '[]')
      ];

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

      // 3. Check legacy root collections in Firestore
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
