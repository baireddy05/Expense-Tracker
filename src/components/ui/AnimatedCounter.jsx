import React, { useEffect, useState, useCallback } from 'react';
import { useMotionValue, useTransform, animate } from 'framer-motion';
import { useUI } from '../../context/UIContext';

// Hoisted shared currency formatter to prevent object creation per animation frame
const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

const AnimatedCounter = ({ value, isCurrency = true, className = "" }) => {
  const { isPrivacyMode } = useUI();
  const count = useMotionValue(0);

  const formatNumber = useCallback((num) => {
    const safeNum = Number.isFinite(num) ? num : 0;
    if (isCurrency) {
      return currencyFormatter.format(safeNum);
    }
    return Math.round(safeNum).toString();
  }, [isCurrency]);

  const [displayValue, setDisplayValue] = useState(() => {
    const num = Number.isFinite(Number(value)) ? Number(value) : 0;
    return formatNumber(num);
  });

  const rounded = useTransform(count, (latest) => {
    return formatNumber(latest);
  });

  useEffect(() => {
    const target = Number.isFinite(Number(value)) ? Number(value) : 0;

    const unsubscribe = rounded.on('change', (latest) => {
      setDisplayValue(latest);
    });

    const controls = animate(count, target, {
      duration: 0.8,
      ease: "easeOut",
      onComplete: () => {
        setDisplayValue(formatNumber(target));
      }
    });

    return () => {
      unsubscribe();
      controls.stop();
    };
  }, [value, count, rounded, formatNumber]);

  if (isPrivacyMode) {
    return <span className={className} title="Privacy Mode Enabled">{isCurrency ? '₹••••••' : '••••'}</span>;
  }

  return <span className={className}>{displayValue}</span>;
};

export default React.memo(AnimatedCounter);
