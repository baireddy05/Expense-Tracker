import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Papa from 'papaparse';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faFileCsv, faCheckCircle, faExclamationTriangle, faUpload } from '@fortawesome/free-solid-svg-icons';
import { useTransactions } from '../../context/TransactionContext';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import toast from 'react-hot-toast';

// Header aliases (lowercased) for auto-mapping CSV columns
const COLUMN_ALIASES = {
  date: ['date', 'txn date', 'transaction date', 'day', 'value date', 'posting date'],
  type: ['type', 'txn type', 'transaction type', 'dr/cr', 'debit/credit', 'debit or credit', 'kind'],
  category: ['category', 'cat', 'head', 'expense head', 'class'],
  amount: ['amount', 'amt', 'value', 'price', 'rs', 'rs.', 'inr', 'debit', 'credit', 'withdrawal', 'deposit'],
  note: ['note', 'narration', 'description', 'remarks', 'memo', 'details', 'particulars', 'comment'],
};

const EXPENSE_WORDS = new Set(['expense', 'expenses', 'debit', 'debits', 'dr', 'out', 'spent', 'paid', 'payment', 'withdrawal', 'debit card']);
const INCOME_WORDS = new Set(['income', 'incomes', 'credit', 'credits', 'cr', 'in', 'received', 'deposit', 'salary', 'refund']);

