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

// Immediate top-level sanitization: wipe all unencrypted device storage
export const sanitizeLocalStorage = () => {
  try {
    const allowedKeys = new Set(['theme', 'extrack_privacy_mode']);
    const keys = Object.keys(localStorage);
    keys.forEach(k => {
      if (!allowedKeys.has(k)) {
        localStorage.removeItem(k);
      }
    });
    sessionStorage.clear();
  } catch (e) {
    // Ignore in restrictive environments
  }
};

// Run on module evaluation
sanitizeLocalStorage();

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
    sanitizeLocalStorage();
    return true;
  },

  // ----------------------------------------------------
  // Transactions (users/{userId}/transactions)
  // ----------------------------------------------------
  async getTransactions(userId) {
    // If not authenticated, NEVER return or read local unencrypted data
    if (!userId || !db) {
      this.purgeAllLocalData();
      return [];
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

      // Always purge any local device storage copies for complete security
      this.purgeAllLocalData();
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
      // In guest mode, do not write to persistent device localStorage
      return { id: 'transient_' + Date.now(), ...newTx };
    }

    const colRef = collection(db, "users", userId, "transactions");
    const docRef = await addDoc(colRef, newTx);
    return { id: docRef.id, ...newTx };
  },

  async updateTransaction(id, updates, userId) {
    if (!userId || !db || id.startsWith('transient_') || id.startsWith('local_')) {
      return { id, ...updates };
    }

    const docRef = doc(db, "users", userId, "transactions", id);
    await updateDoc(docRef, updates);
    return { id, ...updates };
  },

  async deleteTransaction(id, userId) {
    if (!userId || !db || id.startsWith('transient_') || id.startsWith('local_')) {
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
      return DEFAULT_CATEGORIES.map((c, i) => ({ id: 'default_' + i, ...c }));
    }

    try {
      const colRef = collection(db, "users", userId, "categories");
      const snapshot = await getDocs(colRef);
      
      if (snapshot.empty) {
        // Seed default categories for this user
        const batch = writeBatch(db);
        const seeded = [];
        DEFAULT_CATEGORIES.forEach(cat => {
          const docRef = doc(colRef);
          batch.set(docRef, cat);
          seeded.push({ id: docRef.id, ...cat });
        });
        await batch.commit();
        return seeded;
      }

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.warn("Firestore fetch categories error:", e);
      return DEFAULT_CATEGORIES.map((c, i) => ({ id: 'default_' + i, ...c }));
    }
  },

  async addCategory(category, userId) {
    if (!userId || !db) {
      return { id: 'transient_cat_' + Date.now(), ...category };
    }

    const colRef = collection(db, "users", userId, "categories");
    const docRef = await addDoc(colRef, category);
    return { id: docRef.id, ...category };
  },

  // ----------------------------------------------------
  // User Settings & Monthly Budget (users/{userId}/settings/config)
  // ----------------------------------------------------
  async getSettings(userId) {
    if (!userId || !db) {
      return { monthlyBudget: 0 };
    }

    try {
      const docRef = doc(db, "users", userId, "settings", "config");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data();
      }
      return { monthlyBudget: 0 };
    } catch (e) {
      console.warn("Firestore fetch settings error:", e);
      return { monthlyBudget: 0 };
    }
  },

  async updateSettings(updates, userId) {
    if (!userId || !db) {
      return updates;
    }

    const docRef = doc(db, "users", userId, "settings", "config");
    await setDoc(docRef, updates, { merge: true });
    return updates;
  },

  // ----------------------------------------------------
  // Lent Records (users/{userId}/lent_records)
  // ----------------------------------------------------
  async getLentRecords(userId) {
    // If not authenticated, NEVER return or read unencrypted local data
    if (!userId || !db) {
      this.purgeAllLocalData();
      return [];
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

      this.purgeAllLocalData();
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
      return { id: 'transient_lent_' + Date.now(), ...newRecord };
    }

    const colRef = collection(db, "users", userId, "lent_records");
    const docRef = await addDoc(colRef, newRecord);
    return { id: docRef.id, ...newRecord };
  },

  async updateLentRecord(id, updates, userId) {
    if (!userId || !db || id.startsWith('transient_') || id.startsWith('local_')) {
      return { id, ...updates };
    }

    const docRef = doc(db, "users", userId, "lent_records", id);
    await updateDoc(docRef, updates);
    return { id, ...updates };
  },

  async deleteLentRecord(id, userId) {
    if (!userId || !db || id.startsWith('transient_') || id.startsWith('local_')) {
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
    // If not authenticated, NEVER return or read unencrypted local data
    if (!userId || !db) {
      this.purgeAllLocalData();
      return [];
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

      this.purgeAllLocalData();
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
      return { id: 'transient_borrow_' + Date.now(), ...newRecord };
    }

    const colRef = collection(db, "users", userId, "borrowed_records");
    const docRef = await addDoc(colRef, newRecord);
    return { id: docRef.id, ...newRecord };
  },

  async updateBorrowedRecord(id, updates, userId) {
    if (!userId || !db || id.startsWith('transient_') || id.startsWith('local_')) {
      return { id, ...updates };
    }

    const docRef = doc(db, "users", userId, "borrowed_records", id);
    await updateDoc(docRef, updates);
    return { id, ...updates };
  },

  async deleteBorrowedRecord(id, userId) {
    if (!userId || !db || id.startsWith('transient_') || id.startsWith('local_')) {
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
