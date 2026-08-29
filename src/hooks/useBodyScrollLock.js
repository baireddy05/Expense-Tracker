import { useEffect, useId } from 'react';

// Use a Set of active modal IDs to guarantee 100% reliable lock tracking
const activeLocks = new Set();

export const useBodyScrollLock = (isLocked) => {
  const lockId = useId();

  useEffect(() => {
    if (isLocked) {
      activeLocks.add(lockId);
      document.body.style.overflow = 'hidden';
    } else {
      activeLocks.delete(lockId);
      if (activeLocks.size === 0) {
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
      }
    }

    return () => {
      activeLocks.delete(lockId);
      if (activeLocks.size === 0) {
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
      }
    };
  }, [isLocked, lockId]);
};

export default useBodyScrollLock;
