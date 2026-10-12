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
  if (!id || !type || amount === undefined || !categoryId || !date) {
    return res.status(400).json({ error: 'Missing required fields: id, type, amount, categoryId, date' });
  }
  const stmt = db.prepare("INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?)");
  stmt.run(id, type, amount, categoryId, date, note ?? null, createdAt ?? new Date().toISOString(), function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json(req.body);
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
  if (!Array.isArray(transactions)) {
    return res.status(400).json({ error: 'Body must be an array of transactions' });
  }
  const bad = transactions.findIndex(t => !t || !t.id || !t.type || t.amount === undefined || !t.date);
  if (bad !== -1) {
    return res.status(400).json({ error: `Invalid transaction at index ${bad}: id, type, amount and date are required` });
  }

  db.run("BEGIN TRANSACTION");
  const stmt = db.prepare("INSERT OR REPLACE INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?)");
  let failed = null;
  transactions.forEach(t => {
    if (failed) return;
    stmt.run(t.id, t.type, t.amount, t.categoryId, t.date, t.note ?? null, t.createdAt ?? new Date().toISOString(), (err) => {
      if (err && !failed) failed = err.message;
    });
  });
  stmt.finalize((err) => {
    if (err && !failed) failed = err.message;
  });

  db.run("COMMIT", (commitErr) => {
    if (failed || commitErr) {
      db.run("ROLLBACK", () => {
        return res.status(500).json({ error: failed || commitErr?.message || 'Transaction failed' });
      });
      return;
    }
    res.json({ success: true, imported: transactions.length });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://0.0.0.0:${PORT}`);
});
