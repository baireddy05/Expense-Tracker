import React, { useState, useMemo } from 'react';
import { useTransactions } from '../context/TransactionContext';
import LentFormModal from '../components/lent/LentFormModal';
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
  faDownload, 
  faChevronDown, 
  faChevronUp, 
  faHistory,
  faMoneyBillWave,
  faUserFriends,
  faCalendarAlt,
  faPhone
} from '@fortawesome/free-solid-svg-icons';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

const LentMoney = () => {
  const { lentRecords = [], deleteLentRecord, settleLentRecord, loading } = useTransactions();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, partial, overdue, settled
  const [sortBy, setSortBy] = useState('date-desc'); // date-desc, date-asc, amount-desc, pending-desc, due-asc

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  
  const [repayTarget, setRepayTarget] = useState(null);
  const [reminderTarget, setReminderTarget] = useState(null);
  
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });
  const [settleConfirm, setSettleConfirm] = useState({ isOpen: false, id: null, name: '', amount: 0 });

  const [expandedHistories, setExpandedHistories] = useState({});

  const toggleHistory = (id) => {
    setExpandedHistories(prev => ({ ...prev, [id]: !prev[id] }));
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

  // Aggregated KPIs
  const stats = useMemo(() => {
    let totalLent = 0;
    let totalReturned = 0;
    let activeLoansCount = 0;
    let settledLoansCount = 0;
    let overdueCount = 0;

    lentRecords.forEach(r => {
      const total = parseFloat(r.amount) || 0;
      const returned = parseFloat(r.returnedAmount) || 0;
      const remaining = Math.max(0, total - returned);

      totalLent += total;
      totalReturned += returned;

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
          r.phone?.includes(search);

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

  const handleExportCSV = () => {
    if (lentRecords.length === 0) {
      toast.error('No lent records to export');
      return;
    }

    const exportData = lentRecords.map(r => {
      const total = parseFloat(r.amount) || 0;
      const returned = parseFloat(r.returnedAmount) || 0;
      const remaining = Math.max(0, total - returned);
      const status = getRecordStatus(r);

      return {
        'Borrower Name': r.borrowerName,
        'Amount Lent (INR)': total,
        'Returned Amount (INR)': returned,
        'Pending Amount (INR)': remaining,
        'Date Lent': r.dateLent,
        'Due Date': r.dueDate || 'N/A',
        'Status': status.toUpperCase(),
        'Phone': r.phone || 'N/A',
        'Reason / Note': r.note || '',
        'Repayments Count': (r.repayments || []).length
      };
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `lent_money_tracker_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Lent records exported to CSV');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span className="p-2 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <FontAwesomeIcon icon={faHandHoldingDollar} className="text-2xl" />
            </span>
            Lent to Friends
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Track money lent to friends & collect repayments without affecting daily living expenses
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {lentRecords.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors flex items-center gap-2 text-sm"
              title="Export to CSV"
            >
              <FontAwesomeIcon icon={faDownload} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}

          <button
            onClick={() => {
              setEditingRecord(null);
              setIsFormOpen(true);
            }}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2 text-sm"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Lend Money</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pending */}
        <div className="glass rounded-2xl p-5 border-l-4 border-l-amber-500 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Pending to Collect
              </p>
              <h2 className="text-2xl lg:text-3xl font-bold mt-1.5 text-amber-600 dark:text-amber-400">
                <AnimatedCounter value={stats.totalPending} isCurrency={true} />
              </h2>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <FontAwesomeIcon icon={faClock} />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {stats.activeLoansCount} active borrower{stats.activeLoansCount === 1 ? '' : 's'}
            {stats.overdueCount > 0 && (
              <span className="text-red-500 font-semibold ml-1.5">({stats.overdueCount} overdue)</span>
            )}
          </p>
        </div>

        {/* Total Returned */}
        <div className="glass rounded-2xl p-5 border-l-4 border-l-green-500 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Recovered / Returned
              </p>
              <h2 className="text-2xl lg:text-3xl font-bold mt-1.5 text-green-600 dark:text-green-400">
                <AnimatedCounter value={stats.totalReturned} isCurrency={true} />
              </h2>
            </div>
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-700" 
                style={{ width: `${Math.min(stats.recoveryRate, 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-green-600 dark:text-green-400">
              {stats.recoveryRate.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Total Lent */}
        <div className="glass rounded-2xl p-5 border-l-4 border-l-indigo-500 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Total Money Lent
              </p>
              <h2 className="text-2xl lg:text-3xl font-bold mt-1.5 text-gray-900 dark:text-white">
                <AnimatedCounter value={stats.totalLent} isCurrency={true} />
              </h2>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <FontAwesomeIcon icon={faMoneyBillWave} />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Across {lentRecords.length} total loan record{lentRecords.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Settled Loans */}
        <div className="glass rounded-2xl p-5 border-l-4 border-l-blue-500 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Settled Loans
              </p>
              <h2 className="text-2xl lg:text-3xl font-bold mt-1.5 text-blue-600 dark:text-blue-400">
                <AnimatedCounter value={stats.settledLoansCount} isCurrency={false} />
              </h2>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <FontAwesomeIcon icon={faUserFriends} />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {stats.settledLoansCount} friend{stats.settledLoansCount === 1 ? '' : 's'} fully paid back
          </p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="glass rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            <FontAwesomeIcon icon={faSearch} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by friend's name, note, or phone..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm dark:text-white"
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
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
            className="w-full md:w-auto px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-medium dark:text-white"
          >
            <option value="date-desc">Newest Lent Date</option>
            <option value="date-asc">Oldest Lent Date</option>
            <option value="pending-desc">Highest Pending</option>
            <option value="amount-desc">Highest Total Lent</option>
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
          const repayments = record.repayments || [];
          const isExpanded = !!expandedHistories[record.id];

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
                    </div>

                    {/* Metadata Subtitle */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <FontAwesomeIcon icon={faCalendarAlt} className="text-[10px]" />
                        Lent on {new Date(record.dateLent).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
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
                      of {formatCurrency(total)} total
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
                  <span className="font-semibold text-gray-500 shrink-0">Reason:</span>
                  <span className="italic">{record.note}</span>
                </div>
              )}

              {/* Repayments History Accordion */}
              {repayments.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => toggleHistory(record.id)}
                    className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5"
                  >
                    <FontAwesomeIcon icon={faHistory} />
                    <span>Repayment History ({repayments.length} payment{repayments.length === 1 ? '' : 's'})</span>
                    <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} className="text-[10px]" />
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-green-500/30">
                      {repayments.map((rep, idx) => (
                        <div key={rep.id || idx} className="flex justify-between items-center text-xs py-1 text-gray-600 dark:text-gray-300">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            <span>{new Date(rep.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            {rep.note && <span className="text-gray-400">({rep.note})</span>}
                          </div>
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            +{formatCurrency(rep.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {remaining > 0 && (
                    <>
                      <button
                        onClick={() => setRepayTarget(record)}
                        className="px-3.5 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <FontAwesomeIcon icon={faPlus} />
                        <span>Record Return</span>
                      </button>

                      <button
                        onClick={() => handleSettlePrompt(record)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                        <span>Settle All</span>
                      </button>

                      <button
                        onClick={() => setReminderTarget(record)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
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
                    onClick={() => handleEdit(record)}
                    className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs"
                    title="Edit Record"
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button
                    onClick={() => handleDelete(record.id, record.borrowerName)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-xs"
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
                  : 'Whenever you lend money to friends or colleagues, record it here to track returns without interfering with daily living expenses.'}
              </p>
            </div>
            {(!search && statusFilter === 'all') && (
              <button
                onClick={() => {
                  setEditingRecord(null);
                  setIsFormOpen(true);
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 transition-all inline-flex items-center gap-2 text-sm"
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
    </div>
  );
};

export default LentMoney;
