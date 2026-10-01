import { useEffect } from 'react';
import { TabBar } from './components/TabBar';
import { UpdateBanner } from './components/UpdateBanner';
import { useOpenSession, useSettings } from './data/hooks';
import { useNow } from './lib/clock';
import { setVibrationEnabled } from './lib/device';
import { formatClock } from './lib/format';
import { navigate, useRoute } from './lib/route';
import { Body, MetricDetail } from './screens/Body';
import { ExerciseDetail } from './screens/ExerciseDetail';
import { ExerciseEdit } from './screens/ExerciseEdit';
import { Exercises } from './screens/Exercises';
import { History } from './screens/History';
import { Home } from './screens/Home';
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
    case 'session':
      body = <Workout key={route.id} editId={route.id} />;
      break;
    case 'exercise':
      body = <ExerciseDetail key={route.id} id={route.id} />;
      break;
    case 'metric':
      body = <MetricDetail key={route.key} metric={route.key} />;
      break;
    case 'exerciseEdit':
      body = <ExerciseEdit key={route.id ?? 'new'} id={route.id} />;
      break;
    case 'tab':
      body =
        route.tab === 'home' ? (
          <Home />
        ) : route.tab === 'history' ? (
          <History />
        ) : route.tab === 'exercises' ? (
          <Exercises />
        ) : (
          <Body />
        );
  }

  // Tab screens and exercise pages (a sub-page of Exercises) keep the tab bar.
  const tabBar =
    route.view === 'tab' ? route.tab : route.view === 'exercise' ? 'exercises' : route.view === 'metric' ? 'body' : null;

  return (
    <div className="app">
      {body}
      <UpdateBanner />
      {tabBar && open && !(route.view === 'tab' && route.tab === 'home') && <ResumeBar startedAt={open.startedAt} />}
      {tabBar && <TabBar current={tabBar} />}
    </div>
  );
}
