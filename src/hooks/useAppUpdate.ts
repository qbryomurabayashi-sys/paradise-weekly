import { useState, useEffect } from 'react';

export const useAppUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Vite in production serves <script type="module" crossorigin src="/assets/index-HASH.js">
    const currentScripts = Array.from(document.querySelectorAll('script[src]'))
      .map(s => s.getAttribute('src'))
      .filter(src => src?.includes('/assets/index-'));

    if (currentScripts.length === 0) return;

    const currentHash = currentScripts[0];

    const checkUpdate = async () => {
      try {
        const res = await fetch('/?' + new Date().getTime(), { cache: 'no-store' });
        const html = await res.text();
        
        // Find main script tag in fetched html
        const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
        if (match && match[1] !== currentHash) {
          setUpdateAvailable(true);
        }
      } catch (err) {
        console.error("Failed to check for updates", err);
      }
    };

    const interval = setInterval(checkUpdate, 60000); // Check every minute
    
    // Listen for window focus to check immediately
    const onFocus = () => checkUpdate();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return updateAvailable;
};
