import React, { useState, useMemo } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { useUI } from '../context/UIContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSuitcase, 
  faPlus, 
  faCalendarAlt, 
  faTag, 
  faReceipt, 
  faEdit, 
  faTrash, 
  faArrowTrendUp, 
  faExclamationTriangle,
  faCheckCircle,
  faUmbrellaBeach,
  faRing,
  faGift,
  faHouse,
  faCar,
  faPlane,
  faChampagneGlasses,
  faBriefcase,
  faTimes,
  faArrowRight
} from '@fortawesome/free-solid-svg-icons';
import { getLocalDateString, formatDisplayDate } from '../utils/dateUtils';
import { getCategoryIcon, resolveCategory } from '../utils/categoryIcons';
import ConfirmModal from '../components/ui/ConfirmModal';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import toast from 'react-hot-toast';

const EVENT_ICONS = {
  'fa-suitcase': faSuitcase,
  'fa-umbrella-beach': faUmbrellaBeach,
  'fa-plane': faPlane,
  'fa-car': faCar,
  'fa-ring': faRing,
  'fa-gift': faGift,
  'fa-champagne-glasses': faChampagneGlasses,
  'fa-house': faHouse,
  'fa-briefcase': faBriefcase
};

const COLOR_PRESETS = [
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#ef4444'  // Rose
];

