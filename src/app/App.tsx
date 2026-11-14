// Written with AI assistance (Codex). Owner: Alex. RAW v0.1 desktop composition.
import { useEffect, useRef, useState } from 'react';
import { HelmetHud } from '../ui/HelmetHud';
import { createEngine, type Engine } from '../core/engine';
import { routeLabel, type DeepReadonly, type EngineSnapshot } from '../core/contracts';
import { loadDemoWorld } from '../adapters/world';
import { mountScene } from '../adapters/scene';
import { toHelmetHud } from '../adapters/hud';
import { createFixedClock } from '../adapters/clock';
import './App.css';
export function App() {
  const host = useRef<HTMLDivElement>(null), engineRef = useRef<Engine | null>(null);
  const [snapshot,setSnapshot] = useState<DeepReadonly<EngineSnapshot> | null>(null);
  const [error,setError] = useState<string | null>(null), [attempt,setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); let cleanup = () => {};
    setSnapshot(null); setError(null);
    loadDemoWorld(abort.signal).then(world => {
      if (abort.signal.aborted || !host.current) return;
      const engine = createEngine(world.region,world.mission,p => world.heights.heightAt(p.x,p.z) !== null);
      engineRef.current=engine;
      let scene: ReturnType<typeof mountScene>;
      try { scene=mountScene(host.current,engine,world.heights); }
      catch (failure) { engine.dispose(); engineRef.current=null; throw failure; }
      const clock = createFixedClock(engine);
      setSnapshot(engine.getSnapshot());
      // HUD state is sampled at 10 Hz; authoritative engine runs at fixed 60 Hz.
      const timer = window.setInterval(() => { scene.input.update(); clock.tick(performance.now()/1000); }, 1000/60);
      const hudTimer = window.setInterval(() => setSnapshot(engine.getSnapshot()),100);
      cleanup = () => { clearInterval(timer); clearInterval(hudTimer); clock.dispose(); scene.dispose(); engine.dispose(); engineRef.current=null; };
    }).catch(failure => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : String(failure)); });
    return () => { abort.abort(); cleanup(); };
  }, [attempt]);
  const dispatch = (type: 'pause' | 'resume' | 'reset') => { engineRef.current?.dispatch({ type }); if (engineRef.current) setSnapshot(engineRef.current.getSnapshot()); };
  const p = snapshot?.player.position;
  const nearest = snapshot && [...snapshot.mission.tasks].sort((a,b) => Math.hypot(a.position.x-snapshot.player.position.x,a.position.z-snapshot.player.position.z)-Math.hypot(b.position.x-snapshot.player.position.x,b.position.z-snapshot.player.position.z))[0];
  const near = nearest && p && Math.hypot(nearest.position.x-p.x,nearest.position.z-p.z) <= 5;
  return <main className="raw-app">
    <div ref={host} className="raw-scene" aria-label="Jezero 4m terrain scene" />
    {snapshot && <HelmetHud {...toHelmetHud(snapshot)} />}
    <section className="raw-controls" aria-label="Demo controls">
      <strong>RAW v0.1 · {snapshot ? routeLabel(snapshot.mission.route.source) : 'DEMO route'}</strong>
      <div>Click terrain to look · WASD · Shift run · Esc release</div>
      <div>DEMO movement · O₂ / temperature UNKNOWN</div>
      <button disabled={!snapshot} onClick={() => dispatch(snapshot?.paused ? 'resume' : 'pause')}>{snapshot?.paused ? 'Resume' : 'Pause'}</button>
      <button disabled={!snapshot} onClick={() => dispatch('reset')}>Reset</button>
      <a href="#preview">Visual preview</a>
      {snapshot && <>
        <div>Clock {snapshot.simTimeSeconds.toFixed(1)} s · {snapshot.paused ? 'PAUSED' : snapshot.player.movementMode}</div>
        <div>{snapshot.region.id} · {snapshot.region.frameId}</div>
        <div>X {p!.x.toFixed(1)} m · Z {p!.z.toFixed(1)} m</div>
        <div>Home (blue): {snapshot.mission.shuttle.x}, {snapshot.mission.shuttle.z}</div>
        {snapshot.mission.tasks.map(t => <div key={t.id}>{t.type} ({t.position.x}, {t.position.z}) · {t.status}</div>)}
        <div>{snapshot.mission.tasks.filter(t => t.status === 'complete').length}/2 demo objectives · load OK</div>
        <button disabled={!near || snapshot.paused || nearest?.status === 'complete'} onClick={() => { if (nearest) engineRef.current?.dispatch({ type: nearest.status === 'active' ? 'task-finish' : 'task-start', siteId: nearest.id }); }}> {nearest?.status === 'active' ? 'Finish demo task' : 'Start demo task'} (within 5 m)</button>
        <div>Task buttons send semantic demo signals; no science mechanics.</div>
      </>}
      {!snapshot && !error && <p role="status">Loading local Jezero terrain…</p>}
      {error && <p role="alert">Terrain load error: {error} <button onClick={() => setAttempt(v=>v+1)}>Retry</button></p>}
    </section>
  </main>;
}
