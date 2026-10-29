import React, { useRef, useEffect } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faEdit } from '@fortawesome/free-solid-svg-icons';
import { haptics } from '../../utils/haptics';

const SwipeableItem = ({ children, onEdit, onDelete, resetToken }) => {
  const containerRef = useRef(null);
  const controls = useAnimation();
  const x = useMotionValue(0);
  const isDraggingRef = useRef(false);

  // Reset to original position when resetToken changes
  useEffect(() => {
    controls.start({ x: 0, transition: { type: 'spring', bounce: 0.5 } });
  }, [resetToken, controls]);

  // Thresholds for triggering actions
  const actionThreshold = 80;

  // Background colors based on drag position
  const backgroundColor = useTransform(
    x,
    [-actionThreshold, 0, actionThreshold],
    ['#ef4444', '#f3f4f6', '#3b82f6'] // Red for delete, default, Blue for edit
  );

  const opacity = useTransform(x, [-actionThreshold, 0, actionThreshold], [1, 0, 1]);

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDragEnd = (event, info) => {
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 120);

    const offset = info.offset.x;
    const velocity = info.velocity.x;

    const isDelete = offset < -75 || (offset < -45 && velocity < -400);
    const isEdit = offset > 75 || (offset > 45 && velocity > 400);

    // Swipe left (delete)
    if (isDelete) {
      haptics.heavy();
      controls.start({ x: -100, transition: { duration: 0.2 } });
      onDelete?.();
    } 
    // Swipe right (edit)
    else if (isEdit) {
      haptics.medium();
      controls.start({ x: 0, transition: { duration: 0.2 } });
      onEdit?.();
    } 
    // Snap back cleanly when swipe cancelled or halfway
    else {
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } });
    }
  };

  const handleItemClick = (e) => {
    if (isDraggingRef.current) return;
    const target = e.target;
    // Don't intercept if user tapped an explicit action button
    if (target.closest('button, a, input, select')) return;
    onEdit?.();
  };

  return (
    <div className="group relative w-full overflow-hidden rounded-xl mb-3 select-none" ref={containerRef}>
      {/* Background Action Indicators for Swipe Gestures */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none"
        style={{ backgroundColor, opacity }}
      >
        <div className="flex items-center gap-2 text-white font-medium">
          <FontAwesomeIcon icon={faEdit} />
          <span>Edit</span>
        </div>
        <div className="flex items-center gap-2 text-white font-medium">
          <span>Delete</span>
          <FontAwesomeIcon icon={faTrash} />
        </div>
      </motion.div>

      {/* Draggable Foreground Element */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        onClick={handleItemClick}
        className="relative z-10 w-full bg-white dark:bg-zinc-900 shadow-sm rounded-xl touch-pan-y cursor-pointer"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default SwipeableItem;
