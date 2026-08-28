import React, { useState, useMemo } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { useAuth } from '../context/AuthContext';
import BorrowFormModal from '../components/borrow/BorrowFormModal';
import BorrowMoreModal from '../components/borrow/BorrowMoreModal';
import BorrowRepaymentModal from '../components/borrow/BorrowRepaymentModal';
import BorrowReminderModal from '../components/borrow/BorrowReminderModal';
import ConfirmModal from '../components/ui/ConfirmModal';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHandHolding, 
  faPlus, 
  faSearch, 
  faCheckCircle, 
  faClock, 
  faExclamationTriangle, 
  faPaperPlane, 
  faTrash, 
  faEdit, 
  faFilePdf, 
  faChevronDown, 
  faChevronUp, 
  faHistory,
  faMoneyBillWave,
  faUserFriends,
  faCalendarAlt,
  faPhone,
  faCoins,
  faArrowRotateLeft,
  faComments,
  faShieldAlt
} from '@fortawesome/free-solid-svg-icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';
import { useUI } from '../context/UIContext';

const BorrowedMoney = () => {
  const { borrowedRecords = [], deleteBorrowedRecord, settleBorrowedRecord, loading } = useTransactions();
  const { isPrivacyMode } = useUI();
  const { currentUser, openAuthModal } = useAuth();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, pending, partial, overdue, settled
  const [sortBy, setSortBy] = useState('date-desc'); // date-desc, date-asc, amount-desc, pending-desc, due-asc

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [borrowMoreTarget, setBorrowMoreTarget] = useState(null);
  
  const [repayTarget, setRepayTarget] = useState(null);
  const [reminderTarget, setReminderTarget] = useState(null);
  
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });
  const [settleConfirm, setSettleConfirm] = useState({ isOpen: false, id: null, name: '', amount: 0 });
  const [pdfConfirmOpen, setPdfConfirmOpen] = useState(false);

  const [expandedHistories, setExpandedHistories] = useState({});
  const [cardActivityTabs, setCardActivityTabs] = useState({}); // recordId -> 'all' | 'borrows' | 'repayments'
  const [isSettledSectionOpen, setIsSettledSectionOpen] = useState(false);

  const toggleHistory = (id) => {
    setExpandedHistories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const setCardTab = (id, tab) => {
    setCardActivityTabs(prev => ({ ...prev, [id]: tab }));
  };

  // Helper to determine real-time status including overdue
  const getRecordStatus = (record) => {
    const total = parseFloat(record.amount) || 0;
    const returned = parseFloat(record.returnedAmount) || 0;
    const remaining = total - returned;

    if (remaining <= 0) return 'settled';

    if (record.dueDate) {
      const due = new Date(record.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (due < today) return 'overdue';
    }

    if (returned > 0) return 'partial';
    return 'pending';
  };

  // Helper to extract synthesized borrow logs if not present
  const getRecordBorrows = (record) => {
    if (record.borrows && Array.isArray(record.borrows) && record.borrows.length > 0) {
      return record.borrows;
    }
    return [
      {
        id: 'borrow_init_' + record.id,
        amount: parseFloat(record.amount) || 0,
        date: record.dateBorrowed || (record.createdAt ? record.createdAt.split('T')[0] : 'N/A'),
        note: record.note || 'Initial borrowed money'
      }
    ];
  };

  // Aggregated KPIs
  const stats = useMemo(() => {
    let totalBorrowed = 0;
    let totalReturned = 0;
    let activeDebtsCount = 0;
    let settledDebtsCount = 0;
    let overdueCount = 0;
    let totalBorrowLogs = 0;

    borrowedRecords.forEach(r => {
      const total = parseFloat(r.amount) || 0;
      const returned = parseFloat(r.returnedAmount) || 0;

      totalBorrowed += total;
      totalReturned += returned;

      const borrowsList = getRecordBorrows(r);
      totalBorrowLogs += borrowsList.length;

      const status = getRecordStatus(r);
      if (status === 'settled') {
        settledDebtsCount++;
      } else {
        activeDebtsCount++;
        if (status === 'overdue') overdueCount++;
      }
    });

    const totalPendingDebt = Math.max(0, totalBorrowed - totalReturned);
    const repaidRate = totalBorrowed > 0 ? (totalReturned / totalBorrowed) * 100 : 0;

    return {
      totalBorrowed,
      totalReturned,
      totalPendingDebt,
      activeDebtsCount,
      settledDebtsCount,
      overdueCount,
      totalBorrowLogs,
      repaidRate
    };
  }, [borrowedRecords]);

  // Filtered and Sorted Records
  const filteredRecords = useMemo(() => {
    const q = search.toLowerCase().trim();
    return borrowedRecords
      .filter(r => {
        const matchesSearch = !q ||
          r.lenderName?.toLowerCase().includes(q) ||
          r.note?.toLowerCase().includes(q) ||
          r.phone?.includes(q) ||
          (r.borrows && r.borrows.some(b => b.note?.toLowerCase().includes(q)));

        const currentStatus = getRecordStatus(r);
        const matchesStatus = 
          statusFilter === 'all' || 
          (statusFilter === 'active' && currentStatus !== 'settled') ||
          currentStatus === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const totalA = parseFloat(a.amount) || 0;
        const totalB = parseFloat(b.amount) || 0;
        const pendingA = Math.max(0, totalA - (parseFloat(a.returnedAmount) || 0));
        const pendingB = Math.max(0, totalB - (parseFloat(b.returnedAmount) || 0));

        if (sortBy === 'date-desc') {
          const dateA = a.dateBorrowed || a.createdAt || '';
          const dateB = b.dateBorrowed || b.createdAt || '';
          return dateB > dateA ? 1 : dateB < dateA ? -1 : 0;
        }
        if (sortBy === 'date-asc') {
          const dateA = a.dateBorrowed || a.createdAt || '';
          const dateB = b.dateBorrowed || b.createdAt || '';
          return dateA > dateB ? 1 : dateA < dateB ? -1 : 0;
        }
        if (sortBy === 'amount-desc') {
          return totalB - totalA;
        }
        if (sortBy === 'pending-desc') {
          return pendingB - pendingA;
        }
        if (sortBy === 'due-asc') {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate > b.dueDate ? 1 : a.dueDate < b.dueDate ? -1 : 0;
        }
        return 0;
      });
  }, [borrowedRecords, search, statusFilter, sortBy]);

  const activeRecords = useMemo(() => {
    return filteredRecords.filter(r => getRecordStatus(r) !== 'settled');
  }, [filteredRecords]);

  const settledRecords = useMemo(() => {
    return filteredRecords.filter(r => getRecordStatus(r) === 'settled');
  }, [filteredRecords]);

  const handleEdit = (record) => {
    setEditingRecord(record);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingRecord(null);
  };

  const handleDelete = (id, name) => {
    setDeleteConfirm({ isOpen: true, id, name });
  };

  const confirmDelete = async () => {
    if (deleteConfirm.id) {
      try {
        await deleteBorrowedRecord(deleteConfirm.id);
        toast.success('Borrowed record deleted');
      } catch (e) {
        toast.error('Failed to delete record');
      }
    }
  };

  const handleSettlePrompt = (record) => {
    const total = parseFloat(record.amount) || 0;
    const returned = parseFloat(record.returnedAmount) || 0;
    const remaining = Math.max(0, total - returned);
    setSettleConfirm({ isOpen: true, id: record.id, name: record.lenderName, amount: remaining });
  };

  const confirmSettle = async () => {
    if (settleConfirm.id) {
      try {
        await settleBorrowedRecord(settleConfirm.id);
        toast.success(`Marked debt to ${settleConfirm.name} as fully paid back!`);
      } catch (e) {
        toast.error('Failed to settle debt');
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
    return 'Rs. ' + (parseFloat(amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Nice Header
    doc.setFontSize(22);
    doc.setTextColor(31, 41, 55); // gray-800
    doc.text("Borrowed Money Report (Debts Owed to Friends)", 14, 22);
    
    // Subtext
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`, 14, 32);
    doc.text(`Filters: Status: ${statusFilter.toUpperCase()} | Sort: ${sortBy} | Search: "${search || 'None'}"`, 14, 38);

    // Separator line
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.setLineWidth(0.5);
    doc.line(14, 42, 196, 42);

    const tableColumn = ["Lender", "Date Borrowed", "Total Borrowed", "Repaid", "Debt Owed", "Promise Due Date", "Status"];
    const tableRows = [];

    let totalBorrowedSum = 0;
    let totalReturnedSum = 0;
    let totalPendingDebtSum = 0;

    filteredRecords.forEach(r => {
      const total = parseFloat(r.amount) || 0;
      const returned = parseFloat(r.returnedAmount) || 0;
      const remaining = Math.max(0, total - returned);
      const status = getRecordStatus(r).toUpperCase();

      totalBorrowedSum += total;
      totalReturnedSum += returned;
      totalPendingDebtSum += remaining;

      tableRows.push([
        r.lenderName,
        r.dateBorrowed ? new Date(r.dateBorrowed).toLocaleDateString('en-IN') : 'N/A',
        formatCurrencyPDF(total),
        formatCurrencyPDF(returned),
        formatCurrencyPDF(remaining),
        r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-IN') : 'N/A',
        status
      ]);
    });

    tableRows.push(['TOTALS', '', formatCurrencyPDF(totalBorrowedSum), formatCurrencyPDF(totalReturnedSum), formatCurrencyPDF(totalPendingDebtSum), '', '']);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 48,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, textColor: [55, 65, 81] },
      headStyles: { fillColor: [147, 51, 234], textColor: 255, fontStyle: 'bold' }, // purple-600
      alternateRowStyles: { fillColor: [250, 245, 255] }, // purple-50/bg
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: function(data) {
        if (data.row.index === filteredRecords.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [243, 244, 246];
          data.cell.styles.textColor = [17, 24, 39];
          if (data.column.index === 4) {
            data.cell.styles.textColor = [225, 29, 72]; // rose-600
          }
        }
      }
    });

    doc.save(`borrowed_money_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportPDF = () => {
    if (filteredRecords.length === 0) {
      toast.error('No borrowed records to export');
      return;
    }
    setPdfConfirmOpen(true);
  };

  const getAvatarColor = (name) => {
    const colors = [
      'bg-purple-600 text-white',
      'bg-indigo-600 text-white',
      'bg-violet-600 text-white',
      'bg-pink-600 text-white',
      'bg-cyan-600 text-white',
      'bg-fuchsia-600 text-white',
      'bg-blue-600 text-white'
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const renderRecordCard = (record) => {
    const total = parseFloat(record.amount) || 0;
    const returned = parseFloat(record.returnedAmount) || 0;
    const remaining = Math.max(0, total - returned);
    const percentRepaid = total > 0 ? Math.min((returned / total) * 100, 100) : 0;
    const status = getRecordStatus(record);
    const borrows = getRecordBorrows(record);
    const repayments = record.repayments || [];
    const isExpanded = !!expandedHistories[record.id];
    const currentTab = cardActivityTabs[record.id] || 'all';

    // Combined chronological ledger events
    const combinedTimeline = [
      ...borrows.map((b, idx) => ({
        ...b,
        eventType: 'borrow',
        eventTitle: idx === 0 ? 'Initial Borrow' : `Top-up #${idx + 1}`,
        sortDate: new Date(b.date || record.dateBorrowed || 0)
      })),
      ...repayments.map((rep, idx) => ({
        ...rep,
        eventType: 'repayment',
        eventTitle: `Repayment #${idx + 1}`,
        sortDate: new Date(rep.date || 0)
      }))
    ].sort((a, b) => b.sortDate - a.sortDate);

    return (
      <div 
        key={record.id}
        className={`glass rounded-2xl p-4 sm:p-5 transition-all border ${
          status === 'overdue' 
            ? 'border-rose-300 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10'
            : status === 'settled'
            ? 'border-zinc-200 dark:border-zinc-800/80 opacity-90'
            : 'border-zinc-200 dark:border-zinc-800'
        }`}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Lender Avatar */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-2xs shrink-0 ${getAvatarColor(record.lenderName)}`}>
              {(record.lenderName || 'L').charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate">
                  {record.lenderName}
                </h3>

                {/* Status Badge */}
                {status === 'settled' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <FontAwesomeIcon icon={faCheckCircle} className="text-[9px]" /> Settled
                  </span>
                )}
                {status === 'overdue' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-400 flex items-center gap-1 animate-pulse">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-[9px]" /> Overdue
                  </span>
                )}
                {status === 'partial' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-400">
                    {percentRepaid.toFixed(0)}% Repaid
                  </span>
                )}
                {status === 'pending' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    Pending
                  </span>
                )}
              </div>

              {/* Metadata Subtitle */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[11px] text-zinc-400">
                {borrows.length > 1 && (
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium liquid-glass-subtle text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                    <FontAwesomeIcon icon={faCoins} className="text-[9px]" />
                    <span>{borrows.length} Borrows</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <FontAwesomeIcon icon={faCalendarAlt} className="text-[9px]" />
                  {new Date(record.dateBorrowed || (borrows[0] && borrows[0].date) || 0).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
                {record.dueDate && (
                  <>
                    <span>&bull;</span>
                    <span className={status === 'overdue' ? 'text-rose-500 font-semibold' : ''}>
                      Due: {new Date(record.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  </>
                )}
                {record.phone && (
                  <>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1 truncate">
                      <FontAwesomeIcon icon={faPhone} className="text-[9px]" />
                      {record.phone}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Amounts Breakdown */}
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
              {remaining > 0 ? 'Pending' : 'Status'}
            </p>
            <p className={`text-sm sm:text-lg font-bold leading-tight ${
              remaining > 0 
                ? (status === 'overdue' ? 'text-rose-500' : 'text-cyan-600 dark:text-cyan-400')
                : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {remaining > 0 ? formatCurrency(remaining) : 'Paid in Full'}
            </p>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              of {formatCurrency(total)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
              Repaid: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(returned)}</strong>
            </span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px]">
              {percentRepaid.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 sm:h-2 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                percentRepaid >= 100 
                  ? 'bg-emerald-500' 
                  : status === 'overdue'
                  ? 'bg-gradient-to-r from-rose-500 to-cyan-500'
                  : 'bg-gradient-to-r from-cyan-500 to-emerald-500'
              }`}
              style={{ width: `${percentRepaid}%` }}
            />
          </div>
        </div>

        {/* Note if present */}
        {record.note && (
          <div className="mt-2.5 text-xs liquid-glass-subtle p-2 sm:p-2.5 rounded-xl text-zinc-600 dark:text-zinc-300 flex items-start gap-2">
            <span className="font-semibold text-zinc-400 shrink-0 text-[11px]">Note:</span>
            <span className="italic text-[11px] truncate">{record.note}</span>
          </div>
        )}

        {/* Comprehensive Activity & Debt Logs Accordion */}
        <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
          <button
            onClick={() => toggleHistory(record.id)}
            className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center justify-between w-full py-1 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faHistory} className="text-cyan-500 text-xs" />
              <span className="text-[11px] sm:text-xs">
                Activity Logs ({borrows.length} borrow{borrows.length === 1 ? '' : 's'}, {repayments.length} repayment{repayments.length === 1 ? '' : 's'})
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="text-[10px] sm:text-[11px]">{isExpanded ? 'Hide' : 'View Logs'}</span>
              <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} className="text-[9px]" />
            </div>
          </button>

          {isExpanded && (
            <div className="mt-2.5 pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800 animate-page-enter gpu-accelerated space-y-3">
              {/* Filter tabs inside history */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1 liquid-glass-subtle p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setCardTab(record.id, 'all')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer text-[11px] ${
                      currentTab === 'all'
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs font-semibold'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    All ({combinedTimeline.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardTab(record.id, 'borrows')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer text-[11px] ${
                      currentTab === 'borrows'
                        ? 'bg-cyan-600 text-white shadow-xs font-semibold'
                        : 'text-zinc-500 hover:text-cyan-600 dark:hover:text-cyan-400'
                    }`}
                  >
                    Borrows ({borrows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardTab(record.id, 'repayments')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer text-[11px] ${
                      currentTab === 'repayments'
                        ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                        : 'text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400'
                    }`}
                  >
                    Repayments ({repayments.length})
                  </button>
                </div>

                {/* Quick Borrow More trigger from inside logs */}
                <button
                  type="button"
                  onClick={() => setBorrowMoreTarget(record)}
                  className="text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <FontAwesomeIcon icon={faPlus} className="text-[9px]" />
                  <span>Borrow More</span>
                </button>
              </div>

              {/* Timeline List */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {/* All logs or filtered */}
                {currentTab === 'all' && (
                  combinedTimeline.map((item, idx) => (
                    <div 
                      key={item.id || idx} 
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                        item.eventType === 'borrow'
                          ? 'bg-cyan-500/5 dark:bg-cyan-950/20 border-cyan-200/60 dark:border-cyan-900/40'
                          : 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          item.eventType === 'borrow'
                            ? 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400'
                            : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          <FontAwesomeIcon icon={item.eventType === 'borrow' ? faHandHolding : faCheckCircle} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-zinc-900 dark:text-white truncate">
                              {item.eventTitle}
                            </span>
                            <span className="text-[10px] text-zinc-400 shrink-0">
                              &bull; {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                          {item.note && (
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic truncate mt-0.5">
                              "{item.note}"
                            </p>
                          )}
                        </div>
                      </div>

                      <span className={`font-bold text-xs sm:text-sm shrink-0 ml-2 ${
                        item.eventType === 'borrow'
                          ? 'text-cyan-600 dark:text-cyan-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {item.eventType === 'borrow' ? '+' : '-'} {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))
                )}

                {/* Only borrows */}
                {currentTab === 'borrows' && (
                  borrows.map((b, idx) => (
                    <div 
                      key={b.id || idx} 
                      className="flex items-center justify-between p-2.5 rounded-xl border bg-cyan-500/5 dark:bg-cyan-950/20 border-cyan-200/60 dark:border-cyan-900/40 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">
                          <FontAwesomeIcon icon={faHandHolding} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-zinc-900 dark:text-white truncate">
                              {idx === 0 ? 'Initial Borrow' : `Top-up #${idx + 1}`}
                            </span>
                            <span className="text-[10px] text-zinc-400 shrink-0">
                              &bull; {new Date(b.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                          {b.note && (
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic truncate mt-0.5">
                              "{b.note}"
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="font-bold text-xs sm:text-sm text-cyan-600 dark:text-cyan-400 shrink-0 ml-2">
                        Borrowed: {formatCurrency(b.amount)}
                      </span>
                    </div>
                  ))
                )}

                {/* Only repayments */}
                {currentTab === 'repayments' && (
                  repayments.length > 0 ? (
                    repayments.map((rep, idx) => (
                      <div 
                        key={rep.id || idx} 
                        className="flex items-center justify-between p-2.5 rounded-xl border bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                            <FontAwesomeIcon icon={faCheckCircle} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-zinc-900 dark:text-white truncate">
                                Repayment #{idx + 1}
                              </span>
                              <span className="text-[10px] text-zinc-400 shrink-0">
                                &bull; {new Date(rep.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </span>
                            </div>
                            {rep.note && (
                              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic truncate mt-0.5">
                                "{rep.note}"
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                          - {formatCurrency(rep.amount)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-zinc-400">
                      No debt repayments logged yet to this lender.
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-3.5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap flex-1 min-w-0">
            {/* Borrow More Button */}
            <button
              type="button"
              onClick={() => setBorrowMoreTarget(record)}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer touch-feedback"
              title="Borrow more money from this same lender"
            >
              <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
              <span>Borrow More</span>
            </button>

            {/* Repay Button */}
            {remaining > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setRepayTarget(record)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer touch-feedback"
                >
                  <FontAwesomeIcon icon={faCheckCircle} className="text-[10px]" />
                  <span>Record Repayment</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSettlePrompt(record)}
                  className="px-2.5 py-1.5 liquid-glass-subtle text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer touch-feedback"
                >
                  <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-500 text-[10px]" />
                  <span className="hidden xs:inline">Settle</span>
                </button>
              </>
            )}

            {remaining <= 0 && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <FontAwesomeIcon icon={faCheckCircle} />
                <span>Settled in Full</span>
              </span>
            )}
          </div>

          {/* Edit & Delete Action Cluster */}
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => handleEdit(record)}
              className="w-8 h-8 rounded-xl liquid-glass-subtle text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-colors touch-feedback cursor-pointer"
              title="Edit record"
            >
              <FontAwesomeIcon icon={faEdit} className="text-xs" />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(record.id, record.lenderName)}
              className="w-8 h-8 rounded-xl liquid-glass-subtle text-zinc-400 hover:text-rose-500 flex items-center justify-center transition-colors touch-feedback cursor-pointer"
              title="Delete record"
            >
              <FontAwesomeIcon icon={faTrash} className="text-xs" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-sm shadow-2xs">
              <FontAwesomeIcon icon={faHandHolding} />
            </span>
            Borrowed from Friends
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Track debts owed to friends, log top-ups & record repayments
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto w-full sm:w-auto">
          {borrowedRecords.length > 0 && (
            <button
              onClick={handleExportPDF}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer shadow-2xs touch-feedback"
              title="Export to PDF"
            >
              <FontAwesomeIcon icon={faFilePdf} className="text-rose-500 text-xs" />
              <span>Export PDF</span>
            </button>
          )}

          <button
            onClick={() => {
              setEditingRecord(null);
              setIsFormOpen(true);
            }}
            className="flex-1 sm:flex-none px-4.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs cursor-pointer touch-feedback"
          >
            <FontAwesomeIcon icon={faPlus} className="text-xs" />
            <span>Borrow Money</span>
          </button>
        </div>
      </div>

      {/* Guest Mode Cloud Security Banner */}
      {!currentUser && (
        <div className="p-4 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 dark:bg-zinc-900/10 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faShieldAlt} />
            </div>
            <div>
              <p className="text-xs font-bold">Cloud Synced Debts Ledger</p>
              <p className="text-[11px] opacity-80">Sign in with your Google account to view and manage debts owed and repayments safely in the cloud.</p>
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Debt Owed */}
        <div className="glass-card p-5 transition-all glass-hover">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Pending Debt Owed
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-rose-500">
                <AnimatedCounter value={stats.totalPendingDebt} isCurrency={true} />
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faClock} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            {stats.activeDebtsCount} active debt{stats.activeDebtsCount === 1 ? '' : 's'}
            {stats.overdueCount > 0 && (
              <span className="text-rose-500 font-semibold ml-1.5">({stats.overdueCount} overdue)</span>
            )}
          </p>
        </div>

        {/* Total Repaid by Me */}
        <div className="glass-card p-5 transition-all glass-hover">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Total Repaid by Me
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-emerald-600 dark:text-emerald-400">
                <AnimatedCounter value={stats.totalReturned} isCurrency={true} />
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-700" 
                style={{ width: `${Math.min(stats.repaidRate, 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {stats.repaidRate.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Total Money Borrowed */}
        <div className="glass-card p-5 transition-all glass-hover">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Total Money Borrowed
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-zinc-900 dark:text-white">
                <AnimatedCounter value={stats.totalBorrowed} isCurrency={true} />
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faMoneyBillWave} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            {stats.totalBorrowLogs} borrow log{stats.totalBorrowLogs === 1 ? '' : 's'} across {borrowedRecords.length} friend{borrowedRecords.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Settled Debts */}
        <div className="glass-card p-5 transition-all glass-hover">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Settled Debts
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-zinc-900 dark:text-white">
                <AnimatedCounter value={stats.settledDebtsCount} isCurrency={false} />
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faUserFriends} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            {stats.settledDebtsCount} debt{stats.settledDebtsCount === 1 ? '' : 's'} fully cleared
          </p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="glass-card p-4 flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
            <FontAwesomeIcon icon={faSearch} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by lender, note, or phone..."
            className="w-full pl-9 pr-3.5 py-2 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-xs dark:text-white"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active Debts' },
            { id: 'pending', label: 'Pending' },
            { id: 'partial', label: 'Partial' },
            { id: 'overdue', label: 'Overdue' },
            { id: 'settled', label: 'Settled' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs transition-all whitespace-nowrap cursor-pointer touch-feedback ${
                statusFilter === tab.id
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-semibold shadow-2xs'
                  : 'liquid-glass-subtle text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <div className="shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full md:w-auto px-3 py-2 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-xs font-medium dark:text-white cursor-pointer"
          >
            <option value="date-desc">Newest Date</option>
            <option value="date-asc">Oldest Date</option>
            <option value="pending-desc">Highest Pending</option>
            <option value="amount-desc">Highest Total</option>
            <option value="due-asc">Upcoming Due Date</option>
          </select>
        </div>
      </div>

      {/* Borrowed Records List with Separate Settled Sub-Section */}
      <div className="space-y-6">
        {/* Active Debts Section */}
        {statusFilter !== 'settled' && (
          <div className="space-y-4">
            {statusFilter === 'all' && settledRecords.length > 0 && (
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <span>Active Debts & Owed Money</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                    {activeRecords.length}
                  </span>
                </h2>
              </div>
            )}

            {activeRecords.map(record => renderRecordCard(record))}

            {activeRecords.length === 0 && statusFilter === 'all' && settledRecords.length > 0 && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  🎉 All borrowed money & debts have been fully cleared!
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Check the Settled Debts Archive below to view closed history.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Settled Records Archive Sub-Section */}
        {(statusFilter === 'all' || statusFilter === 'settled') && settledRecords.length > 0 && (
          <div className="space-y-3 pt-2">
            <div 
              onClick={() => setIsSettledSectionOpen(prev => !prev)}
              className="p-3.5 sm:p-4 rounded-2xl glass flex items-center justify-between cursor-pointer select-none border border-emerald-500/20 hover:bg-emerald-500/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
                  <FontAwesomeIcon icon={faCheckCircle} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <span>Settled Debts Archive</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      {settledRecords.length} settled
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Fully cleared borrowings & repaid debts
                  </p>
                </div>
              </div>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <FontAwesomeIcon icon={(isSettledSectionOpen || statusFilter === 'settled') ? faChevronUp : faChevronDown} className="text-xs" />
              </div>
            </div>

            {(isSettledSectionOpen || statusFilter === 'settled') && (
              <div className="space-y-4 pt-1">
                {settledRecords.map(record => renderRecordCard(record))}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {filteredRecords.length === 0 && !loading && (
          <div className="glass rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-2xl mx-auto">
              <FontAwesomeIcon icon={faHandHolding} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {search || statusFilter !== 'all' ? 'No matching borrowed records' : 'No money borrowed from friends yet'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                {search || statusFilter !== 'all'
                  ? 'Try adjusting your search or clearing the status filter'
                  : 'Whenever you borrow money from friends or family, record it here to stay accountable and track your repayments.'}
              </p>
            </div>
            {(!search && statusFilter === 'all') && (
              <button
                type="button"
                onClick={() => {
                  setEditingRecord(null);
                  setIsFormOpen(true);
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 transition-all inline-flex items-center gap-2 text-sm cursor-pointer"
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Record Borrowed Money</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <BorrowFormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        initialData={editingRecord}
      />

      <BorrowMoreModal
        isOpen={!!borrowMoreTarget}
        onClose={() => setBorrowMoreTarget(null)}
        record={borrowMoreTarget}
      />

      <BorrowRepaymentModal
        isOpen={!!repayTarget}
        onClose={() => setRepayTarget(null)}
        record={repayTarget}
      />

      <BorrowReminderModal
        isOpen={!!reminderTarget}
        onClose={() => setReminderTarget(null)}
        record={reminderTarget}
      />

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: '' })}
        onConfirm={confirmDelete}
        title="Delete Borrowed Record"
        message={`Are you sure you want to delete the record of money borrowed from "${deleteConfirm.name}"? This action cannot be undone.`}
        confirmText="Delete"
        isDestructive={true}
      />

      <ConfirmModal
        isOpen={settleConfirm.isOpen}
        onClose={() => setSettleConfirm({ isOpen: false, id: null, name: '', amount: 0 })}
        onConfirm={confirmSettle}
        title="Mark Debt as Fully Paid Back"
        message={`Confirm that you have fully returned the remaining debt of ₹${settleConfirm.amount.toLocaleString('en-IN')} to ${settleConfirm.name}?`}
        confirmText="Yes, Mark Settled"
        isDestructive={false}
      />

      <ConfirmModal 
        isOpen={pdfConfirmOpen}
        onClose={() => setPdfConfirmOpen(false)}
        onConfirm={exportToPDF}
        title="Export to PDF"
        message={`Are you sure you want to generate and download a PDF report containing ${filteredRecords.length} borrowed record(s)?`}
        confirmText="Export PDF"
        isDestructive={false}
      />
    </div>
  );
};

export default BorrowedMoney;
