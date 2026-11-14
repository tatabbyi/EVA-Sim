// Written with AI assistance (Codex). Rachel's HUD consumes domain facts without source edits.
import type { HelmetHudProps } from '../ui/HelmetHud';
import type { DeepReadonly, EngineSnapshot } from '../core/contracts';
export function toHelmetHud(snapshot: DeepReadonly<EngineSnapshot>): HelmetHudProps {
  const tasks = snapshot.mission.tasks;
  return {
    objectives: { done: tasks.filter(t => t.status === 'complete').length, total: tasks.length, current: tasks.find(t => t.status !== 'complete')?.type ?? 'Demo objectives complete' },
    o2: { label: 'O₂', value: 'N/A', fraction: 0 },
    temperature: { label: 'TEMP', value: 'N/A', fraction: 0 },
    alert: snapshot.boundaryWarning ? { level: 'warning', title: 'DEMO BOUNDARY', message: 'Turn back — demo movement stops at the playable edge.' } : null,
  };
}
