import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new (sqlite3.verbose().Database)(dbPath);

// Initialize tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      type TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      categoryId TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      createdAt TEXT NOT NULL
    )
  `);
  
  // Insert default categories if none exist
  db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
    if (row && row.count === 0) {
      const defaultCategories = [
        { id: '1', name: 'Food', color: '#ef4444', icon: 'fa-utensils', type: 'expense' },
        { id: '2', name: 'Rent', color: '#3b82f6', icon: 'fa-home', type: 'expense' },
        { id: '3', name: 'Travel', color: '#eab308', icon: 'fa-plane', type: 'expense' },
        { id: '4', name: 'Entertainment', color: '#8b5cf6', icon: 'fa-film', type: 'expense' },
        { id: '5', name: 'Utilities', color: '#06b6d4', icon: 'fa-bolt', type: 'expense' },
        { id: '6', name: 'Salary', color: '#22c55e', icon: 'fa-money-bill', type: 'income' },
        { id: '7', name: 'Freelance', color: '#10b981', icon: 'fa-laptop-code', type: 'income' },
      ];
      
      const stmt = db.prepare("INSERT INTO categories VALUES (?, ?, ?, ?, ?)");
      defaultCategories.forEach(c => stmt.run(c.id, c.name, c.color, c.icon, c.type));
      stmt.finalize();
    }
  });
});

export default db;
