import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useUI } from '../../context/UIContext';

// Hoisted shared currency formatter to prevent object creation per animation frame
const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

const AnimatedCounter = ({ value, isCurrency = true, className = "" }) => {
  const { isPrivacyMode } = useUI();
  const count = useMotionValue(0);
  const [isReady, setIsReady] = useState(false);

  // Format the number based on whether it's currency or not
  const rounded = useTransform(count, (latest) => {
    if (isCurrency) {
      return currencyFormatter.format(latest);
    }
    return Math.round(latest).toString();
  });

  useEffect(() => {
    setIsReady(true);
    const controls = animate(count, value, {
      duration: 1.0,
      ease: "easeOut",
    });

    return () => controls.stop();
  }, [value, count]);

  if (isPrivacyMode) {
    return <span className={className} title="Privacy Mode Enabled">{isCurrency ? '₹••••••' : '••••'}</span>;
  }

  if (!isReady) return <span className={className}>{isCurrency ? '₹0.00' : '0'}</span>;

  return <motion.span className={className}>{rounded}</motion.span>;
};

export default React.memo(AnimatedCounter);
