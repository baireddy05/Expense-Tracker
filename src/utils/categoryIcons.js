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
const LEND_KEYWORDS = /(lend|varshith|surya|borrow|loan|friend|advance)/i;
const TRAVEL_KEYWORDS = /(uber|ola|auto|petrol|metro|fuel|flight|train|cab|bus|toll)/i;
const ENTERTAINMENT_KEYWORDS = /(movie|game|netflix|spotify|prime|theatre|cinema|hotstar)/i;

export const getCategoryIcon = (iconName) => {
  if (!iconName) return faTag;
  if (typeof iconName === 'object') return iconName;
  return ICON_MAP[iconName] || faTag;
};

/**
 * High-performance Category Resolver:
 * Resolves category by id, category name, or compiled regex keyword inference
 */
export const resolveCategory = (categoryId, categories = [], note = '') => {
  if (!categories || !Array.isArray(categories) || categories.length === 0) {
    return null;
  }

  // 1. Direct ID match (O(1) loop)
  for (let i = 0; i < categories.length; i++) {
    if (categories[i].id === categoryId) return categories[i];
  }

  // 2. Fast Case-Insensitive ID / Name match
  if (categoryId) {
    const searchVal = String(categoryId).trim().toLowerCase();
    for (let i = 0; i < categories.length; i++) {
      const c = categories[i];
      if (c.id?.toLowerCase() === searchVal || c.name?.toLowerCase() === searchVal) {
        return c;
      }
    }
  }

  // 3. High-performance Regex Note Keyword Matching
  if (note) {
    if (FOOD_KEYWORDS.test(note)) {
      const cat = categories.find(c => {
        const n = c.name?.toLowerCase();
        return n === 'food' || n === 'groceries';
      });
      if (cat) return cat;
    }

    if (LEND_KEYWORDS.test(note)) {
      const cat = categories.find(c => {
        const n = c.name?.toLowerCase();
        return n?.includes('lend') || n?.includes('borrow');
      });
      if (cat) return cat;
    }

    if (TRAVEL_KEYWORDS.test(note)) {
      const cat = categories.find(c => c.name?.toLowerCase() === 'travel');
      if (cat) return cat;
    }

    if (ENTERTAINMENT_KEYWORDS.test(note)) {
      const cat = categories.find(c => c.name?.toLowerCase() === 'entertainment');
      if (cat) return cat;
    }
  }

  return null;
};
