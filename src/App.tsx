import { TabBar } from './components/TabBar';
import { UpdateBanner } from './components/UpdateBanner';
import { useTab } from './lib/route';
import { Home } from './screens/Home';
import { Placeholder } from './screens/Placeholder';

export function App() {
  const tab = useTab();
  return (
    <div className="app">
      {tab === 'home' && <Home />}
      {tab === 'history' && <Placeholder title="History" milestone="M3" />}
      {tab === 'exercises' && <Placeholder title="Exercises" milestone="M3" />}
      {tab === 'body' && <Placeholder title="Body" milestone="M4" />}
      <UpdateBanner />
      <TabBar current={tab} />
    </div>
  );
}
