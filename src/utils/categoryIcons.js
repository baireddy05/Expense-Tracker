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

const ICON_MAP = {
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

const FOOD_KEYWORDS = /(coke|tea|chai|samosa|food|lunch|dinner|snack|campa|coffee|burger|pizza|duniya|biryani|hotel|restaurant|bakery)/i;
const LEND_KEYWORDS = /(lent|lend|varshith|surya|borrow|loan|friend|advance)/i;
const TRAVEL_KEYWORDS = /(uber|ola|auto|petrol|metro|fuel|flight|train|cab|bus|toll)/i;
const ENTERTAINMENT_KEYWORDS = /(movie|game|netflix|spotify|prime|theatre|cinema|hotstar)/i;

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
    if (lowerNote.includes('lent to') || lowerNote.includes('lent top-up to')) {
      const lentCat = categories.find(c => c.name?.toLowerCase().includes('lent money')) ||
                      categories.find(c => c.name?.toLowerCase().includes('lent')) ||
                      categories.find(c => c.name?.toLowerCase().includes('lend'));
      if (lentCat) return lentCat;
    }
    if (lowerNote.includes('returned by') || lowerNote.includes('settled & returned by')) {
      const retCat = categories.find(c => c.name?.toLowerCase().includes('lent returned')) ||
                     categories.find(c => c.name?.toLowerCase().includes('returned')) ||
                     categories.find(c => c.name?.toLowerCase().includes('lent'));
      if (retCat) return retCat;
    }
    if (lowerNote.includes('borrowed from') || lowerNote.includes('borrowed top-up from')) {
      const borrowCat = categories.find(c => c.name?.toLowerCase().includes('borrowed money')) ||
                        categories.find(c => c.name?.toLowerCase().includes('borrow'));
      if (borrowCat) return borrowCat;
    }
    if (lowerNote.includes('repaid debt to') || lowerNote.includes('settled & repaid debt to')) {
      const debtCat = categories.find(c => c.name?.toLowerCase().includes('debt repayment')) ||
                      categories.find(c => c.name?.toLowerCase().includes('debt'));
      if (debtCat) return debtCat;
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
        if (n && (n.includes('lend') || n.includes('lent') || n.includes('borrow'))) return categories[i];
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
