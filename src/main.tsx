// Written with AI assistance (Claude).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applyPaletteToCss } from './ui/palette';

applyPaletteToCss();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