const Events = () => {
  const { 
    events = [], 
    transactions = [], 
    categories = [],
    addEvent, 
    updateEvent, 
    deleteEvent 
  } = useTransactions();
  
  const { isPrivacyMode } = useUI();

  // Modals state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });
  const [viewingEvent, setViewingEvent] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useBodyScrollLock(isEventModalOpen || !!viewingEvent);

  // Form states
  const [eventForm, setEventForm] = useState({
    name: '',
    tag: '',
    budget: '',
    startDate: '',
    endDate: '',
    icon: 'fa-suitcase',
    color: '#6366f1',
    description: ''
  });

  const formatCurrency = (amount) => {
    if (isPrivacyMode) return '₹••••••';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  // Metrics Summary
  const summary = useMemo(() => {
    let totalBudget = 0;
    let totalSpent = 0;
    let overBudgetCount = 0;

    events.forEach(e => {
      totalBudget += parseFloat(e.budget) || 0;
      totalSpent += parseFloat(e.spent) || 0;
      if (e.isOverBudget) overBudgetCount++;
    });

    const remaining = Math.max(0, totalBudget - totalSpent);
    const overallPercentage = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

    return { totalBudget, totalSpent, remaining, overallPercentage, count: events.length, overBudgetCount };
  }, [events]);

  // Open Create/Edit Modal
  const handleOpenEventModal = (event = null) => {
    if (event) {
      setEventForm({
        name: event.name,
        tag: event.tag || '',
        budget: event.budget || '',
        startDate: event.startDate || '',
        endDate: event.endDate || '',
        icon: event.icon || 'fa-suitcase',
        color: event.color || '#6366f1',
        description: event.description || ''
      });
      setEditingId(event.id);
    } else {
      setEventForm({
        name: '',
        tag: '',
        budget: '',
        startDate: getLocalDateString(),
        endDate: '',
        icon: 'fa-suitcase',
        color: '#6366f1',
        description: ''
      });
      setEditingId(null);
    }
    setIsEventModalOpen(true);
  };

  // Name change auto-generates tag if tag not manually typed
  const handleNameChange = (val) => {
    const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '');
    setEventForm(prev => ({
      ...prev,
      name: val,
      tag: prev.tag === prev.name.toLowerCase().replace(/[^a-z0-9]/g, '') || !prev.tag ? slug : prev.tag
    }));
  };

  // Save Event
  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.name.trim()) {
      toast.error('Please enter a trip/event name');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...eventForm,
        name: eventForm.name.trim(),
        tag: eventForm.tag.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'trip_' + Date.now(),
        budget: parseFloat(eventForm.budget) || 0
      };

      if (editingId) {
        await updateEvent(editingId, payload);
        toast.success('Trip/Event updated');
      } else {
        await addEvent(payload);
        toast.success('New Trip/Event created!');
      }
      setIsEventModalOpen(false);
    } catch (err) {
      toast.error('Failed to save trip/event');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Event
  const handleDeleteEvent = (id, name) => {
    setDeleteConfirm({ isOpen: true, id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteEvent(deleteConfirm.id);
      toast.success('Trip/Event deleted');
    } catch (err) {
      toast.error('Failed to delete trip/event');
    }
  };

  // Get matching transactions for an event
  const getEventTransactions = (event) => {
    if (!event) return [];
    const tagClean = (event.tag || '').toLowerCase();
    return transactions.filter(t => {
      if (t.type !== 'expense') return false;
      const note = (t.note || '').toLowerCase();
      const tTag = (t.eventTag || t.tag || '').toLowerCase();
      const hasTag = tagClean && (tTag === tagClean || note.includes('#' + tagClean) || (t.tags && t.tags.some(tag => tag.toLowerCase() === tagClean)));
      const matchesEventId = t.eventId === event.id;
      return hasTag || matchesEventId;
    });
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-sm shadow-2xs">
              <FontAwesomeIcon icon={faSuitcase} />
            </span>
            <span>Trips & Event Budgets</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Track expenses for vacations, weddings, festivals, and special projects
          </p>
        </div>

        <button
          onClick={() => handleOpenEventModal()}
          className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 cursor-pointer touch-feedback self-start sm:self-auto"
        >
          <FontAwesomeIcon icon={faPlus} />
          <span>New Trip / Event</span>
        </button>
      </header>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Total Events Spent
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-rose-500">
                {formatCurrency(summary.totalSpent)}
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faReceipt} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            Across {summary.count} tracked event{summary.count === 1 ? '' : 's'}
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Total Allocated Budget
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-zinc-900 dark:text-white">
                {formatCurrency(summary.totalBudget)}
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faSuitcase} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            Remaining: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(summary.remaining)}</strong>
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Budget Utilization
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-zinc-900 dark:text-white">
                {summary.overallPercentage.toFixed(1)}%
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faArrowTrendUp} />
            </div>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-3">
            <div 
              className={`h-full rounded-full transition-all duration-700 ${summary.overBudgetCount > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
              style={{ width: `${Math.min(summary.overallPercentage, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Events Grid List */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3 px-1">
          Your Trips & Events ({events.length})
        </h2>

        {events.length === 0 ? (
          <div className="glass-card p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto text-lg">
              <FontAwesomeIcon icon={faSuitcase} />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">No Trips or Events Yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Plan and track costs for vacations, festivals, weddings, or group road trips with dedicated event budgets.
            </p>
            <button
              onClick={() => handleOpenEventModal()}
              className="mt-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>Create Your First Trip/Event</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map(event => {
              const budget = parseFloat(event.budget) || 0;
              const spent = parseFloat(event.spent) || 0;
              const percent = budget > 0 ? (spent / budget) * 100 : 0;
              const isOver = spent > budget && budget > 0;
              const iconObj = EVENT_ICONS[event.icon] || faSuitcase;

              return (
                <div 
                  key={event.id}
                  className={`glass-card p-5 flex flex-col justify-between transition-all relative overflow-hidden ${
                    isOver ? 'border-rose-300/80 dark:border-rose-900/60 bg-rose-50/10 dark:bg-rose-950/10' : ''
                  }`}
                >
                  {/* Card Top */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-base shadow-2xs shrink-0"
                          style={{ backgroundColor: event.color || '#6366f1' }}
                        >
                          <FontAwesomeIcon icon={iconObj} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-zinc-900 dark:text-white leading-tight">
                              {event.name}
                            </h3>
                            {isOver && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center gap-1">
                                <FontAwesomeIcon icon={faExclamationTriangle} />
                                <span>OVER BUDGET</span>
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                            <span className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-mono font-bold">
                              #{event.tag}
                            </span>
                            {event.startDate && (
                              <span className="flex items-center gap-1">
                                <FontAwesomeIcon icon={faCalendarAlt} className="text-[9px]" />
                                <span>{formatDisplayDate(event.startDate)} {event.endDate ? `→ ${formatDisplayDate(event.endDate)}` : ''}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEventModal(event)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                          title="Edit Event"
                        >
                          <FontAwesomeIcon icon={faEdit} className="text-[11px]" />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(event.id, event.name)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-zinc-400 hover:text-rose-500 transition-colors cursor-pointer"
                          title="Delete Event"
                        >
                          <FontAwesomeIcon icon={faTrash} className="text-[11px]" />
                        </button>
                      </div>
                    </div>

                    {event.description && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    {/* Progress Bar & Amount Row */}
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold text-zinc-900 dark:text-white">
                          Spent: {formatCurrency(spent)}
                        </span>
                        <span className="text-xs font-semibold text-zinc-400">
                          Budget: {budget > 0 ? formatCurrency(budget) : 'No limit'}
                        </span>
                      </div>

                      {budget > 0 && (
                        <>
                          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-700 ease-out ${
                                isOver ? 'bg-rose-500' : percent > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`} 
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-zinc-400">
                            <span>{percent.toFixed(1)}% of budget used</span>
                            <span>{isOver ? `Over by ${formatCurrency(spent - budget)}` : `${formatCurrency(budget - spent)} left`}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom */}
                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400">
                      {event.txCount || 0} transaction(s) logged
                    </span>

                    <button
                      onClick={() => setViewingEvent(event)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white transition-colors flex items-center gap-1.5 cursor-pointer touch-feedback"
                    >
                      <span>View Expenses</span>
                      <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Event Modal */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden max-h-[90vh] flex flex-col my-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                <FontAwesomeIcon icon={editingId ? faEdit : faPlus} className="text-zinc-400" />
                {editingId ? 'Edit Trip / Event' : 'New Trip / Event'}
              </h3>
              <button 
                onClick={() => setIsEventModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-500 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Trip / Event Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={eventForm.name}
                  onChange={e => handleNameChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white font-medium"
                  placeholder="e.g. Goa Trip 2026, Sister's Wedding, Diwali Shopping"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    Tag Identifier <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-xs">#</span>
                    <input
                      type="text"
                      required
                      value={eventForm.tag}
                      onChange={e => setEventForm({ ...eventForm, tag: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                      className="w-full pl-7 pr-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white font-mono"
                      placeholder="goatrip2026"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    Target Budget (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-xs">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={eventForm.budget}
                      onChange={e => setEventForm({ ...eventForm, budget: e.target.value })}
                      className="w-full pl-8 pr-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white font-medium"
                      placeholder="35000"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={eventForm.startDate}
                    onChange={e => setEventForm({ ...eventForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none text-xs text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={eventForm.endDate}
                    onChange={e => setEventForm({ ...eventForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none text-xs text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Color Theme
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEventForm({ ...eventForm, color })}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${eventForm.color === color ? 'scale-125 ring-2 ring-zinc-900 dark:ring-white ring-offset-2 dark:ring-offset-zinc-900' : 'hover:scale-110'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Icon
                </label>
                <div className="grid grid-cols-9 gap-1.5">
                  {Object.entries(EVENT_ICONS).map(([key, iconObj]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEventForm({ ...eventForm, icon: key })}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-center transition-all cursor-pointer ${eventForm.icon === key ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                    >
                      <FontAwesomeIcon icon={iconObj} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Notes / Description (Optional)
                </label>
                <input
                  type="text"
                  value={eventForm.description}
                  onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                  placeholder="e.g. Flight tickets, resort stay, dining"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none text-xs text-zinc-900 dark:text-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-bold transition-all disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white dark:border-black/30 dark:border-t-black rounded-full animate-spin" />
                  ) : (
                    editingId ? 'Update Trip / Event' : 'Create Trip / Event'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Event Expenses Slide-Out / Modal */}
      {viewingEvent && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto"
          onClick={() => setViewingEvent(null)}
        >
          <div 
            className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden max-h-[85vh] flex flex-col my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm shrink-0"
                  style={{ backgroundColor: viewingEvent.color || '#6366f1' }}
                >
                  <FontAwesomeIcon icon={EVENT_ICONS[viewingEvent.icon] || faSuitcase} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white leading-tight">
                    {viewingEvent.name}
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-mono">#{viewingEvent.tag}</p>
                </div>
              </div>

              <button 
                onClick={() => setViewingEvent(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-500 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Spent Tally Summary */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Total Spent</p>
                <p className="text-lg font-bold text-rose-500 mt-0.5">{formatCurrency(viewingEvent.spent || 0)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Budget Limit</p>
                <p className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
                  {viewingEvent.budget > 0 ? formatCurrency(viewingEvent.budget) : 'No limit'}
                </p>
              </div>
            </div>

            {/* Expenses List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                Logged Expenses ({getEventTransactions(viewingEvent).length})
              </p>

              {getEventTransactions(viewingEvent).length === 0 ? (
                <div className="p-8 text-center text-zinc-400 text-xs">
                  No expenses linked to this event yet. Link transactions via the Transaction form or tag `#${viewingEvent.tag}` in notes!
                </div>
              ) : (
                getEventTransactions(viewingEvent).map(t => {
                  const cat = resolveCategory(t.categoryId, categories, t.note);
                  return (
                    <div 
                      key={t.id}
                      className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs shrink-0"
                          style={{ backgroundColor: cat?.color || '#71717a' }}
                        >
                          <FontAwesomeIcon icon={getCategoryIcon(cat?.icon)} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-900 dark:text-white">{t.note || cat?.name || 'Expense'}</p>
                          <p className="text-[10px] text-zinc-400">{formatDisplayDate(t.date)}</p>
                        </div>
                      </div>

                      <p className="text-xs font-bold text-rose-500 shrink-0">
                        -{formatCurrency(t.amount)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: '' })}
        onConfirm={handleConfirmDelete}
        title="Delete Trip / Event"
        message={`Are you sure you want to delete "${deleteConfirm.name}"? Past transactions tagged with this event will still be preserved.`}
        confirmText="Delete Event"
        isDanger={true}
      />
    </div>
  );
};

export default Events;
