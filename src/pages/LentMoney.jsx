import React, { useState, useMemo } from 'react';
import { useTransactions } from '../context/TransactionContext';
import LentFormModal from '../components/lent/LentFormModal';
import LendMoreModal from '../components/lent/LendMoreModal';
import RepaymentModal from '../components/lent/RepaymentModal';
import ReminderModal from '../components/lent/ReminderModal';
import ConfirmModal from '../components/ui/ConfirmModal';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHandHoldingDollar, 
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
  faReceipt,
  faArrowTrendUp
} from '@fortawesome/free-solid-svg-icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';
import { useUI } from '../context/UIContext';

const LentMoney = () => {
  const { lentRecords = [], deleteLentRecord, settleLentRecord, loading } = useTransactions();
  const { isPrivacyMode } = useUI();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, pending, partial, overdue, settled
  const [sortBy, setSortBy] = useState('date-desc'); // date-desc, date-asc, amount-desc, pending-desc, due-asc

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [lendMoreTarget, setLendMoreTarget] = useState(null);
  
  const [repayTarget, setRepayTarget] = useState(null);
  const [reminderTarget, setReminderTarget] = useState(null);
  
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });
  const [settleConfirm, setSettleConfirm] = useState({ isOpen: false, id: null, name: '', amount: 0 });
  const [pdfConfirmOpen, setPdfConfirmOpen] = useState(false);

  const [expandedHistories, setExpandedHistories] = useState({});
  const [cardActivityTabs, setCardActivityTabs] = useState({}); // recordId -> 'all' | 'loans' | 'repayments'

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

  // Helper to extract synthesized loan logs if not present
  const getRecordLoans = (record) => {
    if (record.loans && Array.isArray(record.loans) && record.loans.length > 0) {
      return record.loans;
    }
    return [
      {
        id: 'loan_init_' + record.id,
        amount: parseFloat(record.amount) || 0,
        date: record.dateLent || (record.createdAt ? record.createdAt.split('T')[0] : 'N/A'),
        note: record.note || 'Initial loan'
      }
    ];
  };

  // Aggregated KPIs
  const stats = useMemo(() => {
    let totalLent = 0;
    let totalReturned = 0;
    let activeLoansCount = 0;
    let settledLoansCount = 0;
    let overdueCount = 0;
    let totalDisbursements = 0;

    lentRecords.forEach(r => {
      const total = parseFloat(r.amount) || 0;
      const returned = parseFloat(r.returnedAmount) || 0;

      totalLent += total;
      totalReturned += returned;

      const loansList = getRecordLoans(r);
      totalDisbursements += loansList.length;

      const status = getRecordStatus(r);
      if (status === 'settled') {
        settledLoansCount++;
      } else {
        activeLoansCount++;
        if (status === 'overdue') overdueCount++;
      }
    });

    const totalPending = Math.max(0, totalLent - totalReturned);
    const recoveryRate = totalLent > 0 ? (totalReturned / totalLent) * 100 : 0;

    return {
      totalLent,
      totalReturned,
      totalPending,
      activeLoansCount,
      settledLoansCount,
      overdueCount,
      totalDisbursements,
      recoveryRate
    };
  }, [lentRecords]);

  // Filtered and Sorted Records
  const filteredRecords = useMemo(() => {
    return lentRecords
      .filter(r => {
        const matchesSearch = 
          r.borrowerName?.toLowerCase().includes(search.toLowerCase()) ||
          r.note?.toLowerCase().includes(search.toLowerCase()) ||
          r.phone?.includes(search) ||
          (r.loans && r.loans.some(l => l.note?.toLowerCase().includes(search.toLowerCase())));

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
          return new Date(b.dateLent || b.createdAt || 0) - new Date(a.dateLent || a.createdAt || 0);
        }
        if (sortBy === 'date-asc') {
          return new Date(a.dateLent || a.createdAt || 0) - new Date(b.dateLent || b.createdAt || 0);
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
          return new Date(a.dueDate) - new Date(b.dueDate);
        }
        return 0;
      });
  }, [lentRecords, search, statusFilter, sortBy]);

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
        await deleteLentRecord(deleteConfirm.id);
        toast.success('Lending record deleted');
      } catch (e) {
        toast.error('Failed to delete record');
      }
    }
  };

  const handleSettlePrompt = (record) => {
    const total = parseFloat(record.amount) || 0;
    const returned = parseFloat(record.returnedAmount) || 0;
    const remaining = Math.max(0, total - returned);
    setSettleConfirm({ isOpen: true, id: record.id, name: record.borrowerName, amount: remaining });
  };

  const confirmSettle = async () => {
    if (settleConfirm.id) {
      try {
        await settleLentRecord(settleConfirm.id);
        toast.success(`Marked loan for ${settleConfirm.name} as fully settled!`);
      } catch (e) {
        toast.error('Failed to settle loan');
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
    doc.text("Lent Money Report (Money Lent to Friends)", 14, 22);
    
    // Subtext
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`, 14, 32);
    doc.text(`Filters: Status: ${statusFilter.toUpperCase()} | Sort: ${sortBy} | Search: "${search || 'None'}"`, 14, 38);

    // Separator line
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.setLineWidth(0.5);
    doc.line(14, 42, 196, 42);

    const tableColumn = ["Borrower", "Date Lent", "Total Lent", "Returned", "Pending", "Due Date", "Status"];
    const tableRows = [];

    let totalLentSum = 0;
    let totalReturnedSum = 0;
    let totalPendingSum = 0;

    filteredRecords.forEach(r => {
      const total = parseFloat(r.amount) || 0;
      const returned = parseFloat(r.returnedAmount) || 0;
      const remaining = Math.max(0, total - returned);
      const status = getRecordStatus(r).toUpperCase();

      totalLentSum += total;
      totalReturnedSum += returned;
      totalPendingSum += remaining;

      tableRows.push([
        r.borrowerName,
        r.dateLent ? new Date(r.dateLent).toLocaleDateString('en-IN') : 'N/A',
        formatCurrencyPDF(total),
        formatCurrencyPDF(returned),
        formatCurrencyPDF(remaining),
        r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-IN') : 'N/A',
        status
      ]);
    });

    tableRows.push(['TOTALS', '', formatCurrencyPDF(totalLentSum), formatCurrencyPDF(totalReturnedSum), formatCurrencyPDF(totalPendingSum), '', '']);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 48,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, textColor: [55, 65, 81] },
      headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold' }, // amber-500
      alternateRowStyles: { fillColor: [254, 252, 232] }, // amber-50/bg
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
            data.cell.styles.textColor = [217, 119, 6]; // amber-600
          }
        }
      }
    });

    doc.save(`lent_money_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportPDF = () => {
    if (filteredRecords.length === 0) {
      toast.error('No lent records to export');
      return;
    }
    setPdfConfirmOpen(true);
  };

  const getAvatarColor = (name) => {
    const colors = [
      'bg-indigo-500 text-white',
      'bg-amber-500 text-white',
      'bg-emerald-500 text-white',
      'bg-rose-500 text-white',
      'bg-cyan-500 text-white',
      'bg-purple-500 text-white',
      'bg-blue-500 text-white'
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-sm shadow-2xs">
              <FontAwesomeIcon icon={faHandHoldingDollar} />
            </span>
            Lent to Friends
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Track money lent, record top-ups & collect repayments
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto w-full sm:w-auto">
          {lentRecords.length > 0 && (
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
            <span>Lend Money</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pending */}
        <div className="glass-card p-5 transition-all glass-hover">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Pending to Collect
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-amber-600 dark:text-amber-400">
                <AnimatedCounter value={stats.totalPending} isCurrency={true} />
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faClock} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            {stats.activeLoansCount} active borrower{stats.activeLoansCount === 1 ? '' : 's'}
            {stats.overdueCount > 0 && (
              <span className="text-rose-500 font-semibold ml-1.5">({stats.overdueCount} overdue)</span>
            )}
          </p>
        </div>

        {/* Total Returned */}
        <div className="glass-card p-5 transition-all glass-hover">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Recovered Amount
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
                style={{ width: `${Math.min(stats.recoveryRate, 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {stats.recoveryRate.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Total Lent */}
        <div className="glass-card p-5 transition-all glass-hover">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Total Money Lent
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-zinc-900 dark:text-white">
                <AnimatedCounter value={stats.totalLent} isCurrency={true} />
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faMoneyBillWave} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            {stats.totalDisbursements} loan log{stats.totalDisbursements === 1 ? '' : 's'} across {lentRecords.length} friend{lentRecords.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Settled Loans */}
        <div className="glass-card p-5 transition-all glass-hover">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Settled Records
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-zinc-900 dark:text-white">
                <AnimatedCounter value={stats.settledLoansCount} isCurrency={false} />
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faUserFriends} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            {stats.settledLoansCount} friend{stats.settledLoansCount === 1 ? '' : 's'} fully settled
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
            placeholder="Search by friend, note, or phone..."
            className="w-full pl-9 pr-3.5 py-2 bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-xs dark:text-white"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
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
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-2xs'
                  : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 font-medium'
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
            className="w-full md:w-auto px-3 py-2 bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-xs font-medium dark:text-white cursor-pointer"
          >
            <option value="date-desc">Newest Date</option>
            <option value="date-asc">Oldest Date</option>
            <option value="pending-desc">Highest Pending</option>
            <option value="amount-desc">Highest Total</option>
            <option value="due-asc">Upcoming Due Date</option>
          </select>
        </div>
      </div>

      {/* Lent Records List */}
      <div className="space-y-4">
        {filteredRecords.map(record => {
          const total = parseFloat(record.amount) || 0;
          const returned = parseFloat(record.returnedAmount) || 0;
          const remaining = Math.max(0, total - returned);
          const percentRepaid = total > 0 ? Math.min((returned / total) * 100, 100) : 0;
          const status = getRecordStatus(record);
          const loans = getRecordLoans(record);
          const repayments = record.repayments || [];
          const isExpanded = !!expandedHistories[record.id];
          const currentTab = cardActivityTabs[record.id] || 'all';

          // Combined chronological ledger events
          const combinedTimeline = [
            ...loans.map((l, idx) => ({
              ...l,
              eventType: 'loan',
              eventTitle: idx === 0 ? 'Initial Loan' : `Top-up #${idx + 1}`,
              sortDate: new Date(l.date || record.dateLent || 0)
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
              className={`glass rounded-2xl p-5 transition-all border ${
                status === 'overdue' 
                  ? 'border-red-300 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/10'
                  : status === 'settled'
                  ? 'border-gray-200 dark:border-gray-800/80 opacity-90'
                  : 'border-gray-200 dark:border-gray-800'
              }`}
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800/80">
                <div className="flex items-center gap-3.5">
                  {/* Friend Avatar */}
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base shadow-sm shrink-0 ${getAvatarColor(record.borrowerName)}`}>
                    {(record.borrowerName || 'F').charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">
                        {record.borrowerName}
                      </h3>

                      {/* Status Badge */}
                      {status === 'settled' && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
                          <FontAwesomeIcon icon={faCheckCircle} /> Fully Settled
                        </span>
                      )}
                      {status === 'overdue' && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1 animate-pulse">
                          <FontAwesomeIcon icon={faExclamationTriangle} /> Overdue
                        </span>
                      )}
                      {status === 'partial' && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          Partially Returned ({percentRepaid.toFixed(0)}%)
                        </span>
                      )}
                      {status === 'pending' && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Pending Return
                        </span>
                      )}

                      {/* Loans count badge */}
                      {loans.length > 1 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                          <FontAwesomeIcon icon={faCoins} className="text-[10px]" />
                          <span>{loans.length} Loans Logged</span>
                        </span>
                      )}
                    </div>

                    {/* Metadata Subtitle */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <FontAwesomeIcon icon={faCalendarAlt} className="text-[10px]" />
                        First Lent: {new Date(record.dateLent || (loans[0] && loans[0].date) || 0).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      {record.dueDate && (
                        <>
                          <span>&bull;</span>
                          <span className={status === 'overdue' ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                            Due: {new Date(record.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </>
                      )}
                      {record.phone && (
                        <>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <FontAwesomeIcon icon={faPhone} className="text-[10px]" />
                            {record.phone}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Amounts Breakdown */}
                <div className="flex items-center gap-4 self-end sm:self-auto text-right">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                      {remaining > 0 ? 'Pending Balance' : 'Status'}
                    </p>
                    <p className={`text-lg sm:text-xl font-bold ${
                      remaining > 0 
                        ? (status === 'overdue' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {remaining > 0 ? formatCurrency(remaining) : 'Paid in Full'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      of {formatCurrency(total)} total lent
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-gray-500 dark:text-gray-400">
                    Repaid: <strong className="text-green-600 dark:text-green-400">{formatCurrency(returned)}</strong>
                  </span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {percentRepaid.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      percentRepaid >= 100 
                        ? 'bg-green-500' 
                        : status === 'overdue'
                        ? 'bg-gradient-to-r from-red-500 to-amber-500'
                        : 'bg-gradient-to-r from-amber-500 to-green-500'
                    }`}
                    style={{ width: `${percentRepaid}%` }}
                  />
                </div>
              </div>

              {/* Note if present */}
              {record.note && (
                <div className="mt-3 text-xs bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-xl text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-800 flex items-start gap-2">
                  <span className="font-semibold text-gray-500 shrink-0">Note:</span>
                  <span className="italic">{record.note}</span>
                </div>
              )}

              {/* Comprehensive Activity & Lending Logs Accordion */}
              <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => toggleHistory(record.id)}
                  className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-between w-full py-1 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faHistory} className="text-amber-500" />
                    <span>
                      Activity Logs ({loans.length} loan{loans.length === 1 ? '' : 's'} given, {repayments.length} return{repayments.length === 1 ? '' : 's'})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <span className="text-[11px]">{isExpanded ? 'Hide Logs' : 'View Logs & History'}</span>
                    <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} className="text-[10px]" />
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-2.5 pt-2 border-t border-dashed border-gray-200 dark:border-gray-800 animate-fade-in space-y-3">
                    {/* Filter tabs inside history */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl text-xs">
                        <button
                          type="button"
                          onClick={() => setCardTab(record.id, 'all')}
                          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                            currentTab === 'all'
                              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs font-semibold'
                              : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                          }`}
                        >
                          All Logs ({combinedTimeline.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardTab(record.id, 'loans')}
                          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                            currentTab === 'loans'
                              ? 'bg-amber-500 text-white shadow-xs font-semibold'
                              : 'text-gray-500 hover:text-amber-600 dark:hover:text-amber-400'
                          }`}
                        >
                          📤 Loans Given ({loans.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardTab(record.id, 'repayments')}
                          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                            currentTab === 'repayments'
                              ? 'bg-green-600 text-white shadow-xs font-semibold'
                              : 'text-gray-500 hover:text-green-600 dark:hover:text-green-400'
                          }`}
                        >
                          📥 Returned ({repayments.length})
                        </button>
                      </div>

                      {/* Quick Lend More trigger from inside logs */}
                      <button
                        type="button"
                        onClick={() => setLendMoreTarget(record)}
                        className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                        <span>Add Another Loan / Top-up</span>
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
                              item.eventType === 'loan'
                                ? 'bg-amber-500/5 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40'
                                : 'bg-green-500/5 dark:bg-green-950/20 border-green-200/60 dark:border-green-900/40'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                item.eventType === 'loan'
                                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                                  : 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                              }`}>
                                <FontAwesomeIcon icon={item.eventType === 'loan' ? faHandHoldingDollar : faCheckCircle} />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-gray-900 dark:text-white">
                                    {item.eventTitle}
                                  </span>
                                  <span className="text-[11px] text-gray-400">
                                    &bull; {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                </div>
                                {item.note && (
                                  <p className="text-[11px] text-gray-500 dark:text-gray-400 italic mt-0.5">
                                    "{item.note}"
                                  </p>
                                )}
                              </div>
                            </div>

                            <span className={`font-bold text-sm shrink-0 ${
                              item.eventType === 'loan'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-green-600 dark:text-green-400'
                            }`}>
                              {item.eventType === 'loan' ? '-' : '+'} {formatCurrency(item.amount)}
                            </span>
                          </div>
                        ))
                      )}

                      {/* Only loans */}
                      {currentTab === 'loans' && (
                        loans.map((l, idx) => (
                          <div 
                            key={l.id || idx} 
                            className="flex items-center justify-between p-2.5 rounded-xl border bg-amber-500/5 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                                <FontAwesomeIcon icon={faHandHoldingDollar} />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-gray-900 dark:text-white">
                                    {idx === 0 ? 'Initial Loan' : `Disbursement Top-up #${idx + 1}`}
                                  </span>
                                  <span className="text-[11px] text-gray-400">
                                    &bull; {new Date(l.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                </div>
                                {l.note && (
                                  <p className="text-[11px] text-gray-500 dark:text-gray-400 italic mt-0.5">
                                    "{l.note}"
                                  </p>
                                )}
                              </div>
                            </div>

                            <span className="font-bold text-sm text-amber-600 dark:text-amber-400 shrink-0">
                              Lent: {formatCurrency(l.amount)}
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
                              className="flex items-center justify-between p-2.5 rounded-xl border bg-green-500/5 dark:bg-green-950/20 border-green-200/60 dark:border-green-900/40 text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 flex items-center justify-center font-bold text-xs shrink-0">
                                  <FontAwesomeIcon icon={faCheckCircle} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                      Repayment #{idx + 1}
                                    </span>
                                    <span className="text-[11px] text-gray-400">
                                      &bull; {new Date(rep.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                  </div>
                                  {rep.note && (
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 italic mt-0.5">
                                      "{rep.note}"
                                    </p>
                                  )}
                                </div>
                              </div>

                              <span className="font-bold text-sm text-green-600 dark:text-green-400 shrink-0">
                                + {formatCurrency(rep.amount)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-xs text-gray-400">
                            No repayments logged yet for this friend.
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Lend More Button */}
                  <button
                    type="button"
                    onClick={() => setLendMoreTarget(record)}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Lend more money to this same person and record a disbursement log"
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    <span>Lend More</span>
                  </button>

                  {/* Return Button */}
                  {remaining > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setRepayTarget(record)}
                        className="px-3.5 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <FontAwesomeIcon icon={faCheckCircle} />
                        <span>Record Return</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSettlePrompt(record)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                        <span>Settle All</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReminderTarget(record)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <FontAwesomeIcon icon={faPaperPlane} />
                        <span>Remind</span>
                      </button>
                    </>
                  )}

                  {remaining <= 0 && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                      <FontAwesomeIcon icon={faCheckCircle} /> Completed & Settled
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEdit(record)}
                    className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs cursor-pointer"
                    title="Edit Record Details"
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(record.id, record.borrowerName)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-xs cursor-pointer"
                    title="Delete Record"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {filteredRecords.length === 0 && !loading && (
          <div className="glass rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl mx-auto">
              <FontAwesomeIcon icon={faHandHoldingDollar} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {search || statusFilter !== 'all' ? 'No matching lent records' : 'No money lent to friends yet'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                {search || statusFilter !== 'all'
                  ? 'Try adjusting your search or clearing the status filter'
                  : 'Whenever you lend money to friends or colleagues, record it here to track returns and top-ups without interfering with daily living expenses.'}
              </p>
            </div>
            {(!search && statusFilter === 'all') && (
              <button
                type="button"
                onClick={() => {
                  setEditingRecord(null);
                  setIsFormOpen(true);
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 transition-all inline-flex items-center gap-2 text-sm cursor-pointer"
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Lend Money to a Friend</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <LentFormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        initialData={editingRecord}
      />

      <LendMoreModal
        isOpen={!!lendMoreTarget}
        onClose={() => setLendMoreTarget(null)}
        record={lendMoreTarget}
      />

      <RepaymentModal
        isOpen={!!repayTarget}
        onClose={() => setRepayTarget(null)}
        record={repayTarget}
      />

      <ReminderModal
        isOpen={!!reminderTarget}
        onClose={() => setReminderTarget(null)}
        record={reminderTarget}
      />

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: '' })}
        onConfirm={confirmDelete}
        title="Delete Lending Record"
        message={`Are you sure you want to delete the lending record for "${deleteConfirm.name}"? This action cannot be undone.`}
        confirmText="Delete"
        isDestructive={true}
      />

      <ConfirmModal
        isOpen={settleConfirm.isOpen}
        onClose={() => setSettleConfirm({ isOpen: false, id: null, name: '', amount: 0 })}
        onConfirm={confirmSettle}
        title="Mark Loan as Settled"
        message={`Confirm that ${settleConfirm.name} has fully returned the remaining balance of ₹${settleConfirm.amount.toLocaleString('en-IN')}?`}
        confirmText="Yes, Mark Settled"
        isDestructive={false}
      />

      <ConfirmModal 
        isOpen={pdfConfirmOpen}
        onClose={() => setPdfConfirmOpen(false)}
        onConfirm={exportToPDF}
        title="Export to PDF"
        message={`Are you sure you want to generate and download a PDF report containing ${filteredRecords.length} lent record(s)?`}
        confirmText="Export PDF"
        isDestructive={false}
      />
    </div>
  );
};

export default LentMoney;
