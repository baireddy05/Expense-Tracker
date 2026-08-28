import React, { useState, useMemo, useEffect } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import TransactionForm from '../components/transactions/TransactionForm';
import ConfirmModal from '../components/ui/ConfirmModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, 
  faTrash, 
  faEdit, 
  faSearch, 
  faFilter, 
  faFilePdf, 
  faCalendarAlt, 
  faTags,
  faChevronDown,
  faChevronUp,
  faCalendarDay,
  faLayerGroup,
  faExpandAlt,
  faCompressAlt,
  faShieldAlt
} from '@fortawesome/free-solid-svg-icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TransactionsSkeleton } from '../components/ui/Skeleton';
import SwipeableItem from '../components/transactions/SwipeableItem';
import { getCategoryIcon, resolveCategory } from '../utils/categoryIcons';
import toast from 'react-hot-toast';

const Transactions = () => {
  const { transactions, categories, deleteTransaction, loading } = useTransactions();
  const { isPrivacyMode } = useUI();
  const { currentUser, openAuthModal } = useAuth();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [formDefaultDate, setFormDefaultDate] = useState(null);
  const [formDefaultType, setFormDefaultType] = useState('expense');
  
  const [search, setSearch] = useState('');
  const getLocalToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [filterType, setFilterType] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [customDate, setCustomDate] = useState(getLocalToday());
  const [selectedDateGroup, setSelectedDateGroup] = useState('all');
  const [expandedDates, setExpandedDates] = useState({});
  
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null });
  const [pdfConfirmOpen, setPdfConfirmOpen] = useState(false);
  const [swipeResetToken, setSwipeResetToken] = useState(0);

  const getDateKey = (dateVal) => {
    if (!dateVal) return 'Unknown Date';
    if (typeof dateVal === 'string' && dateVal.length >= 10 && dateVal[4] === '-' && dateVal[7] === '-') {
      return dateVal.slice(0, 10);
    }
    try {
      const d = new Date(dateVal?.seconds ? dateVal.seconds * 1000 : dateVal);
      if (isNaN(d.getTime())) return 'Unknown Date';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return 'Unknown Date';
    }
  };

  const formatDateHeader = (dateKey) => {
    if (!dateKey || dateKey === 'Unknown Date') return 'Unknown Date';
    try {
      const [y, m, d] = dateKey.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      if (isNaN(dateObj.getTime())) return dateKey;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const compareDate = new Date(y, m - 1, d);
      compareDate.setHours(0, 0, 0, 0);

      let prefix = '';
      if (compareDate.getTime() === today.getTime()) {
        prefix = 'Today - ';
      } else if (compareDate.getTime() === yesterday.getTime()) {
        prefix = 'Yesterday - ';
      }

      const formatted = dateObj.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      return prefix ? `${prefix}${formatted}` : formatted;
    } catch {
      return dateKey;
    }
  };

  const filteredTransactions = useMemo(() => {
    const searchLower = (search || '').trim().toLowerCase();
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    return transactions
      .filter(t => {
        const cat = resolveCategory(t.categoryId, categories, t.note);
        if (searchLower) {
          const noteMatch = t.note?.toLowerCase().includes(searchLower);
          const catMatch = cat?.name?.toLowerCase().includes(searchLower);
          const tagMatch = t.tags && t.tags.some(tag => tag.toLowerCase().includes(searchLower.replace(/^#/, '')));
          const eventMatch = t.eventTag && t.eventTag.toLowerCase().includes(searchLower.replace(/^#/, ''));
          if (!noteMatch && !catMatch && !tagMatch && !eventMatch) return false;
        }

        if (filterType !== 'all' && t.type !== filterType) return false;
        if (categoryFilter !== 'all' && t.categoryId !== categoryFilter && cat?.id !== categoryFilter) return false;

        if (timeFilter !== 'all') {
          const txDate = new Date(t.date);
          if (timeFilter === 'today') {
            if (txDate.toDateString() !== todayStr) return false;
          } else if (timeFilter === 'yesterday') {
            if (txDate.toDateString() !== yesterdayStr) return false;
          } else if (timeFilter === 'week') {
            if (txDate < startOfWeek) return false;
          } else if (timeFilter === 'month') {
            if (txDate.getMonth() !== currentMonth || txDate.getFullYear() !== currentYear) return false;
          } else if (timeFilter === 'year') {
            if (txDate.getFullYear() !== currentYear) return false;
          } else if (timeFilter === 'custom' && customDate) {
            const dateStr = typeof t.date === 'string' && t.date.length >= 10 ? t.date.slice(0, 10) : '';
            if (dateStr !== customDate) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const bDateStr = typeof b.date === 'string' ? b.date : '';
        const aDateStr = typeof a.date === 'string' ? a.date : '';
        if (bDateStr !== aDateStr) {
          return bDateStr > aDateStr ? 1 : -1;
        }
        const bCreated = b.createdAt || '';
        const aCreated = a.createdAt || '';
        return bCreated > aCreated ? 1 : (bCreated < aCreated ? -1 : 0);
      });
  }, [transactions, search, filterType, categoryFilter, timeFilter, customDate, categories]);

  // Group transactions by date
  const dateGroups = useMemo(() => {
    const groupsMap = {};

    filteredTransactions.forEach(t => {
      const key = getDateKey(t.date);
      if (!groupsMap[key]) {
        groupsMap[key] = {
          dateKey: key,
          items: [],
          totalIncome: 0,
          totalExpense: 0
        };
      }
      groupsMap[key].items.push(t);
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') {
        groupsMap[key].totalIncome += amt;
      } else {
        groupsMap[key].totalExpense += amt;
      }
    });

    return Object.values(groupsMap).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filteredTransactions]);

  const displayedDateGroups = useMemo(() => {
    if (selectedDateGroup === 'all') return dateGroups;
    return dateGroups.filter(g => g.dateKey === selectedDateGroup);
  }, [dateGroups, selectedDateGroup]);

  const displayedTransactions = useMemo(() => {
    if (timeFilter === 'all' && selectedDateGroup !== 'all') {
      return filteredTransactions.filter(t => getDateKey(t.date) === selectedDateGroup);
    }
    return filteredTransactions;
  }, [filteredTransactions, timeFilter, selectedDateGroup]);

  const summaryStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    displayedTransactions.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') income += amt;
      else expense += amt;
    });
    return {
      income,
      expense,
      net: income - expense,
      count: displayedTransactions.length
    };
  }, [displayedTransactions]);

  // Reset selected date if timeFilter changes
  useEffect(() => {
    if (timeFilter !== 'all') {
      setSelectedDateGroup('all');
    }
  }, [timeFilter]);

  const isDateExpanded = (dateKey) => {
    if (expandedDates[dateKey] !== undefined) return expandedDates[dateKey];
    if (selectedDateGroup === dateKey) return true;
    return dateGroups.length <= 2;
  };

  const toggleDateExpand = (dateKey) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateKey]: !isDateExpanded(dateKey)
    }));
  };

  const expandAllDates = () => {
    const next = {};
    dateGroups.forEach(g => {
      next[g.dateKey] = true;
    });
    setExpandedDates(next);
  };

  const collapseAllDates = () => {
    const next = {};
    dateGroups.forEach(g => {
      next[g.dateKey] = false;
    });
    setExpandedDates(next);
  };

  const openAddTransaction = (presetDate = null, presetType = 'expense') => {
    let targetDate = presetDate;
    if (!targetDate) {
      if (timeFilter === 'custom' && customDate) {
        targetDate = customDate;
      } else if (timeFilter === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const year = y.getFullYear();
        const month = String(y.getMonth() + 1).padStart(2, '0');
        const day = String(y.getDate()).padStart(2, '0');
        targetDate = `${year}-${month}-${day}`;
      } else if (timeFilter === 'today') {
        targetDate = getLocalToday();
      } else if (timeFilter === 'all' && selectedDateGroup !== 'all') {
        targetDate = selectedDateGroup;
      } else {
        targetDate = getLocalToday();
      }
    }
    setFormDefaultDate(targetDate);
    setFormDefaultType(presetType);
    setEditingTx(null);
    setIsFormOpen(true);
  };

  const handleEdit = (tx) => {
    setEditingTx(tx);
    setFormDefaultDate(null);
    setFormDefaultType(tx.type || 'expense');
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setTimeout(() => {
      setEditingTx(null);
      setFormDefaultDate(null);
    }, 300);
  };

  const requestDelete = (id) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (deleteConfirm.id) {
      try {
        await deleteTransaction(deleteConfirm.id);
        toast.success('Transaction deleted');
      } catch {
        toast.error('Failed to delete transaction');
      }
    }
  };

  const formatCurrency = (amount) => {
    if (isPrivacyMode) {
      return '₹••••••';
    }
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  const formatCurrencyPDF = (amount) => {
    return 'Rs. ' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.setTextColor(31, 41, 55);
    doc.text("Transactions Report", 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`, 14, 32);
    const catName = categoryFilter === 'all' ? 'ALL' : (resolveCategory(categoryFilter, categories)?.name || 'UNKNOWN');
    const dateText = timeFilter === 'all' && selectedDateGroup !== 'all' ? ` | Date: ${formatDateHeader(selectedDateGroup)}` : '';
    doc.text(`Filters: Type: ${filterType.toUpperCase()} | Cat: ${catName.toUpperCase()} | Time: ${timeFilter.toUpperCase()}${dateText} | Search: "${search || 'None'}"`, 14, 38);

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(14, 42, 196, 42);

    const tableColumn = ["Date", "Type", "Category", "Note", "Amount"];
    const tableRows = [];

    let totalIncome = 0;
    let totalExpense = 0;

    displayedTransactions.forEach(t => {
      const cat = resolveCategory(t.categoryId, categories, t.note);
      if (t.type === 'income') totalIncome += t.amount;
      else totalExpense += t.amount;

      tableRows.push([
        new Date(t.date).toLocaleDateString('en-IN'),
        t.type === 'income' ? 'Income' : 'Expense',
        cat ? cat.name : 'Unknown',
        t.note || '-',
        (t.type === 'income' ? '+' : '-') + formatCurrencyPDF(t.amount)
      ]);
    });

    tableRows.push(['', '', '', 'Total Income:', '+' + formatCurrencyPDF(totalIncome)]);
    tableRows.push(['', '', '', 'Total Expense:', '-' + formatCurrencyPDF(totalExpense)]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 48,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 4, textColor: [55, 65, 81] },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: function(data) {
        if (data.row.index >= displayedTransactions.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [243, 244, 246];
          data.cell.styles.textColor = [17, 24, 39];
          
          if (data.row.index === displayedTransactions.length && data.column.index === 4) {
            data.cell.styles.textColor = [34, 197, 94];
          }
          if (data.row.index === displayedTransactions.length + 1 && data.column.index === 4) {
            data.cell.styles.textColor = [239, 68, 68];
          }
        }
      }
    });

    doc.save(`transactions_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportPDF = () => {
    if (displayedTransactions.length === 0) {
      alert("No transactions to export for the selected filters.");
      return;
    }
    
    setPdfConfirmOpen(true);
  };

  if (loading) return <TransactionsSkeleton />;

  return (
    <div className="space-y-6 relative h-full">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Transactions</h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Comprehensive income & expense log</p>
        </div>
        
        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
          <button 
            onClick={handleExportPDF}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80 hover:bg-zinc-50 dark:hover:bg-zinc-800 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all touch-feedback cursor-pointer shadow-2xs"
          >
            <FontAwesomeIcon icon={faFilePdf} className="text-rose-500 text-xs" />
            <span>Export PDF</span>
          </button>
          
          <button 
            onClick={() => openAddTransaction()}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 px-4.5 py-2.5 rounded-xl text-xs font-semibold transition-all touch-feedback shadow-xs cursor-pointer"
          >
            <FontAwesomeIcon icon={faPlus} className="text-xs" />
            <span>New Transaction</span>
          </button>
        </div>
      </header>

      {/* Guest Mode Cloud Security Banner */}
      {!currentUser && (
        <div className="p-4 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 dark:bg-zinc-900/10 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faShieldAlt} />
            </div>
            <div>
              <p className="text-xs font-bold">Cloud Synced Financial Ledger</p>
              <p className="text-[11px] opacity-80">Sign in with your Google account to access your encrypted transaction history.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="px-3.5 py-1.5 bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shrink-0 touch-feedback"
          >
            Sign In with Google
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className={`glass-card p-4 grid grid-cols-1 sm:grid-cols-2 ${timeFilter === 'all' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-2.5 transition-all`}>
        {/* Search */}
        <div className="relative sm:col-span-2 lg:col-span-1">
          <FontAwesomeIcon icon={faSearch} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs" />
          <input 
            type="text" 
            placeholder="Search records..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none transition-all dark:text-white text-xs"
          />
        </div>

        {/* Time Period Filter */}
        <div className="relative">
          <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs" />
          <select 
            value={timeFilter}
            onChange={e => {
              setTimeFilter(e.target.value);
              if (e.target.value !== 'all') setSelectedDateGroup('all');
            }}
            className="w-full pl-9 pr-3.5 py-2 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none transition-all dark:text-white appearance-none text-xs cursor-pointer"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
            <option value="custom">Specific Date</option>
          </select>
        </div>

        {/* Dropdown for each recorded date when All Time is selected */}
        {timeFilter === 'all' && (
          <div className="relative animate-fade-in sm:col-span-2 lg:col-span-1">
            <FontAwesomeIcon icon={faCalendarDay} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <select 
              value={selectedDateGroup}
              onChange={e => {
                const val = e.target.value;
                setSelectedDateGroup(val);
                if (val !== 'all') {
                  setExpandedDates(prev => ({ ...prev, [val]: true }));
                }
              }}
              className="w-full pl-9 pr-8 py-2 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none transition-all dark:text-white appearance-none text-xs cursor-pointer font-medium"
            >
              <option value="all">📅 All Dates ({dateGroups.length} days)</option>
              {dateGroups.map(g => (
                <option key={g.dateKey} value={g.dateKey}>
                  {formatDateHeader(g.dateKey)} ({g.items.length} {g.items.length === 1 ? 'tx' : 'txs'})
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-[10px]">
              ▼
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="relative">
          <FontAwesomeIcon icon={faTags} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs" />
          <select 
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none transition-all dark:text-white appearance-none text-xs cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div className="relative">
          <FontAwesomeIcon icon={faFilter} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs" />
          <select 
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none transition-all dark:text-white appearance-none text-xs cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>

        {timeFilter === 'custom' && (
          <div className="relative sm:col-span-2 lg:col-span-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 animate-fade-in">
            <input 
              type="date" 
              value={customDate}
              onChange={e => setCustomDate(e.target.value)}
              className="flex-1 px-3.5 py-2 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none transition-all dark:text-white text-xs font-medium"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openAddTransaction(customDate, 'expense')}
                className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer touch-feedback"
              >
                <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                <span>Add Expense ({formatDateHeader(customDate)})</span>
              </button>
              <button
                type="button"
                onClick={() => openAddTransaction(customDate, 'income')}
                className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer touch-feedback"
              >
                <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                <span>Add Income</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Financial Summary Cards for Current Selection */}
      {displayedTransactions.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          <div className="glass-card p-3.5 sm:p-4 text-center sm:text-left">
            <p className="text-[10px] sm:text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Total Income
            </p>
            <p className="text-xs sm:text-base md:text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate">
              +{formatCurrency(summaryStats.income)}
            </p>
          </div>

          <div className="glass-card p-3.5 sm:p-4 text-center sm:text-left">
            <p className="text-[10px] sm:text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Total Expense
            </p>
            <p className="text-xs sm:text-base md:text-lg font-bold text-zinc-900 dark:text-white mt-1 truncate">
              -{formatCurrency(summaryStats.expense)}
            </p>
          </div>

          <div className="glass-card p-3.5 sm:p-4 text-center sm:text-left">
            <p className="text-[10px] sm:text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Net Balance
            </p>
            <p className={`text-xs sm:text-base md:text-lg font-bold mt-1 truncate ${
              summaryStats.net > 0 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : summaryStats.net < 0 
                  ? 'text-rose-500' 
                  : 'text-zinc-900 dark:text-white'
            }`}>
              {summaryStats.net > 0 ? '+' : ''}{formatCurrency(summaryStats.net)}
            </p>
          </div>
        </div>
      )}

      {/* ALL TIME VIEW: Interactive Collapsible Date Dropdowns / Accordions */}
      {timeFilter === 'all' ? (
        <div className="space-y-4">
          {/* Header Bar with Date Counts & Expand/Collapse Controls */}
          {filteredTransactions.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <FontAwesomeIcon icon={faLayerGroup} className="text-primary-500" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  {selectedDateGroup === 'all' 
                    ? `${dateGroups.length} Date Group${dateGroups.length === 1 ? '' : 's'} (${filteredTransactions.length} transaction${filteredTransactions.length === 1 ? '' : 's'})` 
                    : `Showing Date: ${formatDateHeader(selectedDateGroup)} (${displayedTransactions.length} transaction${displayedTransactions.length === 1 ? '' : 's'})`}
                </span>
                {selectedDateGroup !== 'all' && (
                  <button 
                    onClick={() => setSelectedDateGroup('all')}
                    className="ml-2 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer bg-primary-50 dark:bg-primary-950/60 px-2 py-0.5 rounded-md"
                  >
                    ← View All Dates
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedDateGroup === 'all' && dateGroups.length > 1 && (
                  <>
                    <button
                      onClick={expandAllDates}
                      className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Expand all date dropdowns"
                    >
                      <FontAwesomeIcon icon={faExpandAlt} className="text-[11px] text-gray-500" />
                      <span>Expand All</span>
                    </button>
                    <button
                      onClick={collapseAllDates}
                      className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Collapse all date dropdowns"
                    >
                      <FontAwesomeIcon icon={faCompressAlt} className="text-[11px] text-gray-500" />
                      <span>Collapse All</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* List of Date Dropdown Accordion Cards */}
          <div className="space-y-3 pb-20">
            {displayedDateGroups.map(g => {
              const isExpanded = isDateExpanded(g.dateKey);
              const netTotal = g.totalIncome - g.totalExpense;

              return (
                <div 
                  key={g.dateKey} 
                  className="glass rounded-2xl overflow-hidden border border-gray-200/80 dark:border-gray-800/80 transition-all duration-200 shadow-sm"
                >
                  {/* Collapsible Date Header & Quick Action Row */}
                  <div 
                    onClick={() => toggleDateExpand(g.dateKey)}
                    className="w-full p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 bg-white/70 dark:bg-gray-900/70 hover:bg-gray-50/90 dark:hover:bg-gray-800/60 transition-colors cursor-pointer select-none"
                  >
                    {/* Left: Icon, Date Title & Tx Count */}
                    <div className="flex items-center justify-between sm:justify-start gap-3 min-w-0 w-full sm:w-auto">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-primary-50 dark:bg-primary-950/60 border border-primary-100 dark:border-primary-900/40 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs sm:text-sm shadow-xs">
                          <FontAwesomeIcon icon={faCalendarDay} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base leading-tight">
                              {formatDateHeader(g.dateKey)}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {g.items.length} {g.items.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Mobile Chevron indicator */}
                      <div className="sm:hidden flex items-center gap-1 text-gray-400 dark:text-gray-500">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} className="text-xs" />
                        </div>
                      </div>
                    </div>

                    {/* Right: Badges, Direct "+ Add" Actions, and Desktop Chevron */}
                    <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 flex-wrap sm:ml-auto w-full sm:w-auto pt-1 sm:pt-0 border-t border-gray-100/60 dark:border-gray-800/40 sm:border-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        {g.totalIncome > 0 && (
                          <span className="text-[11px] sm:text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 px-1.5 sm:px-2 py-0.5 rounded-md border border-green-200/50 dark:border-green-800/40 whitespace-nowrap">
                            +{formatCurrency(g.totalIncome)}
                          </span>
                        )}
                        {g.totalExpense > 0 && (
                          <span className="text-[11px] sm:text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 sm:px-2 py-0.5 rounded-md border border-rose-200/50 dark:border-rose-800/40 whitespace-nowrap">
                            -{formatCurrency(g.totalExpense)}
                          </span>
                        )}
                        <span className={`text-[11px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-md border inline-flex items-center whitespace-nowrap ${
                          netTotal > 0 
                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800/60' 
                            : netTotal < 0 
                              ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800/60'
                              : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        }`}>
                          Net: {netTotal > 0 ? '+' : ''}{formatCurrency(netTotal)}
                        </span>
                      </div>

                      {/* Direct Add Quick Buttons right on this date card header */}
                      <div 
                        className="flex items-center gap-1 sm:gap-1.5"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddTransaction(g.dateKey, 'expense');
                          }}
                          className="px-2 sm:px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40 transition-all touch-feedback cursor-pointer flex items-center gap-1"
                          title={`Add Expense on ${formatDateHeader(g.dateKey)}`}
                        >
                          <FontAwesomeIcon icon={faPlus} className="text-[9px]" />
                          <span>Expense</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddTransaction(g.dateKey, 'income');
                          }}
                          className="px-2 sm:px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 transition-all touch-feedback cursor-pointer flex items-center gap-1"
                          title={`Add Income on ${formatDateHeader(g.dateKey)}`}
                        >
                          <FontAwesomeIcon icon={faPlus} className="text-[9px]" />
                          <span>Income</span>
                        </button>
                      </div>

                      {/* Desktop Chevron & Action Text */}
                      <div className="hidden sm:flex items-center gap-1.5 pl-1 text-gray-400 dark:text-gray-500">
                        <span className="text-xs">{isExpanded ? 'Hide' : 'View'}</span>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} className="text-xs" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content Dropdown Body */}
                  {isExpanded && (
                    <div className="border-t border-zinc-100 dark:border-zinc-800/80 animate-page-enter gpu-accelerated">
                      {/* Desktop Table inside Date Group */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/60 dark:bg-gray-950/40 text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider">
                              <th className="p-3 pl-4">Category</th>
                              <th className="p-3">Note</th>
                              <th className="p-3 text-right">Amount</th>
                              <th className="p-3 pr-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                            {g.items.map(t => {
                              const cat = resolveCategory(t.categoryId, categories, t.note);
                              const categoryColor = cat?.color || '#888888';
                              return (
                                <tr key={t.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors group">
                                  <td className="p-3 pl-4">
                                    <div className="flex items-center gap-2.5">
                                      <div 
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs shrink-0 shadow-xs" 
                                        style={{ backgroundColor: categoryColor }}
                                      >
                                        <FontAwesomeIcon icon={getCategoryIcon(cat?.icon)} />
                                      </div>
                                      <span 
                                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold"
                                        style={{
                                          backgroundColor: `${categoryColor}18`,
                                          color: categoryColor,
                                          border: `1px solid ${categoryColor}35`
                                        }}
                                      >
                                        {cat?.name || 'Uncategorized'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-gray-700 dark:text-gray-300 font-medium text-sm">
                                    {t.note || '-'}
                                  </td>
                                  <td className={`p-3 text-right font-bold whitespace-nowrap text-sm ${t.type === 'income' ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>
                                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                  </td>
                                  <td className="p-3 pr-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={() => handleEdit(t)} 
                                        className="p-1.5 text-gray-400 hover:text-primary-500 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                        title="Edit transaction"
                                      >
                                        <FontAwesomeIcon icon={faEdit} />
                                      </button>
                                      <button 
                                        onClick={() => requestDelete(t.id)} 
                                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                        title="Delete transaction"
                                      >
                                        <FontAwesomeIcon icon={faTrash} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* Quick Add footer for this date on desktop */}
                        <div className="p-3 bg-gray-50/40 dark:bg-gray-950/30 border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-between">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                            Direct add for {formatDateHeader(g.dateKey)}:
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openAddTransaction(g.dateKey, 'expense')}
                              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all cursor-pointer touch-feedback flex items-center gap-1.5 shadow-2xs"
                            >
                              <FontAwesomeIcon icon={faPlus} className="text-[10px] text-rose-400 dark:text-rose-500" />
                              <span>Add Expense</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openAddTransaction(g.dateKey, 'income')}
                              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer touch-feedback flex items-center gap-1.5 shadow-2xs"
                            >
                              <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                              <span>Add Income</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Mobile Stacked Items inside Date Group */}
                      <div className="md:hidden p-3 space-y-2.5 bg-gray-50/40 dark:bg-gray-950/20">
                        {g.items.map(t => {
                          const cat = resolveCategory(t.categoryId, categories, t.note);
                          const hasNote = Boolean(t.note && t.note.trim());
                          const categoryName = cat?.name || 'Uncategorized';
                          const categoryColor = cat?.color || '#888888';

                          return (
                            <SwipeableItem 
                              key={t.id} 
                              onEdit={() => handleEdit(t)} 
                              onDelete={() => requestDelete(t.id)}
                              resetToken={swipeResetToken}
                            >
                              <div className="glass p-3.5 flex items-center gap-3 rounded-xl border border-gray-200/60 dark:border-gray-800/60">
                                {/* Category Icon */}
                                <div 
                                  className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-white shadow-sm" 
                                  style={{ backgroundColor: categoryColor }}
                                >
                                  <FontAwesomeIcon icon={getCategoryIcon(cat?.icon)} className="text-base" />
                                </div>
                                
                                {/* Info */}
                                <div className="flex-1 min-w-0 py-0.5">
                                  <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug break-words">
                                    {hasNote ? t.note : categoryName}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs">
                                    <span 
                                      className="inline-flex items-center px-2 py-0.5 rounded-md font-medium text-xs break-words"
                                      style={{ 
                                        backgroundColor: `${categoryColor}18`,
                                        color: categoryColor,
                                        border: `1px solid ${categoryColor}35`
                                      }}
                                    >
                                      {categoryName}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Amount */}
                                <div className="text-right shrink-0 ml-1 self-center">
                                  <p className={`font-bold text-sm whitespace-nowrap ${t.type === 'income' ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>
                                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                  </p>
                                </div>
                              </div>
                            </SwipeableItem>
                          );
                        })}

                        {/* Quick Add buttons at bottom of mobile date section */}
                        <div className="pt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => openAddTransaction(g.dateKey, 'expense')}
                            className="flex-1 py-2 text-xs font-semibold rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40 transition-all touch-feedback flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                            <span>+ Expense</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openAddTransaction(g.dateKey, 'income')}
                            className="flex-1 py-2 text-xs font-semibold rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 transition-all touch-feedback flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                            <span>+ Income</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {displayedDateGroups.length === 0 && (
              <div className="glass rounded-2xl p-10 text-center text-gray-500 space-y-3">
                <FontAwesomeIcon icon={faSearch} className="text-3xl text-gray-400" />
                <p className="font-medium text-base">No transactions found.</p>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or search query, or add a transaction directly.</p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => openAddTransaction()}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer touch-feedback shadow-xs"
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-xs" />
                    <span>Add New Transaction</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* STANDARD VIEW: When a specific period (Today, Yesterday, Week, Month, Year, Custom) is active */
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-sm">
                    <th className="p-4 font-medium">Date</th>
                    <th className="p-4 font-medium">Category</th>
                    <th className="p-4 font-medium">Note</th>
                    <th className="p-4 font-medium text-right">Amount</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {filteredTransactions.map(t => {
                    const cat = resolveCategory(t.categoryId, categories, t.note);
                    const categoryColor = cat?.color || '#888888';
                    return (
                      <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                        <td className="p-4 text-gray-900 dark:text-gray-300 whitespace-nowrap">
                          {new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2.5">
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs shrink-0 shadow-sm" 
                              style={{ backgroundColor: categoryColor }}
                            >
                              <FontAwesomeIcon icon={getCategoryIcon(cat?.icon)} />
                            </div>
                            <span 
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold"
                              style={{
                                backgroundColor: `${categoryColor}18`,
                                color: categoryColor,
                                border: `1px solid ${categoryColor}35`
                              }}
                            >
                              {cat?.name || 'Uncategorized'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-gray-700 dark:text-gray-300 font-medium">{t.note || '-'}</td>
                        <td className={`p-4 text-right font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(t)} className="p-2 text-gray-400 hover:text-primary-500 transition-colors cursor-pointer" title="Edit">
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                            <button onClick={() => requestDelete(t.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors cursor-pointer" title="Delete">
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-gray-500">
                        <p className="font-medium">No transactions found for this period.</p>
                        <button
                          type="button"
                          onClick={() => openAddTransaction()}
                          className="mt-3 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer touch-feedback"
                        >
                          <FontAwesomeIcon icon={faPlus} className="text-xs" />
                          <span>Add Transaction Here</span>
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Direct Add footer on standard table */}
            {filteredTransactions.length > 0 && (
              <div className="p-3.5 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-200/80 dark:border-gray-800/80 flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Quick add to this view:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openAddTransaction(null, 'expense')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all cursor-pointer touch-feedback flex items-center gap-1.5 shadow-2xs"
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-[10px] text-rose-400 dark:text-rose-500" />
                    <span>Add Expense</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddTransaction(null, 'income')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer touch-feedback flex items-center gap-1.5 shadow-2xs"
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                    <span>Add Income</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Stacked List View */}
          <div className="md:hidden pb-24 space-y-3">
            {filteredTransactions.map(t => {
              const cat = resolveCategory(t.categoryId, categories, t.note);
              const hasNote = Boolean(t.note && t.note.trim());
              const categoryName = cat?.name || 'Uncategorized';
              const categoryColor = cat?.color || '#888888';

              return (
                <SwipeableItem 
                  key={t.id} 
                  onEdit={() => handleEdit(t)} 
                  onDelete={() => requestDelete(t.id)}
                  resetToken={swipeResetToken}
                >
                  <div className="glass p-4 flex items-center gap-3.5">
                    {/* Category Icon Circle */}
                    <div 
                      className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-white shadow-md" 
                      style={{ backgroundColor: categoryColor }}
                    >
                      <FontAwesomeIcon icon={getCategoryIcon(cat?.icon)} className="text-lg" />
                    </div>
                    
                    {/* Info Block */}
                    <div className="flex-1 min-w-0 py-0.5">
                      <p className="font-semibold text-gray-900 dark:text-white text-base leading-snug break-words">
                        {hasNote ? t.note : categoryName}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs">
                        <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap font-normal">
                          {new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        
                        <span className="text-gray-300 dark:text-gray-600 select-none">&bull;</span>
                        <span 
                          className="inline-flex items-center px-2 py-0.5 rounded-md font-medium text-xs break-words"
                          style={{ 
                            backgroundColor: `${categoryColor}18`,
                            color: categoryColor,
                            border: `1px solid ${categoryColor}35`
                          }}
                        >
                          {categoryName}
                        </span>
                      </div>
                    </div>
                    
                    {/* Amount */}
                    <div className="text-right shrink-0 ml-1 self-center">
                      <p className={`font-bold text-base whitespace-nowrap ${t.type === 'income' ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </p>
                    </div>
                  </div>
                </SwipeableItem>
              );
            })}
            
            {filteredTransactions.length > 0 && (
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => openAddTransaction(null, 'expense')}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40 transition-all touch-feedback flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                  <span>Add Expense</span>
                </button>
                <button
                  type="button"
                  onClick={() => openAddTransaction(null, 'income')}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 transition-all touch-feedback flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                  <span>Add Income</span>
                </button>
              </div>
            )}

            {filteredTransactions.length === 0 && (
              <div className="text-center p-8 text-gray-500 glass rounded-2xl space-y-3">
                <p>No transactions found for this period.</p>
                <button
                  type="button"
                  onClick={() => openAddTransaction()}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer touch-feedback"
                >
                  <FontAwesomeIcon icon={faPlus} className="text-xs" />
                  <span>Add Transaction</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Mobile Sticky FAB */}
      <button 
        onClick={() => openAddTransaction()}
        className="md:hidden fixed bottom-20 right-6 w-14 h-14 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 rounded-full flex items-center justify-center text-xl shadow-lg shadow-black/20 z-40 transition-transform active:scale-95 cursor-pointer"
        aria-label="Add Transaction"
      >
        <FontAwesomeIcon icon={faPlus} />
      </button>

      {/* Transaction Modal */}
      <TransactionForm 
        isOpen={isFormOpen} 
        onClose={handleCloseForm} 
        initialData={editingTx}
        defaultDate={formDefaultDate}
        defaultType={formDefaultType}
      />

      {/* Fancy Confirmation Modals */}
      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => {
          setDeleteConfirm({ isOpen: false, id: null });
          setSwipeResetToken(prev => prev + 1);
        }}
        onConfirm={confirmDelete}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
        confirmText="Delete"
        isDanger={true}
      />

      <ConfirmModal 
        isOpen={pdfConfirmOpen}
        onClose={() => setPdfConfirmOpen(false)}
        onConfirm={exportToPDF}
        title="Export to PDF"
        message={`Are you sure you want to generate and download a PDF report containing ${displayedTransactions.length} transaction(s)?`}
        confirmText="Export"
        isDanger={false}
      />
    </div>
  );
};

export default Transactions;
