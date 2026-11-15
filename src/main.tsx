// Written with AI assistance (Claude).
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { Preview } from './dev/Preview';
import { applyPaletteToCss } from './ui/palette';
import { ErrorScreen, StartupError, webglProblem } from './ui/StartupError';

applyPaletteToCss();
document.body.style.margin = '0';
document.documentElement.style.background = 'var(--c-space)';

// The normal localhost page and #preview open the same existing local scene.
// Keep the hash listener so older #preview links continue to work.
function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // No 3D graphics in this browser (e.g. WebGL off in LibreWolf): explain how to fix it instead of a black screen.
  const [problem] = useState(webglProblem);
  if (problem) return <StartupError title="Can’t start the 3D view" detail={problem} webgl />;
  // A crash while starting shows what went wrong (keyed by page, so switching pages tries again).
  return <ErrorScreen key={hash}>{hash === '#raw' ? <App /> : <Preview />}</ErrorScreen>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
