import React, { useRef, useState, useEffect } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faEdit } from '@fortawesome/free-solid-svg-icons';
import { haptics } from '../../utils/haptics';

const SwipeableItem = ({ children, onEdit, onDelete, resetToken }) => {
  const [exitX, setExitX] = useState(0);
  const containerRef = useRef(null);
  const controls = useAnimation();
  const x = useMotionValue(0);

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

  const handleDragEnd = async (event, info) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    // Swipe left (delete)
    if (offset < -actionThreshold || velocity < -500) {
      haptics.heavy();
      await controls.start({ x: -actionThreshold, transition: { type: 'spring', bounce: 0.5 } });
      onDelete();
    } 
    // Swipe right (edit)
    else if (offset > actionThreshold || velocity > 500) {
      haptics.medium();
      // Don't remove from list on edit, just bounce back and trigger callback
      await controls.start({ x: 0, transition: { type: 'spring', bounce: 0.5 } });
      onEdit();
    } 
    // Snap back
    else {
      controls.start({ x: 0, transition: { type: 'spring', bounce: 0.5 } });
    }
  };

  return (
    <div className="relative w-full overflow-hidden rounded-xl mb-3" ref={containerRef}>
      {/* Background Action Indicators */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-between px-6"
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
        dragElastic={0.7}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        className="relative z-10 w-full bg-white dark:bg-gray-900 shadow-sm rounded-xl touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default SwipeableItem;
