import { 
  faUtensils, 
  faShoppingCart, 
  faHandHoldingDollar, 
  faPlane, 
  faFilm, 
  faNotesMedical, 
  faMoneyBillWave, 
  faChartLine, 
  faTag, 
  faTags, 
  faReceipt, 
  faCar, 
  faHouse, 
  faBolt, 
  faGift, 
  faGraduationCap,
  faCircle,
  faCoffee,
  faGlassWater,
  faBurger
} from '@fortawesome/free-solid-svg-icons';

const iconMap = {
  'fa-utensils': faUtensils,
  'fa-shopping-cart': faShoppingCart,
  'fa-hand-holding-dollar': faHandHoldingDollar,
  'fa-plane': faPlane,
  'fa-film': faFilm,
  'fa-notes-medical': faNotesMedical,
  'fa-money-bill': faMoneyBillWave,
  'fa-money-bill-wave': faMoneyBillWave,
  'fa-chart-line': faChartLine,
  'fa-tag': faTag,
  'fa-tags': faTags,
  'fa-receipt': faReceipt,
  'fa-car': faCar,
  'fa-house': faHouse,
  'fa-bolt': faBolt,
  'fa-gift': faGift,
  'fa-graduation-cap': faGraduationCap,
  'fa-circle': faCircle,
  'fa-coffee': faCoffee,
  'fa-glass-water': faGlassWater,
  'fa-burger': faBurger
};

export const getCategoryIcon = (iconName) => {
  if (!iconName) return faTag;
  if (typeof iconName === 'object') return iconName;
  return iconMap[iconName] || faTag;
};

/**
 * Robust Category Resolver:
 * Resolves category by id, category name, or contextual keyword inference
 */
export const resolveCategory = (categoryId, categories = [], note = '') => {
  if (!categories || !Array.isArray(categories)) {
    return null;
  }

  // 1. Direct ID match
  let found = categories.find(c => c.id === categoryId);
  if (found) return found;

  // 2. Match by categoryId as name (or case-insensitive ID)
  if (categoryId) {
    const searchVal = String(categoryId).trim().toLowerCase();
    found = categories.find(c => 
      c.id?.toLowerCase() === searchVal ||
      c.name?.toLowerCase() === searchVal
    );
    if (found) return found;
  }

  // 3. Fallback inference based on common note contents
  if (note) {
    const noteLower = String(note).toLowerCase();
    
    // Food / Drinks / Dining
    if (
      noteLower.includes('coke') || 
      noteLower.includes('tea') || 
      noteLower.includes('chai') || 
      noteLower.includes('samosa') || 
      noteLower.includes('food') || 
      noteLower.includes('lunch') || 
      noteLower.includes('dinner') || 
      noteLower.includes('snack') || 
      noteLower.includes('campa') ||
      noteLower.includes('coffee') ||
      noteLower.includes('burger') ||
      noteLower.includes('pizza') ||
      noteLower.includes('duniya')
    ) {
      const foodCat = categories.find(c => 
        c.name?.toLowerCase() === 'food' || 
        c.name?.toLowerCase() === 'groceries'
      );
      if (foodCat) return foodCat;
    }

    // Lending / Debts / Transfers
    if (noteLower.includes('lend') || noteLower.includes('varshith') || noteLower.includes('surya') || noteLower.includes('borrow')) {
      const lendCat = categories.find(c => 
        c.name?.toLowerCase().includes('lend') || 
        c.name?.toLowerCase().includes('borrow')
      );
      if (lendCat) return lendCat;
    }

    // Travel
    if (noteLower.includes('uber') || noteLower.includes('ola') || noteLower.includes('auto') || noteLower.includes('petrol') || noteLower.includes('metro') || noteLower.includes('fuel')) {
      const travelCat = categories.find(c => c.name?.toLowerCase() === 'travel');
      if (travelCat) return travelCat;
    }

    // Entertainment / Movies / Games
    if (noteLower.includes('movie') || noteLower.includes('game') || noteLower.includes('netflix') || noteLower.includes('spotify') || noteLower.includes('prime')) {
      const entCat = categories.find(c => c.name?.toLowerCase() === 'entertainment');
      if (entCat) return entCat;
    }
  }

  return null;
};
