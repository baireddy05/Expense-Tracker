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
  faCircle
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
  'fa-circle': faCircle
};

export const getCategoryIcon = (iconName) => {
  if (!iconName) return faTag;
  if (typeof iconName === 'object') return iconName;
  return iconMap[iconName] || faTag;
};
