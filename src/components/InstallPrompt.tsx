import { useEffect, useState, type ReactNode } from 'react';
import { dismissInstallPrompt, installPlatform, promptInstall, useInstallState } from '../lib/install';

// First visit in a browser tab: a full-screen "install the app" screen, so nobody has to find the
// browser's menu. Never shown inside the installed app. "Use in browser instead" hides it for good;
// the Install card on Home stays as a fallback.

/** How long to wait for the browser's install event before showing manual steps instead. */
const WAIT_MS = 3500;

/** Safari's share icon: a box with an arrow out of the top. */
function ShareIcon() {
  return (
    <svg className="install-share" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 3v12M8 7l4-4 4 4M7 11H5v10h14V11h-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="install-steps">
      {items.map((s, i) => (
        <li key={i}>
          <span className="install-step-n">{i + 1}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function InstallPrompt({ onClose }: { onClose: () => void }) {
  const state = useInstallState();
  const platform = installPlatform();
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  const skip = () => {
    dismissInstallPrompt();
    onClose();
  };

  let body;
  if (state === 'installed') {
    body = (
      <>
        <p className="install-lead">Installed. Open Monolog from your home screen or app drawer.</p>
        <button className="btn btn-secondary install-btn" onClick={skip}>
          Close
        </button>
      </>
    );
  } else if (state === 'available') {
    body = (
      <button className="btn btn-primary install-btn" onClick={() => void promptInstall()}>
        Install Monolog
      </button>
    );
  } else if (platform === 'ios') {
    body = (
      <Steps
        items={[
          <>
            Tap <b>Share</b> <ShareIcon /> at the bottom of Safari
          </>,
          <>
            Choose <b>Add to Home Screen</b>
          </>,
          <>
            Tap <b>Add</b>
          </>,
        ]}
      />
    );
  } else if (!waited) {
    body = <p className="install-lead">Getting the app ready…</p>;
  } else {
    body = (
      <Steps
        items={[
          <>
            Open your browser's menu (<b>⋮</b> or <b>≡</b>)
          </>,
          <>
            Tap <b>Install app</b> or <b>Add to Home screen</b>
          </>,
          <>Open Monolog from your home screen</>,
        ]}
      />
    );
  }

  return (
    <div className="install-prompt" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <div className="install-hero">
        <img
          src={`${import.meta.env.BASE_URL}pwa-192x192.png`}
          alt=""
          width={96}
          height={96}
          className="install-icon"
        />
        <h1 id="install-title" className="t-title">
          Monolog
        </h1>
        <p className="install-lead">A gym tracker that lives on your phone. Works offline, no account.</p>
      </div>
      <div className="install-actions">
        {body}
        {state !== 'installed' && (
          <button className="install-skip" onClick={skip}>
            Use in browser instead
          </button>
        )}
      </div>
    </div>
  );
}