// Parse a loose date cell into local YYYY-MM-DD, or null if unparseable
export const normalizeImportDate = (raw) => {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // ISO YYYY-MM-DD (optionally with time suffix)
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const y = m[1];
    const mo = m[2].padStart(2, '0');
    const d = m[3].padStart(2, '0');
    const dt = new Date(`${y}-${mo}-${d}T12:00:00`);
    return isNaN(dt.getTime()) ? null : `${y}-${mo}-${d}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY (with MM/DD/YYYY fallback when unambiguous)
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = '20' + y;
    // Default DD/MM; only treat as MM/DD when day-first is impossible
    let d = a.padStart(2, '0');
    let mo = b.padStart(2, '0');
    if (parseInt(b, 10) > 12 && parseInt(a, 10) <= 12) {
      d = b.padStart(2, '0');
      mo = a.padStart(2, '0');
    }
    if (parseInt(mo, 10) < 1 || parseInt(mo, 10) > 12 || parseInt(d, 10) < 1 || parseInt(d, 10) > 31) {
      return null;
    }
    const dt = new Date(`${y}-${mo}-${d}T12:00:00`);
    return isNaN(dt.getTime()) ? null : `${y}-${mo}-${d}`;
  }

  // Last resort: native parse (e.g. "12 Jan 2026"), formatted back to local YMD
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  return null;
};

const normalizeImportType = (raw) => {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'expense';
  if (INCOME_WORDS.has(s)) return 'income';
  if (EXPENSE_WORDS.has(s)) return 'expense';
  if (s.includes('income') || s.includes('credit') || s.includes('received')) return 'income';
  return 'expense';
};

const autoMapColumns = (headers) => {
  const lower = headers.map(h => String(h || '').trim().toLowerCase());
  const mapping = { date: '', type: '', category: '', amount: '', note: '' };
  Object.entries(COLUMN_ALIASES).forEach(([field, aliases]) => {
    for (const alias of aliases) {
      const idx = lower.indexOf(alias);
      if (idx !== -1) {
        mapping[field] = headers[idx];
        break;
      }
    }
  });
  return mapping;
};

const CsvImportModal = ({ isOpen, onClose, file }) => {
  const { transactions = [], categories = [], accounts = [], addTransaction } = useTransactions();

  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({ date: '', type: '', category: '', amount: '', note: '' });
  const [parseError, setParseError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);

  useBodyScrollLock(isOpen);

  // Parse the CSV whenever a new file arrives
  useEffect(() => {
    if (!isOpen || !file) return;
    setParseError('');
    setResult(null);
    setProgress({ done: 0, total: 0 });
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const cols = res.meta?.fields || [];
        if (cols.length === 0) {
          setParseError('No columns found. The CSV needs a header row (Date, Type, Category, Amount, Note).');
          setHeaders([]);
          setRawRows([]);
          return;
        }
        setHeaders(cols);
        setRawRows(res.data || []);
        setMapping(autoMapColumns(cols));
        if (res.errors?.length > 0) {
          console.warn('CSV parse warnings:', res.errors.slice(0, 3));
        }
      },
      error: (err) => {
        setParseError(err.message || 'Could not read this CSV file.');
      }
    });
  }, [isOpen, file]);

  const existingFingerprints = useMemo(() => {
    const set = new Set();
    transactions.forEach(t => {
      const dateStr = (t.date || '').split('T')[0];
      const amtStr = parseFloat(t.amount || 0).toFixed(2);
      const noteStr = (t.note || '').trim().toLowerCase();
      set.add(`${dateStr}__${amtStr}__${t.type || 'expense'}__${noteStr}__${t.categoryId || ''}`);
    });
    return set;
  }, [transactions]);

  const defaultAccountId = accounts.find(a => a.isDefault)?.id || accounts[0]?.id || '';

  // Map raw rows → normalized preview rows with status
  const previewRows = useMemo(() => {
    if (!mapping.date || !mapping.amount) return [];
    return rawRows.map((row, idx) => {
      const date = normalizeImportDate(row[mapping.date]);
      const amt = parseFloat(String(row[mapping.amount] ?? '').replace(/[,₹\s]/g, ''));
      const type = normalizeImportType(mapping.type ? row[mapping.type] : '');
      const note = String(mapping.note ? (row[mapping.note] ?? '') : '').trim();
      const catName = String(mapping.category ? (row[mapping.category] ?? '') : '').trim();

      if (!date || !amt || isNaN(amt) || amt <= 0) {
        return { idx, status: 'invalid', date, amount: amt, type, note, catName, categoryId: '', reason: !date ? 'Bad date' : 'Bad amount' };
      }

      let cat = catName
        ? categories.find(c => c.name?.toLowerCase() === catName.toLowerCase() && c.type === type)
          || categories.find(c => c.name?.toLowerCase() === catName.toLowerCase())
        : null;
      if (!cat) cat = categories.find(c => c.type === type);
      const categoryId = cat?.id || '';

      const fp = `${date}__${amt.toFixed(2)}__${type}__${note.toLowerCase()}__${categoryId}`;
      if (existingFingerprints.has(fp)) {
        return { idx, status: 'duplicate', date, amount: amt, type, note, catName: cat?.name || catName, categoryId, reason: 'Already in ledger' };
      }
      return { idx, status: 'new', date, amount: amt, type, note, catName: cat?.name || catName || 'General', categoryId };
    });
  }, [rawRows, mapping, categories, existingFingerprints]);

  const counts = useMemo(() => ({
    total: previewRows.length,
    fresh: previewRows.filter(r => r.status === 'new').length,
    duplicates: previewRows.filter(r => r.status === 'duplicate').length,
    invalid: previewRows.filter(r => r.status === 'invalid').length,
  }), [previewRows]);

  const handleImport = async () => {
    const toImport = previewRows.filter(r => r.status === 'new');
    if (toImport.length === 0) {
      toast.error('Nothing new to import.');
      return;
    }
    setIsImporting(true);
    setProgress({ done: 0, total: toImport.length });
    let imported = 0;
    try {
      for (const r of toImport) {
        await addTransaction({
          amount: r.amount,
          type: r.type,
          categoryId: r.categoryId,
          accountId: defaultAccountId || undefined,
          date: r.date,
          note: r.note,
        });
        imported++;
        setProgress({ done: imported, total: toImport.length });
      }
      setResult({ imported, skipped: counts.duplicates + counts.invalid });
      toast.success(`Imported ${imported} transaction(s)! Skipped ${counts.duplicates + counts.invalid}.`);
    } catch (err) {
      console.error('CSV import error:', err);
      toast.error(`Imported ${imported} of ${toImport.length} before an error stopped the import.`);
      setResult({ imported, skipped: counts.duplicates + counts.invalid, partial: true });
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  const canPreview = mapping.date && mapping.amount;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 animate-fade-in"
      onClick={isImporting ? undefined : onClose}
    >
      <div
        className="w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/80 dark:border-white/10 flex flex-col max-h-[92dvh] animate-slide-up sm:animate-pop-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">
              <FontAwesomeIcon icon={faFileCsv} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white leading-tight">
                Import Transactions from CSV
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight truncate max-w-[240px] sm:max-w-none">
                {file?.name || 'Bank / UPI statement'} • {rawRows.length} row(s) found
              </p>
            </div>
          </div>
          {!isImporting && (
            <button
              type="button"
              onClick={onClose}
              title="Close"
              aria-label="Close CSV import"
              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors touch-feedback cursor-pointer"
            >
              <FontAwesomeIcon icon={faTimes} className="text-xs" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {parseError ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
              <FontAwesomeIcon icon={faExclamationTriangle} className="mt-0.5 shrink-0" />
              <span>{parseError}</span>
            </div>
          ) : (
            <>
              {/* Column mapping */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                  Map CSV columns (Date + Amount required)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'date', label: 'Date *' },
                    { key: 'amount', label: 'Amount *' },
                    { key: 'type', label: 'Type' },
                    { key: 'category', label: 'Category' },
                    { key: 'note', label: 'Note' },
                  ].map(col => (
                    <label key={col.key} className="block">
                      <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">{col.label}</span>
                      <select
                        value={mapping[col.key]}
                        onChange={e => setMapping(prev => ({ ...prev, [col.key]: e.target.value }))}
                        className="mt-1 w-full px-2.5 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white cursor-pointer"
                      >
                        <option value="">— ignore —</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              {/* Counts */}
              {canPreview && (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'New', value: counts.fresh, cls: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Duplicates', value: counts.duplicates, cls: 'text-amber-600 dark:text-amber-400' },
                    { label: 'Invalid', value: counts.invalid, cls: 'text-rose-500' },
                    { label: 'Total', value: counts.total, cls: 'text-zinc-900 dark:text-white' },
                  ].map(s => (
                    <div key={s.label} className="p-2.5 rounded-xl liquid-glass-subtle text-center">
                      <p className={`text-base font-bold ${s.cls}`}>{s.value}</p>
                      <p className="text-[10px] text-zinc-400 font-medium">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Preview */}
              {canPreview && previewRows.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                    Preview (first 50 rows)
                  </p>
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
                      {previewRows.slice(0, 50).map(r => (
                        <div key={r.idx} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-zinc-900 dark:text-white truncate">
                              {r.note || r.catName || '—'}
                            </p>
                            <p className="text-[10px] text-zinc-400">
                              {r.date || 'bad date'} • {r.catName || 'no category'}
                              {r.reason ? ` • ${r.reason}` : ''}
                            </p>
                          </div>
                          <span className={`font-bold shrink-0 ${r.type === 'income' ? 'text-emerald-500' : 'text-zinc-900 dark:text-white'}`}>
                            {r.type === 'income' ? '+' : '-'}₹{(r.amount || 0).toLocaleString('en-IN')}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            r.status === 'new'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : r.status === 'duplicate'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : 'bg-rose-500/15 text-rose-500'
                          }`}>
                            {r.status === 'new' ? 'NEW' : r.status === 'duplicate' ? 'DUP' : 'SKIP'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!canPreview && (
                <p className="text-xs text-zinc-400 text-center py-4">
                  Map at least the <strong>Date</strong> and <strong>Amount</strong> columns to preview rows.
                </p>
              )}

              {/* Progress / result */}
              {isImporting && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-zinc-500">Importing…</span>
                    <span className="text-zinc-900 dark:text-white font-mono">{progress.done}/{progress.total}</span>
                  </div>
                  <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all rounded-full"
                      style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
              {result && !isImporting && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <FontAwesomeIcon icon={faCheckCircle} />
                  <span>
                    Imported <strong>{result.imported}</strong> transaction(s), skipped <strong>{result.skipped}</strong>
                    {result.partial ? ' (stopped early on error)' : ''}. Duplicates were matched on date + amount + type + note.
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800/80 shrink-0 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="flex-1 py-2.5 rounded-xl font-semibold text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors touch-feedback cursor-pointer disabled:opacity-50"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleImport}
              disabled={isImporting || counts.fresh === 0}
              className="flex-[2] py-2.5 rounded-xl font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-500 transition-colors touch-feedback cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <FontAwesomeIcon icon={faUpload} className="text-[10px]" />
              <span>{isImporting ? `Importing ${progress.done}/${progress.total}…` : `Import ${counts.fresh} new transaction(s)`}</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CsvImportModal;
