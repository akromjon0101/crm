import { useState, useCallback } from 'react';

/**
 * Toast notification hook.
 *
 * @returns {{ toast, showToast, clearToast }}
 *
 * Usage:
 *   const { toast, showToast, clearToast } = useToast();
 *   showToast('Saved!');
 *   showToast('Something went wrong', 'error');
 *   showToast('Please note this', 'info');
 *
 *   // Render with <Toast {...toast} onClose={clearToast} />
 */
const useToast = () => {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  return { toast, showToast, clearToast };
};

export default useToast;
