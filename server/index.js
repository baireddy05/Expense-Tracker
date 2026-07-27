import express from 'express';
import cors from 'cors';
import db from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/categories', (req, res) => {
  db.all("SELECT * FROM categories", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/transactions', (req, res) => {
  db.all("SELECT * FROM transactions", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/transactions', (req, res) => {
  const { id, type, amount, categoryId, date, note, createdAt } = req.body;
  const stmt = db.prepare("INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?)");
  stmt.run(id, type, amount, categoryId, date, note, createdAt, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json(req.body);
  });
});

app.put('/api/transactions/:id', (req, res) => {
  const { type, amount, categoryId, date, note } = req.body;
  const stmt = db.prepare(`
    UPDATE transactions 
    SET type = ?, amount = ?, categoryId = ?, date = ?, note = ?
    WHERE id = ?
  `);
  stmt.run(type, amount, categoryId, date, note, req.params.id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: req.params.id, ...req.body });
  });
});

app.delete('/api/transactions/:id', (req, res) => {
  db.run("DELETE FROM transactions WHERE id = ?", req.params.id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post('/api/transactions/import', (req, res) => {
  const transactions = req.body;
  db.run("BEGIN TRANSACTION");
  const stmt = db.prepare("INSERT OR REPLACE INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?)");
  transactions.forEach(t => {
    stmt.run(t.id, t.type, t.amount, t.categoryId, t.date, t.note, t.createdAt);
  });
  stmt.finalize();
  db.run("COMMIT", (err) => {
    if (err) {
      db.run("ROLLBACK");
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://0.0.0.0:${PORT}`);
});
