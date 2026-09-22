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
import { getLocalDateString } from "../utils/dateUtils";

// Guest (offline) persistence: per-device localStorage backing store so that
// Guest Mode actually retains data across reloads. Cloud (Firestore) is still
// used whenever a userId is present. Explicit wipe only via purgeAllLocalData().
const GUEST_KEYS = {
  transactions: 'extrack_guest_transactions',
  categories: 'extrack_guest_categories',
  settings: 'extrack_guest_settings',
  subscriptions: 'extrack_guest_subscriptions',
  accounts: 'extrack_guest_accounts',
  savingsGoals: 'extrack_guest_goals',
  events: 'extrack_guest_events',
  lentRecords: 'extrack_guest_lent',
  borrowedRecords: 'extrack_guest_borrowed',
};

const loadGuestList = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveGuestList = (key, list) => {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Ignore quota / private-mode errors; memory state still holds data
  }
};

const loadGuestObject = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const saveGuestObject = (key, obj) => {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch {
    // Ignore storage errors
  }
};

// Legacy no-op kept for backwards compatibility: previously this wiped all
// unencrypted device storage on import, which destroyed Guest Mode data.
// It is intentionally a no-op now; use purgeAllLocalData() for explicit wipe.
export const sanitizeLocalStorage = () => {};

const DEFAULT_CATEGORIES = [
  { name: 'Food', color: '#ef4444', icon: 'fa-utensils', type: 'expense' },
  { name: 'Groceries', color: '#f97316', icon: 'fa-shopping-cart', type: 'expense' },
  { name: 'Travel', color: '#eab308', icon: 'fa-plane', type: 'expense' },
  { name: 'Entertainment', color: '#8b5cf6', icon: 'fa-film', type: 'expense' },
  { name: 'Medical', color: '#ec4899', icon: 'fa-notes-medical', type: 'expense' },
  { name: 'Lent Money', color: '#f59e0b', icon: 'fa-hand-holding-dollar', type: 'expense' },
  { name: 'Debt Repayment', color: '#6366f1', icon: 'fa-handshake', type: 'expense' },
  { name: 'From Dad', color: '#22c55e', icon: 'fa-money-bill', type: 'income' },
  { name: 'Trading', color: '#10b981', icon: 'fa-chart-line', type: 'income' },
  { name: 'Borrowed Money', color: '#06b6d4', icon: 'fa-hand-holding', type: 'income' },
  { name: 'Lent Returned', color: '#10b981', icon: 'fa-circle-check', type: 'income' }
];

export const DEFAULT_ACCOUNTS = [
  { name: 'Primary Bank', type: 'bank', initialBalance: 0, color: '#3b82f6', icon: 'fa-building-columns', isDefault: true },
  { name: 'Cash Wallet', type: 'cash', initialBalance: 0, color: '#10b981', icon: 'fa-money-bill-wave', isDefault: false },
  { name: 'Credit Card', type: 'credit', initialBalance: 0, color: '#8b5cf6', icon: 'fa-credit-card', isDefault: false }
];

