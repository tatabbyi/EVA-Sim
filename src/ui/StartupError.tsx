// Written with AI assistance (Claude).
// Owner: Rachel. Instead of a black screen: if the browser can't run the 3D view (WebGL off or blocked, common in
// privacy browsers like LibreWolf), or something crashes while starting, say what happened and how to fix it.

import { Component, type ReactNode } from 'react';

/** Null if WebGL 2 works here, otherwise what's wrong. */
export function webglProblem(): string | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (gl) {
      gl.getExtension('WEBGL_lose_context')?.loseContext(); // give the test context back straight away
      return null;
    }
    return canvas.getContext('webgl')
      ? 'This browser only offers WebGL 1, and the sim needs WebGL 2.'
      : 'WebGL (the browser’s 3D graphics) is turned off or blocked in this browser.';
  } catch (error) {
    return `WebGL could not start: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const box: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: '#060b12',
  color: '#e6f7ff',
  font: '15px/1.55 Inter, system-ui, sans-serif',
  zIndex: 1000,
};
const card: React.CSSProperties = { maxWidth: 640, border: '1px solid #6fe3ff55', borderRadius: 10, padding: '24px 28px', background: '#0b1620' };
const code: React.CSSProperties = { background: '#ffffff14', padding: '1px 6px', borderRadius: 4, fontFamily: 'ui-monospace, monospace' };

function FixSteps() {
  return (
    <ol style={{ paddingLeft: 20, margin: '12px 0' }}>
      <li>
        <b>LibreWolf / Firefox:</b> open <span style={code}>about:config</span>, search <span style={code}>webgl.disabled</span> and set it to{' '}
        <span style={code}>false</span>.
      </li>
      <li>
        Open <span style={code}>about:support</span> and look for <b>WebGL 2</b>. If it says blocked or blocklisted, set{' '}
        <span style={code}>webgl.force-enabled</span> to <span style={code}>true</span> in <span style={code}>about:config</span>.
      </li>
      <li>
        If it still fails, LibreWolf’s fingerprinting protection may be limiting it: set{' '}
        <span style={code}>privacy.resistFingerprinting.exemptedDomains</span> to <span style={code}>localhost</span>.
      </li>
      <li>Reload this page. Chrome or Chromium also work with no changes.</li>
    </ol>
  );
}

export function StartupError({ title, detail, webgl }: { title: string; detail: string; webgl: boolean }) {
  return (
    <div style={box} role="alert">
      <div style={card}>
        <h1 style={{ margin: '0 0 8px', fontSize: 20, color: '#6fe3ff', letterSpacing: '0.08em' }}>{title}</h1>
        <p style={{ margin: 0, opacity: 0.85 }}>{detail}</p>
        {webgl && <FixSteps />}
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ marginTop: 8, padding: '8px 16px', borderRadius: 6, border: '1px solid #6fe3ff', background: '#6fe3ff22', color: '#fff', font: 'inherit', cursor: 'pointer' }}
        >
          Reload
        </button>
      </div>
    </div>
  );
}

/** Catches a crash while a page renders or starts, and shows it instead of a black screen. */
export class ErrorScreen extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const webgl = /webgl/i.test(error.message);
    return <StartupError title={webgl ? 'Can’t start the 3D view' : 'Something went wrong'} detail={error.message} webgl={webgl} />;
  }
}
