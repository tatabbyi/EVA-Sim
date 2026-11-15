// Written with AI assistance (Codex). Owner: Alex. RAW v0.1 desktop composition.
import { useEffect, useRef, useState } from 'react';
import { HelmetHud } from '../ui/HelmetHud';
import { MARS_EVA_DEMO_PROFILE } from '../core/physics';
import { createEngine, type Engine } from '../core/engine';
import { routeLabel, type DeepReadonly, type EngineSnapshot } from '../core/contracts';
import { loadDemoWorld } from '../adapters/world';
import { mountScene } from '../adapters/scene';
import { toHelmetHud } from '../adapters/hud';
import { createFixedClock } from '../adapters/clock';
import './App.css';
export function App() {
  const host = useRef<HTMLDivElement>(null), engineRef = useRef<Engine | null>(null);
  const [emergency,setEmergency] = useState(false);
  const [snapshot,setSnapshot] = useState<DeepReadonly<EngineSnapshot> | null>(null);
  const [routeError,setRouteError] = useState<string | null>(null);
  const [error,setError] = useState<string | null>(null), [attempt,setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); let cleanup = () => {};
    setSnapshot(null); setError(null); setRouteError(null);
    loadDemoWorld(abort.signal).then(world => {
      if (abort.signal.aborted || !host.current) return;
      const engine = createEngine(world.region,world.mission,p => world.heights.heightAt(p.x,p.z) !== null,undefined,{
        profile:MARS_EVA_DEMO_PROFILE,heightAt:(x,z)=>world.heights.heightAt(x,z),
        carriedMassKg:0, // explicitly assumed demo load; inventory transitions are deferred
        ...(emergency ? {initialOxygenGrams:2,emergencyTest:true} : {}),
      });
      engineRef.current=engine;
      let scene: ReturnType<typeof mountScene>;
      try { scene=mountScene(host.current,engine,world.heights,setRouteError); }
      catch (failure) { engine.dispose(); engineRef.current=null; throw failure; }
      const clock = createFixedClock(engine);
      setSnapshot(engine.getSnapshot());
      // HUD state is sampled at 10 Hz; authoritative engine runs at fixed 60 Hz.
      const timer = window.setInterval(() => { scene.input.update(); clock.tick(performance.now()/1000); }, 1000/60);
      const hudTimer = window.setInterval(() => setSnapshot(engine.getSnapshot()),100);
      cleanup = () => { clearInterval(timer); clearInterval(hudTimer); clock.dispose(); scene.dispose(); engine.dispose(); engineRef.current=null; };
    }).catch(failure => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : String(failure)); });
    return () => { abort.abort(); cleanup(); };
  }, [attempt,emergency]);
  const dispatch = (type: 'pause' | 'resume' | 'reset') => { engineRef.current?.dispatch({ type }); if (engineRef.current) setSnapshot(engineRef.current.getSnapshot()); };
  const p = snapshot?.player.position, physics=snapshot?.physics, failed=snapshot?.mission.status === 'failed';
  const switchScenario = () => { if (document.pointerLockElement) document.exitPointerLock(); setEmergency(v=>!v); };
  const nearest = snapshot && snapshot.mission.tasks.filter(t => t.status === 'pending' || t.status === 'active').sort((a,b) => Math.hypot(a.position.x-snapshot.player.position.x,a.position.z-snapshot.player.position.z)-Math.hypot(b.position.x-snapshot.player.position.x,b.position.z-snapshot.player.position.z))[0];
  const near = nearest && p && Math.hypot(nearest.position.x-p.x,nearest.position.z-p.z) <= 5;
  return <main className="raw-app">
    <div ref={host} className="raw-scene" aria-label="Jezero 4m terrain scene" />
    {snapshot && <HelmetHud {...toHelmetHud(snapshot)} />}
    <section className="raw-controls" aria-label="Demo controls" style={{maxHeight:'calc(100vh - 24px)',overflowY:'auto'}}>
      <strong>Mars EVA Physics DEMO v0.1 · {routeError ? 'Route unavailable' : snapshot ? routeLabel(snapshot.mission.route.source) : 'DEMO route'}</strong>
      <div>Click terrain to look · WASD · Shift run · Esc release</div>
      <div>Suited EVA · measured suit temperature UNKNOWN · THERMAL ENGINEERING MODEL / NOT NASA-VALIDATED</div>
      <button disabled={!snapshot} onClick={switchScenario}>{emergency ? 'Return to normal O₂ (750 g)' : 'TEST: O₂ EMERGENCY DEMO (2 g / 750 g)'}</button>
      {emergency && <div role="status"><strong>O₂ EMERGENCY DEMO TEST — 2 g starting stock / 750 g capacity. Normal consumption, no time acceleration.</strong></div>}
      {physics && snapshot && <div aria-label="Physics telemetry">
        <div>O₂ {snapshot.resources.oxygenGrams!.toFixed(3)} / {snapshot.resources.oxygenCapacityGrams} g · {physics.oxygenRateGramsPerHour.toFixed(2)} g/h · {physics.oxygenWarning}</div>
        <div>{physics.activity} · {physics.metabolicPowerWatts.toFixed(1)} W total · {(physics.energySpentJ/1000).toFixed(3)} kJ · {physics.speedMetresPerSecond.toFixed(3)} m/s</div>
        <div>Directional slope {physics.currentSlopeDeg === null ? 'NO DATA' : `${physics.currentSlopeDeg.toFixed(2)}°`} · 1 m interpolated probe / 4 m grid</div>
        <div>{physics.totalMassKg.toFixed(1)} kg total · {physics.carriedMassKg.toFixed(1)} kg assumed payload · {physics.weightNewtons.toFixed(2)} N · g {physics.gravityMps2} m/s²</div>
        <div>OUTSIDE / AMBIENT: {physics.ambientTemperatureC} °C · {physics.ambientPressurePa} Pa · {(physics.co2VolumeFraction*100).toFixed(1)}% CO₂ (fixed scenario)</div>
        {snapshot.thermal && <div>MODELED internal suit gas · {toHelmetHud(snapshot).temperature.value} · cooling heat {snapshot.thermal.coolingHeatW.toFixed(1)} W · energy residual {snapshot.thermal.energyBalanceResidualJ.toExponential(2)} J · {snapshot.thermal.scenarioId}</div>}
      </div>}
      {failed && <div role="alert"><strong>MISSION FAILED — oxygen depleted (0 g).</strong> Movement and tasks stopped. Reset restarts this scenario; return to normal O₂ starts a full mission.</div>}
      {routeError && <p role="status">{routeError}</p>}
      <button disabled={!snapshot || failed} onClick={() => dispatch(snapshot?.paused ? 'resume' : 'pause')}>{snapshot?.paused ? 'Resume' : 'Pause'}</button>
      <button disabled={!snapshot} onClick={() => dispatch('reset')}>Reset</button>
      <a href="#preview">Visual preview</a>
      {snapshot && <>
        <div>Clock {snapshot.simTimeSeconds.toFixed(1)} s · {snapshot.paused ? 'PAUSED' : snapshot.player.movementMode}</div>
        <div>{snapshot.region.id} · {snapshot.region.frameId}</div>
        <div>X {p!.x.toFixed(1)} m · Z {p!.z.toFixed(1)} m</div>
        <div>Home (blue): {snapshot.mission.shuttle.x}, {snapshot.mission.shuttle.z}</div>
        {snapshot.mission.tasks.map(t => <div key={t.id}>{t.type} ({t.position.x}, {t.position.z}) · {t.status}</div>)}
        <div>{snapshot.mission.tasks.filter(t => t.status === 'complete').length}/2 demo objectives · load OK</div>
        <button disabled={!near || failed || snapshot.paused || (snapshot.mission.tasks.some(t=>t.status === 'active') && nearest?.status !== 'active')} onClick={() => { if (nearest) engineRef.current?.dispatch({ type: nearest.status === 'active' ? 'task-finish' : 'task-start', siteId: nearest.id }); }}> {nearest?.status === 'active' ? 'Finish demo task' : 'Start demo task'} (within 5 m)</button>
        <div>Active science work is stationary at 350 W total. MOXIE does not refill suit oxygen.</div>
      </>}
      {!snapshot && !error && <p role="status">Loading local Jezero terrain…</p>}
      {error && <p role="alert">Terrain load error: {error} <button onClick={() => setAttempt(v=>v+1)}>Retry</button></p>}
    </section>
  </main>;
}
