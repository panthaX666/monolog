import { useEffect } from 'react';
import { TabBar } from './components/TabBar';
import { UpdateBanner } from './components/UpdateBanner';
import { useOpenSession, useSettings } from './data/hooks';
import { useNow } from './lib/clock';
import { setVibrationEnabled } from './lib/device';
import { formatClock } from './lib/format';
import { navigate, useRoute } from './lib/route';
import { Home } from './screens/Home';
import { Placeholder } from './screens/Placeholder';
import { Settings } from './screens/Settings';
import { Summary } from './screens/Summary';
import { Workout } from './screens/Workout';

/** "● Resume workout" bar above the tabs while a session is open (SPEC §3). */
function ResumeBar({ startedAt }: { startedAt: string }) {
  const now = useNow(1000);
  return (
    <button className="resume-bar" onClick={() => navigate('#/workout')}>
      ● Resume workout · {formatClock((now - Date.parse(startedAt)) / 1000)}
    </button>
  );
}

export function App() {
  const route = useRoute();
  const settings = useSettings();
  const open = useOpenSession();

  useEffect(() => setVibrationEnabled(settings.vibration), [settings.vibration]);

  let body;
  switch (route.view) {
    case 'workout':
      body = <Workout />;
      break;
    case 'summary':
      body = <Summary sessionId={route.id} />;
      break;
    case 'settings':
      body = <Settings />;
      break;
    case 'tab':
      body =
        route.tab === 'home' ? (
          <Home />
        ) : route.tab === 'history' ? (
          <Placeholder title="History" milestone="M3" />
        ) : route.tab === 'exercises' ? (
          <Placeholder title="Exercises" milestone="M3" />
        ) : (
          <Placeholder title="Body" milestone="M4" />
        );
  }

  return (
    <div className="app">
      {body}
      <UpdateBanner />
      {route.view === 'tab' && open && route.tab !== 'home' && <ResumeBar startedAt={open.startedAt} />}
      {route.view === 'tab' && <TabBar current={route.tab} />}
    </div>
  );
}
