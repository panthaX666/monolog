import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './lib/install';
import { App } from './App';
import { CrashTest, ErrorBoundary } from './components/ErrorBoundary';
import { getDb } from './data/db';
import { ensureReady } from './data/repo';
import { requestPersistence } from './lib/storage';

// Create the database and seed the exercise library on first run; ask the browser not to evict data.
void ensureReady(getDb());
void requestPersistence();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <CrashTest />
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
