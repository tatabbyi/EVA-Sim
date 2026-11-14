// Written with AI assistance (Claude).
// Owner: Rachel. Desktop helmet HUD, laid out from the whiteboard sketch:
//   visor outline, task counter top-left, DANGER alert top-centre with a confirm box ("Switch waypoint to home").
// Bottom readout strip is a proposal (O2, Leash, odds, comms, time), to be confirmed with the team.
// The VR version will draw the same layout onto a CanvasTexture (Nanda), so keep this layout simple.

import './HelmetHud.css';

export type AlertLevel = 'danger' | 'warning' | 'info';

export interface HudAlert {
  level: AlertLevel;
  title: string; // e.g. "DANGER"
  message: string; // e.g. "Switch waypoint to home"
  actionLabel?: string; // shown next to the confirm box; defaults to the message
  done?: boolean; // ticks the box
  onAction?: () => void;
}

export interface HelmetHudProps {
  tasksDone: number;
  tasksTotal: number;
  alert?: HudAlert | null;
  o2Litres?: number;
  o2Capacity?: number;
  leashMetres?: number | null; // distance left before the Leash line
  survivalPct?: number | null;
  comms?: 'ok' | 'marginal' | 'lost';
  marsTime?: string; // local true solar time, "hh:mm"
  lightDelaySec?: number | null;
  showReadouts?: boolean;
}

// Visor shape in a 1000 x 600 box, stretched to the screen. Arched top, sides narrowing to a curved chin.
const VISOR_PATH = 'M 60 150 Q 500 -30 940 150 L 870 560 Q 500 610 130 560 Z';

function VisorFrame() {
  return (
    <svg className="hud-frame" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id="hud-glass" cx="50%" cy="45%" r="70%">
          <stop offset="70%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
      </defs>
      {/* helmet interior: everything outside the visor */}
      <path d={`M -10 -10 H 1010 V 610 H -10 Z ${VISOR_PATH}`} fillRule="evenodd" className="hud-frame-shell" />
      {/* slight darkening towards the visor edge */}
      <path d={VISOR_PATH} fill="url(#hud-glass)" />
      <path d={VISOR_PATH} className="hud-frame-rim" vectorEffect="non-scaling-stroke" />
      <path d="M 90 165 Q 500 0 910 165" className="hud-frame-glint" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="hud-alert-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5 L23 21.5 H1 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 9 V14.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="18" r="1.3" fill="currentColor" />
    </svg>
  );
}

function AlertBox({ alert }: { alert: HudAlert }) {
  return (
    <div className={`hud-alert hud-alert--${alert.level}`} role="alert">
      <div className="hud-alert-title">
        <WarningIcon />
        <span>{alert.title}</span>
      </div>
      <button
        type="button"
        className="hud-check"
        aria-pressed={alert.done ?? false}
        onClick={alert.onAction}
        disabled={!alert.onAction}
      >
        <span className="hud-check-text">{alert.actionLabel ?? alert.message}</span>
        <span className="hud-check-box" aria-hidden="true">{alert.done ? '✓' : ''}</span>
      </button>
    </div>
  );
}

const fmt = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? '--' : v.toFixed(digits));

export function HelmetHud(props: HelmetHudProps) {
  const { tasksDone, tasksTotal, alert, showReadouts = true } = props;
  const o2Pct = props.o2Litres != null && props.o2Capacity ? (100 * props.o2Litres) / props.o2Capacity : null;

  return (
    <div className="hud">
      <VisorFrame />

      <div className="hud-tasks">
        <span className="hud-tasks-count">
          {tasksDone}/{tasksTotal}
        </span>
        <span className="hud-tasks-label">TASKS</span>
      </div>

      {alert && <AlertBox alert={alert} />}

      {showReadouts && (
        <div className="hud-readouts">
          <div className="hud-readout hud-readout--o2">
            <span className="hud-readout-label">O₂</span>
            <span className="hud-bar" aria-hidden="true">
              <span className="hud-bar-fill" style={{ width: `${Math.max(0, Math.min(100, o2Pct ?? 0))}%` }} />
            </span>
            <span className="hud-readout-value">{fmt(props.o2Litres)} L</span>
          </div>
          <div className="hud-readout">
            <span className="hud-readout-label">LEASH</span>
            <span className="hud-readout-value">{fmt(props.leashMetres)} m</span>
          </div>
          <div className="hud-readout">
            <span className="hud-readout-label">ODDS</span>
            <span className="hud-readout-value">{fmt(props.survivalPct)}%</span>
          </div>
          <div className={`hud-readout hud-comms--${props.comms ?? 'ok'}`}>
            <span className="hud-readout-label">COMMS</span>
            <span className="hud-readout-value">{(props.comms ?? 'ok').toUpperCase()}</span>
          </div>
          <div className="hud-readout">
            <span className="hud-readout-label">LTST</span>
            <span className="hud-readout-value">{props.marsTime ?? '--:--'}</span>
          </div>
          <div className="hud-readout">
            <span className="hud-readout-label">DELAY</span>
            <span className="hud-readout-value">
              {props.lightDelaySec == null ? '--' : `${Math.round(props.lightDelaySec / 60)} min`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
