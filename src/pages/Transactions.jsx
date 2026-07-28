import React, { useState, useMemo } from 'react';
import { useTransactions } from '../context/TransactionContext';
import TransactionForm from '../components/transactions/TransactionForm';
import ConfirmModal from '../components/ui/ConfirmModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faEdit, faSearch, faFilter, faFilePdf, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TransactionsSkeleton } from '../components/ui/Skeleton';
import SwipeableItem from '../components/transactions/SwipeableItem';
import toast from 'react-hot-toast';

const Transactions = () => {
  const { transactions, categories, deleteTransaction, loading } = useTransactions();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [timeFilter, setTimeFilter] = useState('today');
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null });
  const [pdfConfirmOpen, setPdfConfirmOpen] = useState(false);
  const [swipeResetToken, setSwipeResetToken] = useState(0);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    
    const getStartOfWeek = (d) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      date.setDate(diff);
      date.setHours(0,0,0,0);
      return date;
    };

    return transactions
      .filter(t => {
        const matchesSearch = t.note?.toLowerCase().includes(search.toLowerCase()) || 
                              categories.find(c => c.id === t.categoryId)?.name.toLowerCase().includes(search.toLowerCase());
        const matchesType = filterType === 'all' || t.type === filterType;
        
        let matchesTime = true;
        const txDate = new Date(t.date);
        
        if (timeFilter === 'today') {
          matchesTime = txDate.toDateString() === now.toDateString();
        } else if (timeFilter === 'week') {
          matchesTime = txDate >= getStartOfWeek(now);
        } else if (timeFilter === 'month') {
          matchesTime = txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
        } else if (timeFilter === 'year') {
          matchesTime = txDate.getFullYear() === now.getFullYear();
        } else if (timeFilter === 'custom') {
          const txDateStr = t.date.includes('T') ? t.date.split('T')[0] : t.date;
          matchesTime = txDateStr === customDate;
        }

        return matchesSearch && matchesType && matchesTime;
      })
      .sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [transactions, search, filterType, timeFilter, categories]);

  const handleEdit = (tx) => {
    setEditingTx(tx);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setTimeout(() => setEditingTx(null), 300); // Clear after animation
  };

  const requestDelete = (id) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (deleteConfirm.id) {
      try {
        await deleteTransaction(deleteConfirm.id);
        toast.success('Transaction deleted');
      } catch (e) {
        toast.error('Failed to delete transaction');
      }
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  const formatCurrencyPDF = (amount) => {
    return 'Rs. ' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Nice Header
    doc.setFontSize(22);
    doc.setTextColor(31, 41, 55); // gray-800
    doc.text("Transactions Report", 14, 22);
    
    // Subtext
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`, 14, 32);
    doc.text(`Filters: Type: ${filterType.toUpperCase()} | Time: ${timeFilter.toUpperCase()} | Search: "${search || 'None'}"`, 14, 38);

    // Separator line
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.setLineWidth(0.5);
    doc.line(14, 42, 196, 42);

    const tableColumn = ["Date", "Type", "Category", "Note", "Amount"];
    const tableRows = [];

    let totalIncome = 0;
    let totalExpense = 0;

    filteredTransactions.forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      if (t.type === 'income') totalIncome += t.amount;
      else totalExpense += t.amount;

      tableRows.push([
        new Date(t.date).toLocaleDateString('en-IN'),
        t.type === 'income' ? 'Income' : 'Expense',
        cat ? cat.name : 'Unknown',
        t.note || '-',
        formatCurrencyPDF(t.amount)
      ]);
    });

    tableRows.push(['', '', '', 'Total Income:', formatCurrencyPDF(totalIncome)]);
    tableRows.push(['', '', '', 'Total Expense:', formatCurrencyPDF(totalExpense)]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 48,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 4, textColor: [55, 65, 81] },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' }, // primary-500
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' } // Align amount column to right
      },
      didParseCell: function(data) {
        // Highlight totals row
        if (data.row.index >= filteredTransactions.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [243, 244, 246]; // gray-100
          data.cell.styles.textColor = [17, 24, 39]; // gray-900
          
          // Add income/expense colors to the total amount cell
          if (data.row.index === filteredTransactions.length && data.column.index === 4) {
            data.cell.styles.textColor = [34, 197, 94]; // green-500
          }
          if (data.row.index === filteredTransactions.length + 1 && data.column.index === 4) {
            data.cell.styles.textColor = [239, 68, 68]; // red-500
          }
        }
      }
    });

    doc.save(`transactions_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportPDF = () => {
    if (filteredTransactions.length === 0) {
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Transactions</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your income and expenses</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={handleExportPDF}
            className="flex-1 md:flex-none items-center justify-center gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            <FontAwesomeIcon icon={faFilePdf} className="text-red-500" />
            <span className="hidden sm:inline">Export PDF</span>
          </button>
          
          <button 
            onClick={() => setIsFormOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-primary-500/20"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span className="hidden sm:inline">Add Transaction</span>
          </button>
        </div>
      </header>

      {/* Filters & Search */}
      <div className="glass rounded-2xl p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search transactions..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white"
          />
        </div>
        <div className="relative min-w-[150px]">
          <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <select 
            value={timeFilter}
            onChange={e => setTimeFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white appearance-none"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
            <option value="custom">Specific Date</option>
          </select>
        </div>
        {timeFilter === 'custom' && (
          <div className="relative min-w-[150px] animate-fade-in">
            <input 
              type="date"
              value={customDate}
              onChange={e => setCustomDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white"
            />
          </div>
        )}
        <div className="relative min-w-[150px]">
          <FontAwesomeIcon icon={faFilter} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <select 
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white appearance-none"
          >
            <option value="all">All Types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
      </div>

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
                const cat = categories.find(c => c.id === t.categoryId);
                return (
                  <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                    <td className="p-4 text-gray-900 dark:text-gray-300">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: cat?.color || '#ccc' }}>
                          <FontAwesomeIcon icon={cat?.icon || 'fa-circle'} />
                        </div>
                        <span className="text-gray-900 dark:text-gray-300">{cat?.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">{t.note || '-'}</td>
                    <td className={`p-4 text-right font-medium ${t.type === 'income' ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(t)} className="p-2 text-gray-400 hover:text-primary-500 transition-colors">
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button onClick={() => requestDelete(t.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Stacked List View */}
      <div className="md:hidden pb-24">
        {filteredTransactions.map(t => {
          const cat = categories.find(c => c.id === t.categoryId);
          return (
            <SwipeableItem 
              key={t.id} 
              onEdit={() => handleEdit(t)} 
              onDelete={() => requestDelete(t.id)}
              resetToken={swipeResetToken}
            >
              <div className="glass p-4 flex items-center gap-3">
                <div className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: cat?.color || '#ccc' }}>
                  <FontAwesomeIcon icon={cat?.icon || 'fa-circle'} className="text-xl" />
                </div>
                
                <div className="flex-1 min-w-0 py-1">
                  <p className="font-semibold text-gray-900 dark:text-white text-base leading-snug line-clamp-2">
                    {t.note || cat?.name}
                  </p>
                  <p className="text-sm text-gray-500 mt-1 truncate">
                    {new Date(t.date).toLocaleDateString()} &bull; {cat?.name}
                  </p>
                </div>
                
                <div className="text-right shrink-0 ml-2">
                  <p className={`font-bold text-base whitespace-nowrap ${t.type === 'income' ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </p>
                </div>
              </div>
            </SwipeableItem>
          );
        })}
        {filteredTransactions.length === 0 && (
          <div className="text-center p-8 text-gray-500">No transactions found.</div>
        )}
      </div>

      {/* Mobile Sticky FAB */}
      <button 
        onClick={() => setIsFormOpen(true)}
        className="md:hidden fixed bottom-20 right-6 w-14 h-14 bg-primary-600 hover:bg-primary-500 text-white rounded-full flex items-center justify-center text-xl shadow-lg shadow-primary-500/40 z-40 transition-transform active:scale-95"
      >
        <FontAwesomeIcon icon={faPlus} />
      </button>

      {/* Transaction Modal */}
      <TransactionForm isOpen={isFormOpen} onClose={handleCloseForm} initialData={editingTx} />

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
        message={`Are you sure you want to generate and download a PDF report containing ${filteredTransactions.length} transaction(s)?`}
        confirmText="Export"
        isDanger={false}
      />
    </div>
  );
};

export default Transactions;
