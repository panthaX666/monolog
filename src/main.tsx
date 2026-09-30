import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/base.css';
import './lib/install';
import { App } from './App';
import { getDb } from './data/db';
import { ensureReady } from './data/repo';

// Create the database and seed the exercise library on first run.
void ensureReady(getDb());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
