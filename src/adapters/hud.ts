// Written with AI assistance (Codex). Rachel's HUD consumes domain facts without source edits.
import type { HelmetHudProps } from '../ui/HelmetHud';
import type { DeepReadonly, EngineSnapshot } from '../core/contracts';
export function toHelmetHud(snapshot: DeepReadonly<EngineSnapshot>): HelmetHudProps {
  const tasks = snapshot.mission.tasks;
  const {oxygenGrams:oxygen,oxygenCapacityGrams:capacity}=snapshot.resources;
  const known=oxygen !== null && capacity !== null && Number.isFinite(oxygen) && Number.isFinite(capacity) && capacity > 0;
  const fraction=known ? Math.max(0,Math.min(1,oxygen/capacity)) : 0;
  const warning=snapshot.physics?.oxygenWarning;
  const alert: HelmetHudProps['alert']=snapshot.mission.status === 'failed'
    ? {level:'danger',title:'MISSION FAILED',message:'Oxygen depleted — 0 g. Reset to restart.'}
    : warning === 'critical' ? {level:'danger',title:'CRITICAL O₂',message:'Critical suit oxygen. Return to shuttle.'}
    : warning === 'low' ? {level:'warning',title:'LOW O₂',message:'Oxygen reserve reached. Return to shuttle.'}
    : snapshot.boundaryWarning ? {level:'warning',title:'DEMO BOUNDARY',message:'Turn back — demo movement stops at the playable edge.'} : null;
  return {
    objectives: { done: tasks.filter(t => t.status === 'complete').length, total: tasks.length, current: tasks.find(t => t.status !== 'complete')?.type ?? 'Demo objectives complete' },
    o2: { label: 'O₂', value:known ? `${(fraction*100).toFixed(2)}%` : 'N/A', fraction, level:warning === 'depleted' || warning === 'critical' ? 'danger' : warning === 'low' ? 'warning' : 'ok' },
    temperature: { label: 'TEMP', value: 'N/A', fraction: 0 },
    alert,
  };
}
