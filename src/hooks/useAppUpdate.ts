import { useState, useEffect } from 'react';

export const useAppUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let initialVersion: number | null = null;

    const checkUpdate = async () => {
      try {
        const res = await fetch('/version.json?' + new Date().getTime(), { cache: 'no-store' });
        if (!res.ok) return;
        
        const text = await res.text();
        if (!text || text.trim().startsWith('<')) {
          return;
        }

        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          return;
        }
        
        if (initialVersion === null) {
          initialVersion = data.version;
        } else if (data.version && data.version !== initialVersion) {
          setUpdateAvailable(true);
        }
      } catch (err) {
        // Only log actual network failures
      }
    };

    // First check
    checkUpdate();

    // Check frequently since user requested it to show up quickly (e.g. 10s)
    const interval = setInterval(checkUpdate, 10000); 
    
    const onFocus = () => checkUpdate();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return updateAvailable;
};
