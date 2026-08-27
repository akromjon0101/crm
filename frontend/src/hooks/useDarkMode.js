import { useState, useEffect } from 'react';

/**
 * Returns true when the `html` element has the `dark` class.
 * Reacts in real-time to theme toggle via MutationObserver.
 */
const useDarkMode = () => {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
};

export default useDarkMode;