export const DataService = {
  // ----------------------------------------------------
  // Privacy & Local Cache Purge (explicit user action only)
  // ----------------------------------------------------
  purgeAllLocalData() {
    try {
      Object.values(GUEST_KEYS).forEach(k => {
        try { localStorage.removeItem(k); } catch { /* ignore */ }
      });
      // Also clear legacy unversioned keys if present, but preserve UI prefs
      try { sessionStorage.clear(); } catch { /* ignore */ }
    } catch {
      // Ignore storage errors
    }
    return true;
  },

  // ----------------------------------------------------
  // Transactions (users/{userId}/transactions)
  // ----------------------------------------------------
  async getTransactions(userId) {
    // Guest/offline mode: serve persisted device-local data
    if (!userId || !db) {
      const local = loadGuestList(GUEST_KEYS.transactions);
      return [...local].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
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

      // De-duplicate only for display: NEVER auto-delete user documents.
      // Two legitimate transactions can share date/amount/note (e.g. daily coffee).
      const seen = new Set();
      const uniqueList = [];

      snapshot.docs.forEach(d => {
        const data = d.data();
        const dateStr = (data.date || '').split('T')[0];
        const noteStr = (data.note || '').trim().toLowerCase();
        const amtStr = parseFloat(data.amount || 0).toFixed(2);
        const typeStr = data.type || 'expense';
        const catStr = data.categoryId || '';
        const fingerprint = `${d.id}__${dateStr}__${amtStr}__${typeStr}__${noteStr}__${catStr}`;

        if (seen.has(fingerprint)) {
          return;
        } else {
          seen.add(fingerprint);
          uniqueList.push({ id: d.id, ...data });
        }
      });

      uniqueList.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      return uniqueList;
    } catch (e) {
      console.warn("Firestore fetch transactions error:", e);
      return [];
    }
  },

  async addTransaction(transaction, userId) {
    const newTx = {
      ...transaction,
      amount: parseFloat(transaction.amount) || 0,
      createdAt: new Date().toISOString()
    };

    if (!userId || !db) {
      // Guest mode: persist to device localStorage
      const persisted = { id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), ...newTx };
      const list = loadGuestList(GUEST_KEYS.transactions);
      list.unshift(persisted);
      saveGuestList(GUEST_KEYS.transactions, list);
      return persisted;
    }

    const colRef = collection(db, "users", userId, "transactions");
    const docRef = await addDoc(colRef, newTx);
    return { id: docRef.id, ...newTx };
  },

  async updateTransaction(id, updates, userId) {
    if (!userId || !db) {
      const list = loadGuestList(GUEST_KEYS.transactions);
      const idx = list.findIndex(t => t.id === id);
      if (idx !== -1) {
        const merged = { ...list[idx], ...updates };
        if (merged.amount !== undefined) merged.amount = parseFloat(merged.amount) || 0;
        list[idx] = merged;
        saveGuestList(GUEST_KEYS.transactions, list);
        return merged;
      }
      return { id, ...updates };
    }
    if (id.startsWith('transient_') || id.startsWith('local_')) {
      return { id, ...updates };
    }

    const docRef = doc(db, "users", userId, "transactions", id);
    await updateDoc(docRef, updates);
    return { id, ...updates };
  },

  async deleteTransaction(id, userId) {
    if (!userId || !db) {
      const list = loadGuestList(GUEST_KEYS.transactions);
      saveGuestList(GUEST_KEYS.transactions, list.filter(t => t.id !== id));
      return true;
    }
    if (id.startsWith('transient_') || id.startsWith('local_')) {
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
      const local = loadGuestList(GUEST_KEYS.categories);
      if (local.length > 0) return local;
      const seeded = DEFAULT_CATEGORIES.map((c, i) => ({ id: 'local_cat_' + i, ...c }));
      saveGuestList(GUEST_KEYS.categories, seeded);
      return seeded;
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

      const existingCats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const existingNames = new Set(existingCats.map(c => (c.name || '').trim().toLowerCase()));

      // Automatically backfill any new standard default categories (e.g., Debt Repayment, Lent Returned)
      const missingDefaults = DEFAULT_CATEGORIES.filter(
        d => !existingNames.has(d.name.trim().toLowerCase())
      );

      if (missingDefaults.length > 0) {
        try {
          const batch = writeBatch(db);
          const newlyAdded = [];
          missingDefaults.forEach(cat => {
            const docRef = doc(colRef);
            batch.set(docRef, cat);
            newlyAdded.push({ id: docRef.id, ...cat });
          });
          await batch.commit();
          return [...existingCats, ...newlyAdded];
        } catch (seedErr) {
          console.warn("Error backfilling missing default categories:", seedErr);
          return [
            ...existingCats, 
            ...missingDefaults.map((c, idx) => ({ id: 'default_missing_' + idx, ...c }))
          ];
        }
      }

      return existingCats;
    } catch (e) {
      console.warn("Firestore fetch categories error:", e);
      return DEFAULT_CATEGORIES.map((c, i) => ({ id: 'default_' + i, ...c }));
    }
  },

  async addCategory(category, userId) {
    if (!userId || !db) {
      const persisted = { id: 'local_cat_' + Date.now(), ...category };
      const list = loadGuestList(GUEST_KEYS.categories);
      // Avoid duplicate names in guest store
      if (!list.some(c => c.name?.toLowerCase() === category.name?.toLowerCase() && c.type === category.type)) {
        list.push(persisted);
        saveGuestList(GUEST_KEYS.categories, list);
      }
      return persisted;
    }

    const colRef = collection(db, "users", userId, "categories");
    const docRef = await addDoc(colRef, category);
    return { id: docRef.id, ...category };
  },

  async updateCategory(id, updates, userId) {
    if (!userId || !db) {
      const list = loadGuestList(GUEST_KEYS.categories);
      const idx = list.findIndex(c => c.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates };
        saveGuestList(GUEST_KEYS.categories, list);
      }
      return updates;
    }
    if (!id) {
      return updates;
    }

    const docRef = doc(db, "users", userId, "categories", id);
    await setDoc(docRef, updates, { merge: true });
    return updates;
  },

  // ----------------------------------------------------
  // User Settings & Monthly Budget (users/{userId}/settings/config)
  // ----------------------------------------------------
  async getSettings(userId) {
    if (!userId || !db) {
      return loadGuestObject(GUEST_KEYS.settings, { monthlyBudget: 0 });
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
      const current = loadGuestObject(GUEST_KEYS.settings, { monthlyBudget: 0 });
      const merged = { ...current, ...updates };
      saveGuestObject(GUEST_KEYS.settings, merged);
      return updates;
    }

    const docRef = doc(db, "users", userId, "settings", "config");
    await setDoc(docRef, updates, { merge: true });
    return updates;
  },

  // ----------------------------------------------------
  // Subscriptions / Recurring Transactions (users/{userId}/subscriptions)
  // ----------------------------------------------------
  async getSubscriptions(userId) {
    if (!userId || !db) return loadGuestList(GUEST_KEYS.subscriptions);
    try {
      const colRef = collection(db, "users", userId, "subscriptions");
      const snapshot = await getDocs(colRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.warn("Firestore fetch subscriptions error:", e);
      return [];
    }
  },

  async addSubscription(subscription, userId) {
    if (!userId || !db) {
      const persisted = { id: 'local_sub_' + Date.now(), ...subscription };
      const list = loadGuestList(GUEST_KEYS.subscriptions);
      list.push(persisted);
      saveGuestList(GUEST_KEYS.subscriptions, list);
      return persisted;
    }
    const colRef = collection(db, "users", userId, "subscriptions");
    const docRef = await addDoc(colRef, subscription);
    return { id: docRef.id, ...subscription };
  },

  async updateSubscription(id, updates, userId) {
    if (!userId || !db) {
      const list = loadGuestList(GUEST_KEYS.subscriptions);
      const idx = list.findIndex(s => s.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates };
        saveGuestList(GUEST_KEYS.subscriptions, list);
      }
      return updates;
    }
    if (!id) return updates;
    const docRef = doc(db, "users", userId, "subscriptions", id);
    await setDoc(docRef, updates, { merge: true });
    return updates;
  },

  async deleteSubscription(id, userId) {
    if (!userId || !db) {
      saveGuestList(GUEST_KEYS.subscriptions, loadGuestList(GUEST_KEYS.subscriptions).filter(s => s.id !== id));
      return true;
    }
    if (!id) return false;
    const docRef = doc(db, "users", userId, "subscriptions", id);
    await deleteDoc(docRef);
    return true;
  },

  // ----------------------------------------------------
  // Accounts & Wallets (users/{userId}/accounts)
  // ----------------------------------------------------
  async getAccounts(userId) {
    if (!userId || !db) {
      const local = loadGuestList(GUEST_KEYS.accounts);
      if (local.length > 0) return local;
      const seeded = DEFAULT_ACCOUNTS.map((a, i) => ({ id: `local_acc_${i}`, ...a }));
      saveGuestList(GUEST_KEYS.accounts, seeded);
      return seeded;
    }

    try {
      const colRef = collection(db, "users", userId, "accounts");
      const snapshot = await getDocs(colRef);
      
      if (snapshot.empty) {
        // Seed default accounts
        const seeded = [];
        const batch = writeBatch(db);
        for (const acc of DEFAULT_ACCOUNTS) {
          const newDocRef = doc(colRef);
          batch.set(newDocRef, acc);
          seeded.push({ id: newDocRef.id, ...acc });
        }
        await batch.commit();
        return seeded;
      }

      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Firestore fetch accounts error:", e);
      return DEFAULT_ACCOUNTS.map((a, i) => ({ id: `default_acc_${i}`, ...a }));
    }
  },

  async addAccount(account, userId) {
    if (!userId || !db) {
      const persisted = { id: 'local_acc_' + Date.now(), ...account };
      const list = loadGuestList(GUEST_KEYS.accounts);
      list.push(persisted);
      saveGuestList(GUEST_KEYS.accounts, list);
      return persisted;
    }

    const colRef = collection(db, "users", userId, "accounts");
    const docRef = await addDoc(colRef, account);
    return { id: docRef.id, ...account };
  },

  async updateAccount(id, updates, userId) {
    if (!userId || !db) {
      const list = loadGuestList(GUEST_KEYS.accounts);
      const idx = list.findIndex(a => a.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates };
        saveGuestList(GUEST_KEYS.accounts, list);
      }
      return { id, ...updates };
    }
    if (!id || id.startsWith('default_acc_') || id.startsWith('transient_')) {
      return { id, ...updates };
    }

    const docRef = doc(db, "users", userId, "accounts", id);
    await setDoc(docRef, updates, { merge: true });
    return { id, ...updates };
  },

  async deleteAccount(id, userId) {
    if (!userId || !db) {
      saveGuestList(GUEST_KEYS.accounts, loadGuestList(GUEST_KEYS.accounts).filter(a => a.id !== id));
      return true;
    }
    if (!id || id.startsWith('default_acc_') || id.startsWith('transient_')) {
      return true;
    }

    const docRef = doc(db, "users", userId, "accounts", id);
    await deleteDoc(docRef);
    return true;
  },

  // ----------------------------------------------------
  // Savings Goals (users/{userId}/savings_goals)
  // ----------------------------------------------------
  async getSavingsGoals(userId) {
    if (!userId || !db) return loadGuestList(GUEST_KEYS.savingsGoals);
    try {
      const colRef = collection(db, "users", userId, "savings_goals");
      const snapshot = await getDocs(colRef);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Firestore fetch savings goals error:", e);
      return [];
    }
  },

  async addSavingsGoal(goal, userId) {
    if (!userId || !db) {
      const persisted = { id: 'local_goal_' + Date.now(), ...goal };
      const list = loadGuestList(GUEST_KEYS.savingsGoals);
      list.push(persisted);
      saveGuestList(GUEST_KEYS.savingsGoals, list);
      return persisted;
    }
    const colRef = collection(db, "users", userId, "savings_goals");
    const docRef = await addDoc(colRef, goal);
    return { id: docRef.id, ...goal };
  },

  async updateSavingsGoal(id, updates, userId) {
    if (!userId || !db) {
      const list = loadGuestList(GUEST_KEYS.savingsGoals);
      const idx = list.findIndex(g => g.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates };
        saveGuestList(GUEST_KEYS.savingsGoals, list);
      }
      return { id, ...updates };
    }
    if (!id || id.startsWith('transient_')) {
      return { id, ...updates };
    }
    const docRef = doc(db, "users", userId, "savings_goals", id);
    await setDoc(docRef, updates, { merge: true });
    return { id, ...updates };
  },

  async deleteSavingsGoal(id, userId) {
    if (!userId || !db) {
      saveGuestList(GUEST_KEYS.savingsGoals, loadGuestList(GUEST_KEYS.savingsGoals).filter(g => g.id !== id));
      return true;
    }
    if (!id || id.startsWith('transient_')) return true;
    const docRef = doc(db, "users", userId, "savings_goals", id);
    await deleteDoc(docRef);
    return true;
  },

  // ----------------------------------------------------
  // Trips & Events Tracking (users/{userId}/events)
  // ----------------------------------------------------
  async getEvents(userId) {
    if (!userId || !db) return loadGuestList(GUEST_KEYS.events);
    try {
      const colRef = collection(db, "users", userId, "events");
      const snapshot = await getDocs(colRef);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Firestore fetch events error:", e);
      return [];
    }
  },

  async addEvent(event, userId) {
    if (!userId || !db) {
      const persisted = { id: 'local_event_' + Date.now(), ...event };
      const list = loadGuestList(GUEST_KEYS.events);
      list.push(persisted);
      saveGuestList(GUEST_KEYS.events, list);
      return persisted;
    }
    const colRef = collection(db, "users", userId, "events");
    const docRef = await addDoc(colRef, event);
    return { id: docRef.id, ...event };
  },

  async updateEvent(id, updates, userId) {
    if (!userId || !db) {
      const list = loadGuestList(GUEST_KEYS.events);
      const idx = list.findIndex(e => e.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates };
        saveGuestList(GUEST_KEYS.events, list);
      }
      return { id, ...updates };
    }
    if (!id || id.startsWith('transient_')) {
      return { id, ...updates };
    }
    const docRef = doc(db, "users", userId, "events", id);
    await setDoc(docRef, updates, { merge: true });
    return { id, ...updates };
  },

  async deleteEvent(id, userId) {
    if (!userId || !db) {
      saveGuestList(GUEST_KEYS.events, loadGuestList(GUEST_KEYS.events).filter(e => e.id !== id));
      return true;
    }
    if (!id || id.startsWith('transient_')) return true;
    const docRef = doc(db, "users", userId, "events", id);
    await deleteDoc(docRef);
    return true;
  },




  async getLentRecords(userId) {
    if (!userId || !db) {
      return loadGuestList(GUEST_KEYS.lentRecords);
    }

    try {
      const colRef = collection(db, "users", userId, "lent_records");
      const snapshot = await getDocs(colRef);
      // Display-only de-dup keyed by doc id: never auto-delete user data.
      const seen = new Set();
      const uniqueList = [];

      snapshot.docs.forEach(d => {
        const data = d.data();
        const fingerprint = `${d.id}`;
        if (seen.has(fingerprint)) {
          return;
        } else {
          seen.add(fingerprint);
          uniqueList.push({ id: d.id, ...data });
        }
      });

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
            date: record.dateLent || getLocalDateString(),
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
      const persisted = { id: 'local_lent_' + Date.now(), ...newRecord };
      const list = loadGuestList(GUEST_KEYS.lentRecords);
      list.unshift(persisted);
      saveGuestList(GUEST_KEYS.lentRecords, list);
      return persisted;
    }

    const colRef = collection(db, "users", userId, "lent_records");
    const docRef = await addDoc(colRef, newRecord);
    return { id: docRef.id, ...newRecord };
  },

  async updateLentRecord(id, updates, userId) {
    if (!userId || !db) {
      const list = loadGuestList(GUEST_KEYS.lentRecords);
      const idx = list.findIndex(r => r.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates };
        saveGuestList(GUEST_KEYS.lentRecords, list);
        return list[idx];
      }
      return { id, ...updates };
    }
    if (id.startsWith('transient_') || id.startsWith('local_')) {
      return { id, ...updates };
    }

    const docRef = doc(db, "users", userId, "lent_records", id);
    await updateDoc(docRef, updates);
    return { id, ...updates };
  },

  async deleteLentRecord(id, userId) {
    if (!userId || !db) {
      saveGuestList(GUEST_KEYS.lentRecords, loadGuestList(GUEST_KEYS.lentRecords).filter(r => r.id !== id));
      return true;
    }
    if (id.startsWith('transient_') || id.startsWith('local_')) {
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
      return loadGuestList(GUEST_KEYS.borrowedRecords);
    }

    try {
      const colRef = collection(db, "users", userId, "borrowed_records");
      const snapshot = await getDocs(colRef);
      // Display-only de-dup keyed by doc id: never auto-delete user data.
      const seen = new Set();
      const uniqueList = [];

      snapshot.docs.forEach(d => {
        const data = d.data();
        const fingerprint = `${d.id}`;
        if (seen.has(fingerprint)) {
          return;
        } else {
          seen.add(fingerprint);
          uniqueList.push({ id: d.id, ...data });
        }
      });

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
            date: record.dateBorrowed || getLocalDateString(),
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
      const persisted = { id: 'local_borrow_' + Date.now(), ...newRecord };
      const list = loadGuestList(GUEST_KEYS.borrowedRecords);
      list.unshift(persisted);
      saveGuestList(GUEST_KEYS.borrowedRecords, list);
      return persisted;
    }

    const colRef = collection(db, "users", userId, "borrowed_records");
    const docRef = await addDoc(colRef, newRecord);
    return { id: docRef.id, ...newRecord };
  },

  async updateBorrowedRecord(id, updates, userId) {
    if (!userId || !db) {
      const list = loadGuestList(GUEST_KEYS.borrowedRecords);
      const idx = list.findIndex(r => r.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates };
        saveGuestList(GUEST_KEYS.borrowedRecords, list);
        return list[idx];
      }
      return { id, ...updates };
    }
    if (id.startsWith('transient_') || id.startsWith('local_')) {
      return { id, ...updates };
    }

    const docRef = doc(db, "users", userId, "borrowed_records", id);
    await updateDoc(docRef, updates);
    return { id, ...updates };
  },

  async deleteBorrowedRecord(id, userId) {
    if (!userId || !db) {
      saveGuestList(GUEST_KEYS.borrowedRecords, loadGuestList(GUEST_KEYS.borrowedRecords).filter(r => r.id !== id));
      return true;
    }
    if (id.startsWith('transient_') || id.startsWith('local_')) {
      return true;
    }

    const docRef = doc(db, "users", userId, "borrowed_records", id);
    await deleteDoc(docRef);
    return true;
  },

  // ----------------------------------------------------
  // Clean Legacy Root Firestore Collections
  // NOTE: firestore.rules denies root-collections access, so this is a
  // best-effort no-op retained for backwards compatibility.
  // ----------------------------------------------------
  async cleanRootCollections() {
    return;
  },

  // Migrate guest (device-local) records into the signed-in user's cloud
  // collections, then clear the local guest store to avoid duplicates.
  async migrateLocalDataToCloud(userId) {
    if (!userId || !db) return { count: 0 };
    try {
      let count = 0;
      const guestTx = loadGuestList(GUEST_KEYS.transactions);
      for (const { id: _txId, ...tx } of guestTx) {
        await this.addTransaction(tx, userId);
        count++;
      }
      const guestLent = loadGuestList(GUEST_KEYS.lentRecords);
      for (const { id: _lentId, ...rec } of guestLent) {
        await this.addLentRecord(rec, userId);
        count++;
      }
      const guestBorrow = loadGuestList(GUEST_KEYS.borrowedRecords);
      for (const { id: _borrowId, ...rec } of guestBorrow) {
        await this.addBorrowedRecord(rec, userId);
        count++;
      }
      const guestSubs = loadGuestList(GUEST_KEYS.subscriptions);
      for (const { id: _subId, ...s } of guestSubs) {
        await this.addSubscription(s, userId);
        count++;
      }
      const guestGoals = loadGuestList(GUEST_KEYS.savingsGoals);
      for (const { id: _goalId, ...g } of guestGoals) {
        await this.addSavingsGoal(g, userId);
        count++;
      }
      const guestEvents = loadGuestList(GUEST_KEYS.events);
      for (const { id: _eventId, ...e } of guestEvents) {
        await this.addEvent(e, userId);
        count++;
      }
      // Clear guest stores after successful migration
      Object.values(GUEST_KEYS).forEach(k => {
        if (k !== GUEST_KEYS.categories && k !== GUEST_KEYS.accounts && k !== GUEST_KEYS.settings) {
          try { localStorage.removeItem(k); } catch { /* ignore */ }
        }
      });
      return { count };
    } catch (e) {
      console.warn("migrateLocalDataToCloud error:", e);
      return { count: 0 };
    }
  }
};
