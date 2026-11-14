// Written with AI assistance (Claude).
// Owner: Rachel. Sound inside the suit, all synthesised in the browser (no audio files).
// What is accurate: Mars air is about 1% as dense as Earth's, so outside sounds are faint, and high pitches die off
// fast. Perseverance's microphones recorded soft low wind gusts and the SuperCam laser as sharp clicks. Inside a
// pressurised suit you mostly hear your own life support: the fan and air flow, your breathing, valves puffing.
// Drilling and footsteps reach you through the gloves and boots (through your body), so they are muffled and low.
// Browsers only allow sound after a click, so call start() from a click handler.

export interface SuitAudio {
  start(): void;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
  /** Call every frame. effort: 0 resting, 1 walking, 2 running. wind: 0 to 1. */
  update(dt: number, effort: number, wind: number): void;
  /** One exhale (with the small valve puff); the visor fog is timed to this. strength 0 to 1. */
  breath(strength: number): void;
  step(): void;
  land(): void;
  setDrill(on: boolean): void;
  laserShot(): void;
  shutter(): void;
  chime(): void;
  ping(): void;
  warning(): void;
  dispose(): void;
}

export function createSuitAudio(): SuitAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode, noise: AudioBuffer;
  let windGain: GainNode, windFilter: BiquadFilterNode, fanGain: GainNode;
  let drillGain: GainNode | null = null;
  let drillNodes: AudioScheduledSourceNode[] = [];
  let muted = false;
  let gust = 0, gustTarget = 0, gustTimer = 0;

  const noiseSource = () => {
    const s = ctx!.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    return s;
  };
  // A short filtered noise burst with an attack/decay envelope.
  const burst = (type: BiquadFilterType, freq: number, q: number, peak: number, attack: number, decay: number, when = 0) => {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const src = noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random());
    src.stop(t + attack + decay + 0.05);
  };
  const tone = (freq: number, peak: number, attack: number, decay: number, when = 0, type: OscillatorType = 'sine') => {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  };

  return {
    get muted() {
      return muted;
    },
    start() {
      if (ctx) {
        void ctx.resume();
        return;
      }
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      // Suit fan: steady air flow plus a faint motor hum.
      const fan = noiseSource();
      const fanF = ctx.createBiquadFilter();
      fanF.type = 'bandpass';
      fanF.frequency.value = 420;
      fanF.Q.value = 0.6;
      fanGain = ctx.createGain();
      fanGain.gain.value = 0.035;
      fan.connect(fanF).connect(fanGain).connect(master);
      fan.start();
      const hum = ctx.createOscillator();
      hum.frequency.value = 118;
      const humGain = ctx.createGain();
      humGain.gain.value = 0.006;
      hum.connect(humGain).connect(master);
      hum.start();

      // Wind outside: thin-air rumble, low-passed hard, in slow gusts.
      const wind = noiseSource();
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 260;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      wind.connect(windFilter).connect(windGain).connect(master);
      wind.start();
    },
    setMuted(m) {
      muted = m;
      if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
    },
    update(dt, effort, windAmount) {
      if (!ctx) return;
      gustTimer -= dt;
      if (gustTimer <= 0) {
        gustTimer = 1.5 + Math.random() * 4;
        gustTarget = Math.random() ** 2;
      }
      gust += (gustTarget - gust) * Math.min(1, dt * 0.8);
      const t = ctx.currentTime;
      windGain.gain.setTargetAtTime((0.025 + 0.09 * gust) * (0.4 + windAmount), t, 0.3);
      windFilter.frequency.setTargetAtTime(180 + 240 * gust, t, 0.3);
      fanGain.gain.setTargetAtTime(0.03 + 0.012 * effort, t, 0.5); // fan works harder when you do
    },
    breath(strength) {
      // Exhale: soft breathy noise, then the regulator valve's small puff.
      burst('bandpass', 700 + 300 * strength, 0.7, 0.05 + 0.05 * strength, 0.25, 0.9 + 0.4 * strength);
      burst('highpass', 2600, 0.7, 0.018, 0.01, 0.12, 0.5);
    },
    step() {
      // Boot on regolith, heard through the suit: a dull thump and a little crunch.
      burst('lowpass', 220, 0.8, 0.09, 0.005, 0.14);
      burst('bandpass', 1200, 1.2, 0.012, 0.005, 0.06, 0.01);
    },
    land() {
      burst('lowpass', 160, 0.8, 0.22, 0.005, 0.3);
      tone(55, 0.08, 0.005, 0.25);
    },
    setDrill(on) {
      if (!ctx) return;
      const t = ctx.currentTime;
      if (on && !drillGain) {
        // Percussive coring drill felt through the gloves: a low motor buzz chopped by the hammer action.
        drillGain = ctx.createGain();
        drillGain.gain.setValueAtTime(0, t);
        drillGain.gain.linearRampToValueAtTime(muted ? 0 : 0.11, t + 0.4);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 520;
        const motor = ctx.createOscillator();
        motor.type = 'sawtooth';
        motor.frequency.value = 62;
        const chop = ctx.createGain();
        chop.gain.value = 0.5;
        const hammer = ctx.createOscillator();
        hammer.type = 'square';
        hammer.frequency.value = 17;
        const depth = ctx.createGain();
        depth.gain.value = 0.5;
        hammer.connect(depth).connect(chop.gain);
        const grind = noiseSource();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 340;
        bp.Q.value = 1.4;
        const grindGain = ctx.createGain();
        grindGain.gain.value = 0.6;
        motor.connect(chop);
        grind.connect(bp).connect(grindGain).connect(chop);
        chop.connect(lp).connect(drillGain).connect(master);
        motor.start();
        hammer.start();
        grind.start();
        drillNodes = [motor, hammer, grind];
      } else if (!on && drillGain) {
        drillGain.gain.setTargetAtTime(0, t, 0.08);
        for (const n of drillNodes) n.stop(t + 0.5);
        drillNodes = [];
        drillGain = null;
      }
    },
    laserShot() {
      // SuperCam's laser as Perseverance heard it: a sharp click from the spark on the rock.
      burst('highpass', 1800, 0.7, 0.07, 0.001, 0.025);
    },
    shutter() {
      burst('bandpass', 2400, 2, 0.03, 0.002, 0.04);
      burst('bandpass', 1800, 2, 0.025, 0.002, 0.05, 0.07);
    },
    chime() {
      tone(880, 0.035, 0.01, 0.35);
      tone(1320, 0.03, 0.01, 0.5, 0.12);
    },
    ping() {
      tone(1480, 0.02, 0.005, 0.18);
    },
    warning() {
      for (let i = 0; i < 3; i++) {
        tone(740, 0.035, 0.01, 0.16, i * 0.42, 'triangle');
        tone(554, 0.035, 0.01, 0.16, i * 0.42 + 0.2, 'triangle');
      }
    },
    dispose() {
      void ctx?.close();
      ctx = null;
    },
  };
}
