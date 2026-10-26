/**
 * Authentic NES Ricoh 2A03 APU Synthesizer Engine
 * Faithfully implements the 5 sound channels of the Nintendo Entertainment System:
 * - Pulse 1: 12.5%, 25%, 50%, 75% duty cycles with hardware pitch sweep & envelope
 * - Pulse 2: 12.5%, 25%, 50%, 75% duty cycles with vibrato
 * - Triangle: 4-bit 16-step staircase wave (discrete counter)
 * - Noise: 15-bit Galois LFSR (Mode 0: 32,767 step white noise, Mode 1: 93 step metallic loop)
 * - DMC / SFX: Authentic 8-bit sound effects & drum strikes
 */

export type DutyCycle = '12.5%' | '25%' | '50%' | '75%';
export type ChannelType = 'pulse1' | 'pulse2' | 'triangle' | 'noise' | 'ensemble';
export type NoiseMode = 'long' | 'short'; // long = 32767 steps, short = 93 steps metallic buzz

export type ArpPattern = 'up' | 'down' | 'updown' | 'random' | 'nes_macro';
export type ArpRate = '1/8' | '1/16' | '1/32' | '60Hz_macro';
export type ArpChordScale = 'held' | 'major' | 'minor' | 'dom7' | 'pentatonic' | 'hirajoshi' | 'octaves';

export interface ArpScaleDef {
  id: ArpChordScale;
  label: string;
  intervals: number[];
  desc: string;
}

export const ARP_SCALES: ArpScaleDef[] = [
  { id: 'major', label: 'MAJOR TRIAD', intervals: [0, 4, 7], desc: 'Root · Major 3rd · 5th' },
  { id: 'minor', label: 'MINOR TRIAD', intervals: [0, 3, 7], desc: 'Root · Minor 3rd · 5th' },
  { id: 'dom7', label: 'DOMINANT 7TH', intervals: [0, 4, 7, 10], desc: 'Root · 3rd · 5th · Flat 7th' },
  { id: 'pentatonic', label: 'PENTATONIC MINOR', intervals: [0, 3, 5, 7, 10], desc: 'Classic 8-bit adventure scale' },
  { id: 'hirajoshi', label: 'JAPANESE HIRAJOSHI', intervals: [0, 2, 3, 7, 8], desc: 'Ninja / Samurai 8-bit motif' },
  { id: 'octaves', label: 'OCTAVE BOUNCER', intervals: [0, 12, 24], desc: 'Driving 8-bit disco bass bounce' },
  { id: 'held', label: 'HELD KEYS', intervals: [], desc: 'Cycles only through held keys' },
];

export const ARP_PATTERNS: { id: ArpPattern; label: string; desc: string }[] = [
  { id: 'up', label: 'UP (ASCENDING)', desc: 'Low to high sequence' },
  { id: 'down', label: 'DOWN (DESCENDING)', desc: 'High to low sequence' },
  { id: 'updown', label: 'UP & DOWN (BOUNCE)', desc: 'Ascending then descending' },
  { id: 'random', label: 'RANDOM CHIP SCATTER', desc: 'Randomized note order' },
  { id: 'nes_macro', label: 'NES 60Hz MACRO', desc: 'Authentic 60fps rapid chord flutter' },
];

export const ARP_RATES: { id: ArpRate; label: string; intervalMs: number; desc: string }[] = [
  { id: '1/8', label: '1/8 BEAT', intervalMs: 240, desc: 'Driving, steady rhythm' },
  { id: '1/16', label: '1/16 BEAT', intervalMs: 120, desc: 'Classic 8-bit chiptune pace' },
  { id: '1/32', label: '1/32 SPEED', intervalMs: 60, desc: 'Fast arpeggiated run' },
  { id: '60Hz_macro', label: '60Hz NTSC', intervalMs: 16.66, desc: 'Simulated 3-voice NES hardware chord' },
];

