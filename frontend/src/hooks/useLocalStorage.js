import { useState, useCallback } from 'react';

/**
 * Persist state to localStorage with the same API as useState.
 *
 * @param {string} key          - localStorage key
 * @param {*}      initialValue - default value if key is absent
 *
 * Usage:
 *   const [theme, setTheme] = useLocalStorage('theme', 'light');
 */
const useLocalStorage = (key, initialValue) => {
  const [stored, setStored] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      const toStore = value instanceof Function ? value(stored) : value;
      setStored(toStore);
      window.localStorage.setItem(key, JSON.stringify(toStore));
    } catch (err) {
      console.error('useLocalStorage write error:', err);
    }
  }, [key, stored]);

  return [stored, setValue];
};

export default useLocalStorage;
