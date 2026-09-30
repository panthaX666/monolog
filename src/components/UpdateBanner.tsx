import { useRegisterSW } from 'virtual:pwa-register/react';

const HOURLY = 60 * 60 * 1000;

// Shows "Update ready · Tap to reload" when a new version has been downloaded (SPEC F: updates).
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Check for a new version whenever the app comes back to the foreground, and hourly while open.
      const check = () => {
        if (navigator.onLine) void registration.update();
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, HOURLY);
    },
  });

  if (!needRefresh) return null;
  return (
    <div className="update" role="status">
      <span>Update ready</span>
      <span style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => setNeedRefresh(false)}>Later</button>
        <button className="go" onClick={() => void updateServiceWorker(true)}>
          Tap to reload
        </button>
      </span>
    </div>
  );
}