export function getMidiNoteName(midi: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const note = noteNames[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

export function generateArpSequence(
  heldMidis: number[],
  chordScale: ArpChordScale,
  pattern: ArpPattern,
  octaves: number
): number[] {
  if (heldMidis.length === 0) return [];

  let baseNotes: number[] = [];

  if (chordScale === 'held') {
    baseNotes = Array.from(new Set(heldMidis)).sort((a, b) => a - b);
  } else {
    const root = Math.min(...heldMidis);
    const scale = ARP_SCALES.find((s) => s.id === chordScale);
    const intervals = scale ? scale.intervals : [0, 4, 7];
    baseNotes = intervals.map((i) => root + i);
  }

  // Expand across octaves
  const expanded: number[] = [];
  const octCount = Math.max(1, Math.min(3, octaves));
  for (let o = 0; o < octCount; o++) {
    baseNotes.forEach((note) => {
      expanded.push(note + o * 12);
    });
  }

  // Sort ascending first
  expanded.sort((a, b) => a - b);

  // Apply pattern
  switch (pattern) {
    case 'up':
      return expanded;
    case 'down':
      return [...expanded].reverse();
    case 'updown': {
      if (expanded.length <= 2) return expanded;
      const descMiddle = [...expanded].slice(1, -1).reverse();
      return [...expanded, ...descMiddle];
    }
    case 'random':
      return expanded; // Stepper picks random
    case 'nes_macro':
      // Fast 3-note triad flutter
      return expanded.slice(0, 3);
    default:
      return expanded;
  }
}

export interface SynthParams {
  masterVolume: number;
  channel: ChannelType;
  dutyCycle: DutyCycle;
  attack: number; // in seconds
  decay: number; // in seconds
  sustain: number; // 0 to 1
  release: number; // in seconds
  sweepEnabled: boolean;
  sweepDirection: 'up' | 'down';
  sweepAmount: number; // 0 to 10
  sweepTime: number; // in seconds
  // LFO Vibrato Parameters
  vibratoEnabled: boolean; // toggle vibrato LFO
  vibratoIntensity: number; // 0 to 100 pitch modulation intensity / cents
  vibratoRate: number; // Configurable LFO modulation rate in Hz (0.5 to 16.0 Hz)
  vibratoWaveform: 'sine' | 'triangle' | 'square' | 'sawtooth'; // LFO modulation wave shape
  vibratoDepth: number; // backwards compatibility alias for intensity
  noiseMode: NoiseMode;
  noisePitch: number; // 0 to 15 NES noise rate index
  bitcrushEnabled: boolean; // 4-bit DAC quantizer
  echoEnabled: boolean;
  echoTime: number;
  echoFeedback: number;
  // Arpeggiator Configuration:
  arpEnabled: boolean;
  arpPattern: ArpPattern;
  arpRate: ArpRate;
  arpChordScale: ArpChordScale;
  arpOctaves: number; // 1, 2, or 3
  dpadMode: 'standard' | 'arpeggiator'; // whether D-pad controls octave/duty or arp parameters
}

export const DEFAULT_SYNTH_PARAMS: SynthParams = {
  masterVolume: 0.7,
  channel: 'pulse1',
  dutyCycle: '25%',
  attack: 0.005,
  decay: 0.18,
  sustain: 0.35,
  release: 0.15,
  sweepEnabled: false,
  sweepDirection: 'down',
  sweepAmount: 4,
  sweepTime: 0.12,
  // LFO Vibrato Defaults:
  vibratoEnabled: true,
  vibratoIntensity: 20,
  vibratoRate: 5.5,
  vibratoWaveform: 'sine',
  vibratoDepth: 20,
  noiseMode: 'long',
  noisePitch: 8,
  bitcrushEnabled: true,
  echoEnabled: false,
  echoTime: 0.2,
  echoFeedback: 0.3,
  // Arpeggiator Defaults:
  arpEnabled: false,
  arpPattern: 'up',
  arpRate: '1/16',
  arpChordScale: 'major',
  arpOctaves: 2,
  dpadMode: 'standard',
};

export interface ActiveVoice {
  id: string;
  note: string;
  midi: number;
  frequency: number;
  startTime: number;
  stop: () => void;
  updateVibrato?: (rate: number, intensity: number, enabled: boolean, waveform: OscillatorType) => void;
}

class NesAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private bitcrushNode: WaveShaperNode | null = null;
  private delayNode: DelayNode | null = null;
  private feedbackGain: GainNode | null = null;

  // Custom PeriodicWave cache
  private pulseWaves: Map<DutyCycle, PeriodicWave> = new Map();
  private triangleWave: PeriodicWave | null = null;

  // Precomputed LFSR noise buffers
  private noiseLongBuffer: AudioBuffer | null = null;
  private noiseShortBuffer: AudioBuffer | null = null;

  // Active voices tracking
  private activeVoices: Map<number, ActiveVoice> = new Map();
  public params: SynthParams = { ...DEFAULT_SYNTH_PARAMS };

  // Arpeggiator State & Runner
  private arpTimer: number | null = null;
  private arpCurrentIndex: number = 0;
  private arpVoice: ActiveVoice | null = null;
  private heldArpMidis: number[] = [];
  private currentArpSequence: number[] = [];
  private arpStepListeners: Set<(stepIndex: number, midi: number, noteName: string, seq: number[]) => void> = new Set();

  // WAV Recording
  private isRecording: boolean = false;
  private recordedChunks: Float32Array[] = [];
  private recorderScriptNode: ScriptProcessorNode | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  public async initAudio(): Promise<boolean> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: 'interactive' });
      this.buildAudioGraph();
      this.buildWaveforms();
      this.buildNoiseBuffers();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return true;
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  private buildAudioGraph() {
    if (!this.ctx) return;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.params.masterVolume, this.ctx.currentTime);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.65;

    // 4-bit DAC Quantizer (Ricoh 2A03 output is 4-bit, 16 discrete levels)
    this.bitcrushNode = this.ctx.createWaveShaper();
    this.updateBitcrushCurve();

    // Echo / Delay effect for retro cavern acoustics
    this.delayNode = this.ctx.createDelay(1.0);
    this.delayNode.delayTime.setValueAtTime(this.params.echoTime, this.ctx.currentTime);
    this.feedbackGain = this.ctx.createGain();
    this.feedbackGain.gain.setValueAtTime(this.params.echoFeedback, this.ctx.currentTime);

    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);

    // Main graph: voices -> bitcrushNode -> masterGain -> analyser -> destination
    this.bitcrushNode.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Echo routing
    this.masterGain.connect(this.delayNode);
    if (this.params.echoEnabled) {
      this.feedbackGain.connect(this.analyser);
    }
  }

  private updateBitcrushCurve() {
    if (!this.bitcrushNode) return;
    const nSamples = 4096;
    const curve = new Float32Array(nSamples);
    if (this.params.bitcrushEnabled) {
      const levels = 16; // 4-bit DAC = 16 volume steps
      for (let i = 0; i < nSamples; i++) {
        const x = (i * 2) / nSamples - 1;
        // Quantize into 16 steps with soft saturation
        const step = Math.round(x * (levels / 2)) / (levels / 2);
        curve[i] = Math.max(-1, Math.min(1, step));
      }
    } else {
      for (let i = 0; i < nSamples; i++) {
        curve[i] = (i * 2) / nSamples - 1;
      }
    }
    this.bitcrushNode.curve = curve;
  }

  /**
   * Generates genuine bandlimited Fourier coefficients for NES Duty Cycles:
   * 12.5% (1/8), 25% (2/8), 50% (4/8), 75% (6/8)
   */
  private buildWaveforms() {
    if (!this.ctx) return;
    const duties: Record<DutyCycle, number> = {
      '12.5%': 0.125,
      '25%': 0.25,
      '50%': 0.5,
      '75%': 0.75,
    };

    const numHarmonics = 64;
    for (const [dutyKey, d] of Object.entries(duties) as [DutyCycle, number][]) {
      const real = new Float32Array(numHarmonics);
      const imag = new Float32Array(numHarmonics);
      real[0] = 0;
      imag[0] = 0;

      for (let n = 1; n < numHarmonics; n++) {
        // Fourier series for rectangular wave with duty cycle d:
        // b_n = (2 / (n * PI)) * sin(n * PI * d)
        // With appropriate phase shift so fundamental is aligned:
        imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * d) * 2;
      }
      const wave = this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
      this.pulseWaves.set(dutyKey, wave);
    }

    // NES 4-bit 16-step staircase Triangle Wave
    // 32-sample cycle sequence:
    const triangleSteps = [
      15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ];
    const triReal = new Float32Array(numHarmonics);
    const triImag = new Float32Array(numHarmonics);
    // Compute Discrete Fourier Transform of the 32 discrete NES staircase steps:
    const N = triangleSteps.length;
    for (let k = 1; k < Math.min(numHarmonics, N / 2); k++) {
      let r = 0;
      let im = 0;
      for (let n = 0; n < N; n++) {
        // Normalize 0..15 to -1..1
        const val = (triangleSteps[n] / 7.5) - 1.0;
        const angle = (2 * Math.PI * k * n) / N;
        r += val * Math.cos(angle);
        im -= val * Math.sin(angle);
      }
      triReal[k] = r / N;
      triImag[k] = im / N;
    }
    this.triangleWave = this.ctx.createPeriodicWave(triReal, triImag, { disableNormalization: false });
  }

  /**
   * Generates authentic 15-bit Galois LFSR Noise Buffers
   * Mode 0 (Long): 32,767 period pseudo-random sequence
   * Mode 1 (Short): 93 period harsh metallic buzz sequence
   */
  private buildNoiseBuffers() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;

    // 1. Long mode LFSR
    let lfsrLong = 1;
    const longLen = 32767;
    const longBuffer = this.ctx.createBuffer(1, longLen, sampleRate);
    const longData = longBuffer.getChannelData(0);

    for (let i = 0; i < longLen; i++) {
      // Feedback bit: bit 0 ^ bit 1
      const feedback = (lfsrLong & 1) ^ ((lfsrLong >> 1) & 1);
      lfsrLong = (lfsrLong >> 1) | (feedback << 14);
      longData[i] = (lfsrLong & 1) ? 1.0 : -1.0;
    }
    this.noiseLongBuffer = longBuffer;

    // 2. Short mode LFSR (Mode 1 metallic tone)
    let lfsrShort = 1;
    const shortLen = 93;
    const shortBuffer = this.ctx.createBuffer(1, shortLen * 10, sampleRate);
    const shortData = shortBuffer.getChannelData(0);

    for (let i = 0; i < shortLen * 10; i++) {
      // Short mode feedback: bit 0 ^ bit 6
      const feedback = (lfsrShort & 1) ^ ((lfsrShort >> 6) & 1);
      lfsrShort = (lfsrShort >> 1) | (feedback << 14);
      shortData[i] = (lfsrShort & 1) ? 1.0 : -1.0;
    }
    this.noiseShortBuffer = shortBuffer;
  }

  public setMasterVolume(vol: number) {
    this.params.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.params.masterVolume, this.ctx.currentTime);
    }
  }

  public setParams(newParams: Partial<SynthParams>) {
    const prevArpEnabled = this.params.arpEnabled;
    this.params = { ...this.params, ...newParams };
    if ('bitcrushEnabled' in newParams) {
      this.updateBitcrushCurve();
    }
    if (('echoTime' in newParams || 'echoFeedback' in newParams || 'echoEnabled' in newParams) && this.delayNode && this.feedbackGain && this.ctx) {
      this.delayNode.delayTime.setValueAtTime(this.params.echoTime, this.ctx.currentTime);
      this.feedbackGain.gain.setValueAtTime(this.params.echoFeedback, this.ctx.currentTime);
    }
    // Real-time LFO Vibrato modulation update on active voices
    if (
      'vibratoRate' in newParams ||
      'vibratoIntensity' in newParams ||
      'vibratoDepth' in newParams ||
      'vibratoEnabled' in newParams ||
      'vibratoWaveform' in newParams
    ) {
      const rate = this.params.vibratoRate;
      const intensity = 'vibratoIntensity' in newParams
        ? (newParams.vibratoIntensity ?? this.params.vibratoIntensity)
        : (newParams.vibratoDepth ?? this.params.vibratoIntensity);
      this.params.vibratoIntensity = intensity;
      this.params.vibratoDepth = intensity;
      const enabled = this.params.vibratoEnabled;
      const waveform = (this.params.vibratoWaveform || 'sine') as OscillatorType;

      this.activeVoices.forEach((voice) => {
        voice.updateVibrato?.(rate, intensity, enabled, waveform);
      });
    }
    // Arpeggiator reactions
    if ('arpEnabled' in newParams) {
      if (!newParams.arpEnabled) {
        this.stopArpLoop();
      } else {
        this.recalculateAndRunArp();
      }
    } else if (
      this.params.arpEnabled &&
      ('arpRate' in newParams ||
        'arpChordScale' in newParams ||
        'arpPattern' in newParams ||
        'arpOctaves' in newParams)
    ) {
      this.recalculateAndRunArp();
    }
  }

  // --- Arpeggiator Methods ---
  public subscribeArpStep(listener: (stepIndex: number, midi: number, noteName: string, seq: number[]) => void): () => void {
    this.arpStepListeners.add(listener);
    return () => this.arpStepListeners.delete(listener);
  }

  private notifyArpStep(stepIndex: number, midi: number, noteName: string) {
    this.arpStepListeners.forEach((listener) => {
      try {
        listener(stepIndex, midi, noteName, this.currentArpSequence);
      } catch {
        // ignore listener errors
      }
    });
  }

  public updateArpHeldNotes(midis: number[]) {
    this.heldArpMidis = midis;
    if (this.params.arpEnabled) {
      this.recalculateAndRunArp();
    }
  }

  public recalculateAndRunArp() {
    this.currentArpSequence = generateArpSequence(
      this.heldArpMidis,
      this.params.arpChordScale,
      this.params.arpPattern,
      this.params.arpOctaves
    );

    if (this.currentArpSequence.length === 0) {
      this.stopArpLoop();
      return;
    }

    if (!this.arpTimer) {
      this.startArpLoop();
    }
  }

  public startArpLoop() {
    this.stopArpLoop();
    if (!this.params.arpEnabled || this.currentArpSequence.length === 0) return;

    this.initAudio();
    this.arpCurrentIndex = 0;

    const tick = () => {
      if (!this.params.arpEnabled || this.currentArpSequence.length === 0) {
        this.stopArpLoop();
        return;
      }

      if (this.params.arpPattern === 'random') {
        this.arpCurrentIndex = Math.floor(Math.random() * this.currentArpSequence.length);
      } else {
        this.arpCurrentIndex = this.arpCurrentIndex % this.currentArpSequence.length;
      }

      const midi = this.currentArpSequence[this.arpCurrentIndex];
      const noteName = getMidiNoteName(midi);

      // Stop previous voice
      if (this.arpVoice) {
        try {
          this.arpVoice.stop();
        } catch {
          // ignore
        }
        this.arpVoice = null;
      }

      // Play new arpeggiated step
      this.arpVoice = this.noteOn(midi, noteName);

      const rateDef = ARP_RATES.find((r) => r.id === this.params.arpRate) || ARP_RATES[1];
      const intervalMs = rateDef.intervalMs;

      // Gate cutoff before next step
      const gateTime = Math.max(10, intervalMs * 0.82);
      setTimeout(() => {
        if (this.arpVoice) {
          try {
            this.arpVoice.stop();
          } catch {
            // ignore
          }
          this.arpVoice = null;
        }
      }, gateTime);

      this.notifyArpStep(this.arpCurrentIndex, midi, noteName);

      if (this.params.arpPattern !== 'random') {
        this.arpCurrentIndex = (this.arpCurrentIndex + 1) % this.currentArpSequence.length;
      }

      const nextRate = ARP_RATES.find((r) => r.id === this.params.arpRate) || ARP_RATES[1];
      this.arpTimer = window.setTimeout(tick, nextRate.intervalMs);
    };

    tick();
  }

  public stopArpLoop() {
    if (this.arpTimer) {
      clearTimeout(this.arpTimer);
      this.arpTimer = null;
    }
    if (this.arpVoice) {
      try {
        this.arpVoice.stop();
      } catch {
        // ignore
      }
      this.arpVoice = null;
    }
    this.notifyArpStep(-1, 0, '');
  }

  public getCurrentArpSequence(): number[] {
    return this.currentArpSequence;
  }

  // --- Gamepad Directional Pad Cycling Controls ---
  public cycleArpRate(delta: number): ArpRate {
    const idx = ARP_RATES.findIndex((r) => r.id === this.params.arpRate);
    const nextIdx = Math.max(0, Math.min(ARP_RATES.length - 1, idx + delta));
    const nextRate = ARP_RATES[nextIdx].id;
    this.setParams({ arpRate: nextRate });
    return nextRate;
  }

  public cycleArpScale(delta: number): ArpChordScale {
    const idx = ARP_SCALES.findIndex((s) => s.id === this.params.arpChordScale);
    const nextIdx = (idx + delta + ARP_SCALES.length) % ARP_SCALES.length;
    const nextScale = ARP_SCALES[nextIdx].id;
    this.setParams({ arpChordScale: nextScale });
    return nextScale;
  }

  public cycleArpPattern(delta: number): ArpPattern {
    const idx = ARP_PATTERNS.findIndex((p) => p.id === this.params.arpPattern);
    const nextIdx = (idx + delta + ARP_PATTERNS.length) % ARP_PATTERNS.length;
    const nextPattern = ARP_PATTERNS[nextIdx].id;
    this.setParams({ arpPattern: nextPattern });
    return nextPattern;
  }

  public cycleArpOctaves(delta: number): number {
    const nextOct = Math.max(1, Math.min(3, this.params.arpOctaves + delta));
    this.setParams({ arpOctaves: nextOct });
    return nextOct;
  }

  /**
   * Triggers a note on the keyboard or gamepad
   */
  public noteOn(midi: number, noteName: string, channelOverride?: ChannelType): ActiveVoice | null {
    if (!this.ctx) this.initAudio();
    if (!this.ctx || !this.bitcrushNode) return null;

    // Release existing note if already active on this MIDI number
    if (this.activeVoices.has(midi)) {
      this.noteOff(midi);
    }

    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const now = this.ctx.currentTime;
    const channel = channelOverride || this.params.channel;

    // Envelope gain
    const envGain = this.ctx.createGain();
    envGain.gain.setValueAtTime(0.0001, now);
    // Attack
    envGain.gain.linearRampToValueAtTime(0.85, now + Math.max(0.002, this.params.attack));
    // Decay to sustain
    envGain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, this.params.sustain * 0.85),
      now + this.params.attack + Math.max(0.01, this.params.decay)
    );

    let sourceNode: AudioNode;
    let stopFn: () => void;
    let updateVibratoFn: ((rate: number, intensity: number, enabled: boolean, waveform: OscillatorType) => void) | undefined = undefined;

    if (channel === 'noise') {
      // NES Noise Channel
      const noiseSource = this.ctx.createBufferSource();
      const buffer = this.params.noiseMode === 'short' ? this.noiseShortBuffer : this.noiseLongBuffer;
      if (buffer) {
        noiseSource.buffer = buffer;
        noiseSource.loop = true;
        // Map pitch to playbackRate
        const playbackRate = Math.max(0.05, Math.min(4.0, freq / 261.63));
        noiseSource.playbackRate.setValueAtTime(playbackRate, now);
      }
      noiseSource.connect(envGain);
      noiseSource.start(now);
      sourceNode = noiseSource;

      stopFn = () => {
        const releaseTime = now + this.params.release;
        if (this.ctx) {
          envGain.gain.cancelScheduledValues(this.ctx.currentTime);
          envGain.gain.setValueAtTime(envGain.gain.value, this.ctx.currentTime);
          envGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + this.params.release);
          setTimeout(() => {
            try {
              noiseSource.stop();
              noiseSource.disconnect();
              envGain.disconnect();
            } catch {
              // ignore already stopped
            }
          }, (this.params.release + 0.05) * 1000);
        }
      };
    } else {
      // Pulse 1, Pulse 2, or Triangle
      const osc = this.ctx.createOscillator();

      if (channel === 'triangle' && this.triangleWave) {
        osc.setPeriodicWave(this.triangleWave);
      } else {
        const wave = this.pulseWaves.get(this.params.dutyCycle) || this.pulseWaves.get('25%')!;
        osc.setPeriodicWave(wave);
      }

      osc.frequency.setValueAtTime(freq, now);

      // Hardware Sweep Unit emulation
      if (this.params.sweepEnabled) {
        const sweepMult = this.params.sweepDirection === 'up'
          ? (1 + this.params.sweepAmount * 0.35)
          : (1 / (1 + this.params.sweepAmount * 0.35));
        const targetFreq = Math.max(20, Math.min(10000, freq * sweepMult));
        osc.frequency.exponentialRampToValueAtTime(targetFreq, now + this.params.sweepTime);
      }

      // LFO-Based Vibrato Pitch Modulator
      let lfoOsc: OscillatorNode | null = null;
      let lfoGain: GainNode | null = null;

      const currentIntensity = this.params.vibratoIntensity ?? this.params.vibratoDepth ?? 20;
      const isVibratoActive = this.params.vibratoEnabled && currentIntensity > 0;

      lfoOsc = this.ctx.createOscillator();
      lfoGain = this.ctx.createGain();
      lfoOsc.type = (this.params.vibratoWaveform || 'sine') as OscillatorType;
      lfoOsc.frequency.setValueAtTime(Math.max(0.1, this.params.vibratoRate), now);
      // Intensity modulates detune in cents (100 cents = 1 semitone pitch variation)
      lfoGain.gain.setValueAtTime(isVibratoActive ? currentIntensity : 0, now);

      lfoOsc.connect(lfoGain);
      lfoGain.connect(osc.detune);
      lfoOsc.start(now);

      updateVibratoFn = (rate: number, intensity: number, enabled: boolean, waveform: OscillatorType) => {
        if (!this.ctx || !lfoOsc || !lfoGain) return;
        const curTime = this.ctx.currentTime;
        try {
          lfoOsc.frequency.setValueAtTime(Math.max(0.1, rate), curTime);
          lfoOsc.type = waveform;
          const targetGain = enabled ? Math.max(0, intensity) : 0;
          lfoGain.gain.setValueAtTime(targetGain, curTime);
        } catch {
          // ignore
        }
      };

      osc.connect(envGain);
      osc.start(now);
      sourceNode = osc;

      stopFn = () => {
        if (!this.ctx) return;
        const stopTime = this.ctx.currentTime;
        envGain.gain.cancelScheduledValues(stopTime);
        envGain.gain.setValueAtTime(Math.max(0.0001, envGain.gain.value), stopTime);
        envGain.gain.exponentialRampToValueAtTime(0.0001, stopTime + Math.max(0.01, this.params.release));
        setTimeout(() => {
          try {
            osc.stop();
            osc.disconnect();
            if (lfoOsc) {
              lfoOsc.stop();
              lfoOsc.disconnect();
            }
            if (lfoGain) lfoGain.disconnect();
            envGain.disconnect();
          } catch {
            // ignore
          }
        }, (this.params.release + 0.05) * 1000);
      };
    }

    envGain.connect(this.bitcrushNode);

    const activeVoice: ActiveVoice = {
      id: `${midi}-${Date.now()}`,
      note: noteName,
      midi,
      frequency: freq,
      startTime: now,
      stop: stopFn,
      updateVibrato: updateVibratoFn,
    };

    this.activeVoices.set(midi, activeVoice);
    return activeVoice;
  }

  public noteOff(midi: number) {
    const voice = this.activeVoices.get(midi);
    if (voice) {
      voice.stop();
      this.activeVoices.delete(midi);
    }
  }

  public stopAllNotes() {
    this.activeVoices.forEach(voice => voice.stop());
    this.activeVoices.clear();
  }

  /**
   * Classic Iconic NES 8-Bit Sound Effects Generator
   */
  public playSoundEffect(name: 'coin' | 'jump' | 'laser' | 'powerup' | 'explosion' | 'hurt' | 'oneup' | 'warp') {
    if (!this.ctx) this.initAudio();
    if (!this.ctx || !this.bitcrushNode) return;
    const now = this.ctx.currentTime;

    switch (name) {
      case 'coin': {
        // Classic Mario coin: Two fast 12.5% square notes (B5 -> E6)
        const osc = this.ctx.createOscillator();
        const wave = this.pulseWaves.get('12.5%') || this.pulseWaves.get('25%')!;
        osc.setPeriodicWave(wave);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.setValueAtTime(0.7, now + 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        osc.frequency.setValueAtTime(987.77, now); // B5
        osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

        osc.connect(gain);
        gain.connect(this.bitcrushNode);

        osc.start(now);
        osc.stop(now + 0.4);
        break;
      }

      case 'jump': {
        // Mario jump: 25% duty pulse with fast pitch slide up 140Hz to 620Hz
        const osc = this.ctx.createOscillator();
        const wave = this.pulseWaves.get('25%')!;
        osc.setPeriodicWave(wave);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.75, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.18);

        osc.connect(gain);
        gain.connect(this.bitcrushNode);

        osc.start(now);
        osc.stop(now + 0.22);
        break;
      }

      case 'laser': {
        // Mega Man laser blast: 12.5% sharp sweep down 1200Hz to 80Hz
        const osc = this.ctx.createOscillator();
        const wave = this.pulseWaves.get('12.5%')!;
        osc.setPeriodicWave(wave);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.85, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.frequency.setValueAtTime(1300, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.16);

        osc.connect(gain);
        gain.connect(this.bitcrushNode);

        osc.start(now);
        osc.stop(now + 0.18);
        break;
      }

      case 'powerup': {
        // Power-up chirp: Rapid 6-note arpeggio (G4, B4, D5, G5, B5, D6)
        const notes = [392, 493.88, 587.33, 783.99, 987.77, 1174.66];
        const step = 0.045;
        notes.forEach((freq, idx) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const wave = this.pulseWaves.get('50%')!;
          osc.setPeriodicWave(wave);
          osc.frequency.setValueAtTime(freq, now + idx * step);

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.7, now + idx * step);
          gain.gain.exponentialRampToValueAtTime(0.001, now + (idx + 1) * step + (idx === notes.length - 1 ? 0.2 : 0.01));

          osc.connect(gain);
          gain.connect(this.bitcrushNode!);

          osc.start(now + idx * step);
          osc.stop(now + (idx + 1) * step + (idx === notes.length - 1 ? 0.25 : 0.02));
        });
        break;
      }

      case 'explosion': {
        // LFSR noise rumble decaying with pitch drop
        if (!this.noiseLongBuffer) return;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseLongBuffer;
        noise.loop = true;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.9, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        noise.playbackRate.setValueAtTime(0.8, now);
        noise.playbackRate.exponentialRampToValueAtTime(0.12, now + 0.55);

        noise.connect(gain);
        gain.connect(this.bitcrushNode);

        noise.start(now);
        noise.stop(now + 0.6);
        break;
      }

      case 'hurt': {
        // Metallic hit crunch using short LFSR noise
        if (!this.noiseShortBuffer) return;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseShortBuffer;
        noise.loop = true;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.85, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        noise.playbackRate.setValueAtTime(1.5, now);
        noise.playbackRate.exponentialRampToValueAtTime(0.3, now + 0.14);

        noise.connect(gain);
        gain.connect(this.bitcrushNode);

        noise.start(now);
        noise.stop(now + 0.15);
        break;
      }

      case 'oneup': {
        // 1-UP chime: E5, G5, E6, C6, D6, G6
        const freqs = [659.25, 783.99, 1318.51, 1046.50, 1174.66, 1567.98];
        const step = 0.065;
        freqs.forEach((freq, i) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const wave = this.pulseWaves.get('25%')!;
          osc.setPeriodicWave(wave);
          osc.frequency.setValueAtTime(freq, now + i * step);

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.7, now + i * step);
          gain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * step + (i === freqs.length - 1 ? 0.35 : 0.02));

          osc.connect(gain);
          gain.connect(this.bitcrushNode!);

          osc.start(now + i * step);
          osc.stop(now + (i + 1) * step + (i === freqs.length - 1 ? 0.4 : 0.03));
        });
        break;
      }

      case 'warp': {
        // Alien warp wobble
        const osc = this.ctx.createOscillator();
        const wave = this.pulseWaves.get('12.5%')!;
        osc.setPeriodicWave(wave);

        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.setValueAtTime(35, now); // fast vibrato wobble
        lfoGain.gain.setValueAtTime(200, now);

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.4);

        osc.connect(gain);
        gain.connect(this.bitcrushNode);

        lfo.start(now);
        osc.start(now);
        lfo.stop(now + 0.45);
        osc.stop(now + 0.45);
        break;
      }
    }
  }

  /**
   * Start / Stop WAV recording for instant chiptune audio export
   */
  public startRecording() {
    if (!this.ctx || this.isRecording) return;
    this.recordedChunks = [];
    this.isRecording = true;

    // Use ScriptProcessor for zero-dependency uncompressed audio capture
    this.recorderScriptNode = this.ctx.createScriptProcessor(4096, 1, 1);
    this.recorderScriptNode.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const copy = new Float32Array(inputData.length);
      copy.set(inputData);
      this.recordedChunks.push(copy);
    };

    if (this.masterGain) {
      this.masterGain.connect(this.recorderScriptNode);
      this.recorderScriptNode.connect(this.ctx.destination);
    }
  }

  public stopRecordingAndExport(filename: string = 'nes-synthesizer-recording.wav') {
    if (!this.isRecording || !this.ctx) return;
    this.isRecording = false;

    if (this.recorderScriptNode && this.masterGain) {
      this.masterGain.disconnect(this.recorderScriptNode);
      this.recorderScriptNode.disconnect();
      this.recorderScriptNode = null;
    }

    if (this.recordedChunks.length === 0) return;

    // Calculate total samples
    let totalLength = 0;
    for (const chunk of this.recordedChunks) {
      totalLength += chunk.length;
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.recordedChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert to 16-bit PCM WAV Blob
    const sampleRate = this.ctx.sampleRate;
    const wavBlob = this.encodeWAV(merged, sampleRate);

    // Trigger download
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  private encodeWAV(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    this.writeString(view, 8, 'WAVE');

    // FMT sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, 1, true); // NumChannels (1 mono)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
    view.setUint16(34, 16, true); // BitsPerSample

    // Data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Write samples as 16-bit signed PCM
    let index = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      index += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

export const nesSynth = new NesAudioEngine();
