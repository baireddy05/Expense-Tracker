/**
 * Date utilities to ensure consistent local timezone date formatting
 * and avoid UTC day-shift bugs (especially around midnight in timezones like IST).
 */

export const getLocalDateString = (date = new Date()) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (dateStr) => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

export const formatDisplayDate = (dateStr, options = { day: '2-digit', month: 'short', year: 'numeric' }) => {
  if (!dateStr) return '';
  try {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString('en-GB', options);
  } catch {
    return dateStr;
  }
};

export const calculateNextDueDate = (currentDueDateStr, frequency = 'monthly') => {
  const d = parseLocalDate(currentDueDateStr);
  
  if (frequency === 'daily') {
    d.setDate(d.getDate() + 1);
  } else if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else if (frequency === 'monthly') {
    d.setMonth(d.getMonth() + 1);
  } else if (frequency === 'yearly') {
    d.setFullYear(d.getFullYear() + 1);
  }
  
  return getLocalDateString(d);
};
