import { 
  faUtensils, 
  faShoppingCart, 
  faHandHoldingDollar, 
  faHandHolding,
  faHandshake,
  faCircleCheck,
  faPlane, 
  faFilm, 
  faNotesMedical, 
  faMoneyBillWave, 
  faMoneyBill,
  faChartLine, 
  faLaptopCode,
  faHome,
  faBolt,
  faTag, 
  faTags, 
  faReceipt, 
  faCar, 
  faHouse, 
  faGift, 
  faGraduationCap,
  faCircle,
  faCoffee,
  faGlassWater,
  faBurger
} from '@fortawesome/free-solid-svg-icons';

const ICON_MAP = {
  'fa-utensils': faUtensils,
  'fa-shopping-cart': faShoppingCart,
  'fa-hand-holding-dollar': faHandHoldingDollar,
  'fa-hand-holding': faHandHolding,
  'fa-handshake': faHandshake,
  'fa-circle-check': faCircleCheck,
  'fa-plane': faPlane,
  'fa-film': faFilm,
  'fa-notes-medical': faNotesMedical,
  'fa-money-bill': faMoneyBill,
  'fa-money-bill-wave': faMoneyBillWave,
  'fa-chart-line': faChartLine,
  'fa-laptop-code': faLaptopCode,
  'fa-home': faHome,
  'fa-house': faHouse,
  'fa-bolt': faBolt,
  'fa-tag': faTag,
  'fa-tags': faTags,
  'fa-receipt': faReceipt,
  'fa-car': faCar,
  'fa-gift': faGift,
  'fa-graduation-cap': faGraduationCap,
  'fa-circle': faCircle,
  'fa-coffee': faCoffee,
  'fa-glass-water': faGlassWater,
  'fa-burger': faBurger
};

const FOOD_KEYWORDS = /\b(coke|tea|chai|samosa|food|lunch|dinner|snack|campa|coffee|burger|pizza|duniya|biryani|hotel|restaurant|bakery)\b/i;
const LEND_KEYWORDS = /\b(lent|lend|borrow|loan|friend|advance|repay|debt)\b/i;
const TRAVEL_KEYWORDS = /\b(uber|ola|auto|petrol|metro|fuel|flight|train|cab|bus|toll)\b/i;
const ENTERTAINMENT_KEYWORDS = /\b(movie|game|netflix|spotify|prime|theatre|cinema|hotstar)\b/i;

export const getCategoryIcon = (iconName) => {
  if (!iconName) return faTag;
  if (typeof iconName === 'object') return iconName;
  return ICON_MAP[iconName] || faTag;
};

// Fast category lookup map cache
let lastCategoriesRef = null;
let categoryIdMap = new Map();
let categoryNameMap = new Map();

const updateCategoryMaps = (categories) => {
  if (categories === lastCategoriesRef) return;
  lastCategoriesRef = categories;
  categoryIdMap = new Map();
  categoryNameMap = new Map();

  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    if (c.id) {
      categoryIdMap.set(c.id, c);
      categoryIdMap.set(c.id.toLowerCase(), c);
    }
    if (c.name) {
      categoryNameMap.set(c.name.toLowerCase(), c);
    }
  }
};

/**
 * High-performance Category Resolver:
 * Resolves category by id, category name, or compiled regex keyword inference in O(1) time
 */
