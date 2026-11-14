// Written with AI assistance (Claude).
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { Preview } from './dev/Preview';
import { applyPaletteToCss } from './ui/palette';

applyPaletteToCss();
document.body.style.margin = '0';
document.documentElement.style.background = 'var(--c-space)';

// #preview opens Rachel's look preview; everything else goes to the app (Alex).
// Listens for hash changes, so typing #preview into an open tab switches straight away.
function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash === '#preview' ? <Preview /> : <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