export const resolveCategory = (categoryId, categories = [], note = '') => {
  if (!categories || !Array.isArray(categories) || categories.length === 0) {
    return null;
  }

  updateCategoryMaps(categories);

  // 1. Check note for system-generated / auto-synced lent & borrow transactions first
  if (note) {
    const lowerNote = String(note).trim().toLowerCase();

    // Repaid debt / friend repayment
    if (
      lowerNote.includes('repaid debt') || 
      lowerNote.includes('repaid to') || 
      lowerNote.includes('settled & repaid') || 
      lowerNote.includes('debt repayment') || 
      lowerNote.includes('paid back') ||
      (lowerNote.includes('repay') && (lowerNote.includes('friend') || lowerNote.includes('debt') || lowerNote.includes('borrow')))
    ) {
      const debtCat = categories.find(c => c.name?.toLowerCase() === 'debt repayment') ||
                      categories.find(c => c.name?.toLowerCase().includes('debt repayment')) ||
                      categories.find(c => c.name?.toLowerCase().includes('debt')) ||
                      categories.find(c => c.name?.toLowerCase().includes('repay')) ||
                      { id: 'cat_debt_repayment', name: 'Debt Repayment', color: '#6366f1', icon: 'fa-handshake', type: 'expense' };
      return debtCat;
    }

    // Returned lent money
    if (
      lowerNote.includes('returned by') || 
      lowerNote.includes('settled & returned') || 
      lowerNote.includes('lent returned') ||
      lowerNote.includes('return from') ||
      (lowerNote.includes('returned') && (lowerNote.includes('friend') || lowerNote.includes('lent')))
    ) {
      const retCat = categories.find(c => c.name?.toLowerCase() === 'lent returned') ||
                     categories.find(c => c.name?.toLowerCase().includes('lent returned')) ||
                     categories.find(c => c.name?.toLowerCase().includes('returned')) ||
                     categories.find(c => c.name?.toLowerCase().includes('lent')) ||
                     { id: 'cat_lent_returned', name: 'Lent Returned', color: '#10b981', icon: 'fa-circle-check', type: 'income' };
      return retCat;
    }

    // Lent to friend
    if (lowerNote.includes('lent to') || lowerNote.includes('lent top-up to') || lowerNote.includes('lend to')) {
      const lentCat = categories.find(c => c.name?.toLowerCase() === 'lent money') ||
                      categories.find(c => c.name?.toLowerCase().includes('lent money')) ||
                      categories.find(c => c.name?.toLowerCase().includes('lent') && c.type === 'expense') ||
                      categories.find(c => c.name?.toLowerCase().includes('lend')) ||
                      { id: 'cat_lent_money', name: 'Lent Money', color: '#f59e0b', icon: 'fa-hand-holding-dollar', type: 'expense' };
      return lentCat;
    }

    // Borrowed from friend
    if (lowerNote.includes('borrowed from') || lowerNote.includes('borrowed top-up from') || lowerNote.includes('borrow from')) {
      const borrowCat = categories.find(c => c.name?.toLowerCase() === 'borrowed money') ||
                        categories.find(c => c.name?.toLowerCase().includes('borrowed money')) ||
                        categories.find(c => c.name?.toLowerCase().includes('borrow') && c.type === 'income') ||
                        { id: 'cat_borrowed_money', name: 'Borrowed Money', color: '#06b6d4', icon: 'fa-hand-holding', type: 'income' };
      return borrowCat;
    }
  }

  // 2. Direct O(1) Map lookup by ID
  if (categoryId) {
    const directMatch = categoryIdMap.get(categoryId);
    if (directMatch) return directMatch;

    const lowerMatch = categoryIdMap.get(String(categoryId).trim().toLowerCase());
    if (lowerMatch) return lowerMatch;

    const nameMatch = categoryNameMap.get(String(categoryId).trim().toLowerCase());
    if (nameMatch) return nameMatch;
  }

  // 3. High-performance Regex Note Keyword Matching
  if (note) {
    if (LEND_KEYWORDS.test(note)) {
      for (let i = 0; i < categories.length; i++) {
        const n = categories[i].name?.toLowerCase();
        if (n && (n.includes('lend') || n.includes('lent') || n.includes('borrow') || n.includes('debt'))) return categories[i];
      }
    }

    if (FOOD_KEYWORDS.test(note)) {
      const cat = categoryNameMap.get('food') || categoryNameMap.get('groceries');
      if (cat) return cat;
    }

    if (TRAVEL_KEYWORDS.test(note)) {
      const cat = categoryNameMap.get('travel');
      if (cat) return cat;
    }

    if (ENTERTAINMENT_KEYWORDS.test(note)) {
      const cat = categoryNameMap.get('entertainment');
      if (cat) return cat;
    }
  }

  return null;
};
