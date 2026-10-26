import React, { useState, useRef, useEffect } from 'react';
import {
  SynthParams,
  DutyCycle,
  ChannelType,
  ARP_SCALES,
  ARP_PATTERNS,
  ARP_RATES,
  getMidiNoteName,
} from '../audio/nesAudioEngine';
import { SYNTH_PRESETS, SynthPreset } from '../audio/nesPresets';
import { Save, Trash2, Zap, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Activity, Waves } from 'lucide-react';

interface NesSoundPanelProps {
  params: SynthParams;
  onUpdateParams: (newParams: Partial<SynthParams>) => void;
  onLoadPreset: (preset: SynthPreset) => void;
  activeArpStep?: number;
  currentArpSequence?: number[];
  onDpadArpControl?: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

// 60FPS Live Animated Canvas Visualizer for LFO Pitch Modulation
const LfoWaveVisualizer: React.FC<{
  rate: number;
  intensity: number;
  waveform: string;
}> = ({ rate, intensity, waveform }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const render = () => {
      animId = requestAnimationFrame(render);
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Center baseline
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Advance phase proportional to rate (cycles per second)
      phase += (rate * 2 * Math.PI) / 60;

      // Draw LFO Waveform
      const amp = (intensity / 100) * (canvas.height / 2 - 8);
      ctx.strokeStyle = intensity > 0 ? '#38bdf8' : '#475569';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = intensity > 0 ? '#0284c7' : 'transparent';
      ctx.shadowBlur = intensity > 0 ? 8 : 0;
      ctx.beginPath();

      const numPoints = canvas.width;
      for (let x = 0; x < numPoints; x++) {
        const t = (x / numPoints) * 4 * Math.PI + phase;
        let yNorm = 0;

        if (waveform === 'triangle') {
          // Linear triangle wave
          const normPhase = (t / (2 * Math.PI)) % 1;
          yNorm = 4 * Math.abs(normPhase - 0.5) - 1;
        } else if (waveform === 'square') {
          // Bipolar square wave
          yNorm = Math.sin(t) >= 0 ? 1 : -1;
        } else if (waveform === 'sawtooth') {
          // Ramping sawtooth
          const normPhase = (t / (2 * Math.PI)) % 1;
          yNorm = 2 * normPhase - 1;
        } else {
          // Sine wave
          yNorm = Math.sin(t);
        }

        const y = canvas.height / 2 - yNorm * amp;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [rate, intensity, waveform]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={70}
      className="w-full h-[70px] rounded border border-slate-800 block"
    />
  );
};

export const NesSoundPanel: React.FC<NesSoundPanelProps> = ({
  params,
  onUpdateParams,
  onLoadPreset,
  activeArpStep = -1,
  currentArpSequence = [],
  onDpadArpControl,
}) => {
  const [userPresets, setUserPresets] = useState<SynthPreset[]>(() => {
    try {
      const saved = localStorage.getItem('nes_user_presets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newPresetName, setNewPresetName] = useState('');
  const [activeTab, setActiveTab] = useState<'arpeggiator' | 'vibrato' | 'envelope' | 'sweep' | 'effects' | 'presets'>('vibrato');

  const handleSaveUserPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    const newPreset: SynthPreset = {
      id: `user-${Date.now()}`,
      name: newPresetName.trim(),
      category: 'Lead',
      description: 'Custom user patch saved in local storage.',
      params: { ...params },
    };

    const updated = [...userPresets, newPreset];
    setUserPresets(updated);
    try {
      localStorage.setItem('nes_user_presets', JSON.stringify(updated));
    } catch {
      // ignore
    }
    setNewPresetName('');
  };

  const handleDeleteUserPreset = (id: string) => {
    const updated = userPresets.filter((p) => p.id !== id);
    setUserPresets(updated);
    try {
      localStorage.setItem('nes_user_presets', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const dutyCycles: DutyCycle[] = ['12.5%', '25%', '50%', '75%'];
  const channels: { id: ChannelType; label: string; desc: string }[] = [
    { id: 'pulse1', label: 'PULSE 1', desc: 'Square wave with hardware pitch sweep' },
    { id: 'pulse2', label: 'PULSE 2', desc: 'Square wave with vibrato LFO' },
    { id: 'triangle', label: 'TRIANGLE', desc: '4-bit 16-step discrete counter bass' },
    { id: 'noise', label: 'NOISE', desc: '15-bit Galois LFSR shift register' },
  ];

  const currentVibratoIntensity = params.vibratoIntensity ?? params.vibratoDepth ?? 20;

  return (
    <div className="w-full bg-[#161822] rounded-xl border-2 border-[#2b303d] p-4 sm:p-5 shadow-[0_12px_24px_rgba(0,0,0,0.6)]">
      {/* Sound Panel Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-slate-800 text-xs font-retro-mono gap-3">
        <div className="flex items-center gap-2">
          <span className="font-nes text-[10px] text-amber-400">APU SOUND ENGINE PARAMETERS</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-300">RICOH 2A03 SYNTHESIS CONTROLS</span>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-[#0f1118] p-1 rounded-lg border border-slate-800 flex-wrap">
          {(['arpeggiator', 'vibrato', 'envelope', 'sweep', 'effects', 'presets'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded text-[10px] font-retro-mono uppercase cursor-pointer transition-colors ${
                activeTab === tab
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'vibrato' ? '〰 VIBRATO LFO' : tab === 'arpeggiator' ? '⚡ ARPEGGIATOR' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Channel & Duty Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pb-4 border-b border-slate-800/80">
        {/* Active Channel Selector */}
        <div>
          <label className="block text-[10px] font-nes text-slate-300 mb-2">
            ACTIVE APU CHANNEL
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => onUpdateParams({ channel: ch.id })}
                className={`px-2 py-2 rounded text-[10px] font-retro-mono cursor-pointer border text-center transition-all ${
                  params.channel === ch.id
                    ? 'bg-rose-950/60 border-rose-500 text-rose-300 font-bold shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                    : 'bg-[#0e1017] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {/* Duty Cycle Selector (Only for Pulse 1 & Pulse 2) */}
        <div>
          <label className="block text-[10px] font-nes text-slate-300 mb-2">
            PULSE DUTY CYCLE (WAVE SHAPE)
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {dutyCycles.map((duty) => (
              <button
                key={duty}
                onClick={() => onUpdateParams({ dutyCycle: duty })}
                disabled={params.channel === 'triangle' || params.channel === 'noise'}
                className={`px-2 py-2 rounded text-[10px] font-retro-mono cursor-pointer border text-center transition-all ${
                  params.channel === 'triangle' || params.channel === 'noise'
                    ? 'opacity-40 cursor-not-allowed bg-[#0e1017] border-slate-800 text-slate-600'
                    : params.dutyCycle === duty
                    ? 'bg-amber-950/60 border-amber-500 text-amber-300 font-bold shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                    : 'bg-[#0e1017] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                {duty}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB CONTENT: LFO-BASED VIBRATO PITCH MODULATOR (Requested Feature) */}
      {activeTab === 'vibrato' && (
        <div className="space-y-4">
          {/* Vibrato Top Status Bar & Master Toggle */}
          <div className="bg-[#0f1118] p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onUpdateParams({ vibratoEnabled: !params.vibratoEnabled })}
                className={`px-4 py-2.5 rounded-lg font-nes text-xs cursor-pointer flex items-center gap-2 transition-all ${
                  params.vibratoEnabled && currentVibratoIntensity > 0
                    ? 'bg-sky-600 text-white shadow-[0_0_16px_rgba(14,165,233,0.5)] border border-sky-400'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
              >
                <Activity className={`w-4 h-4 ${params.vibratoEnabled && currentVibratoIntensity > 0 ? 'animate-pulse text-sky-200' : ''}`} />
                <span>LFO VIBRATO {params.vibratoEnabled && currentVibratoIntensity > 0 ? 'ACTIVE' : 'BYPASS'}</span>
              </button>

              <div className="text-[11px] font-retro-mono text-slate-400">
                <span>
                  {params.vibratoEnabled && currentVibratoIntensity > 0
                    ? `PITCH MODULATION: ±${currentVibratoIntensity.toFixed(0)} CENTS @ ${params.vibratoRate.toFixed(1)} Hz`
                    : 'LFO PITCH MODULATION INACTIVE (CLICK TO ACTIVATE)'}
                </span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-retro-mono text-slate-500 mr-1">PRESETS:</span>
              {[
                { label: 'SUBTLE', intensity: 12, rate: 4.8, wave: 'sine' },
                { label: 'CLASSIC NES', intensity: 25, rate: 5.5, wave: 'sine' },
                { label: 'DEEP WARBLE', intensity: 55, rate: 6.5, wave: 'triangle' },
                { label: 'CHIP TRILL', intensity: 85, rate: 11.0, wave: 'square' },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() =>
                    onUpdateParams({
                      vibratoEnabled: true,
                      vibratoIntensity: p.intensity,
                      vibratoDepth: p.intensity,
                      vibratoRate: p.rate,
                      vibratoWaveform: p.wave as any,
                    })
                  }
                  className="px-2 py-1 bg-[#1a1d28] hover:bg-slate-700 text-slate-300 rounded text-[9px] font-retro-mono border border-slate-700 cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vibrato Intensity & Configurable Rate Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* VIBRATO INTENSITY SLIDER (6 cols) */}
            <div className="md:col-span-6 bg-[#0f1118] p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-nes text-sky-400 block">
                    VIBRATO INTENSITY (DEPTH)
                  </span>
                  <span className="text-[9px] text-slate-400 font-retro-mono">
                    Pitch modulation depth in cents (0 - 100%)
                  </span>
                </div>
                <span className="font-retro-mono text-sm font-bold text-sky-400 bg-[#161822] px-2.5 py-1 rounded border border-slate-700">
                  {currentVibratoIntensity.toFixed(0)}% <span className="text-[10px] text-slate-400">(±{currentVibratoIntensity.toFixed(0)}¢)</span>
                </span>
              </div>

              {/* Slider */}
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={currentVibratoIntensity}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateParams({
                    vibratoIntensity: val,
                    vibratoDepth: val,
                    vibratoEnabled: val > 0 ? true : params.vibratoEnabled,
                  });
                }}
                className="w-full accent-sky-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />

              {/* Intensity Range Ticks */}
              <div className="flex justify-between text-[9px] font-retro-mono text-slate-500">
                <span>0% (OFF)</span>
                <span>25% (SUBTLE)</span>
                <span>50% (WARBLE)</span>
                <span>75% (HEAVY)</span>
                <span>100% (TRILL)</span>
              </div>
            </div>

            {/* CONFIGURABLE MODULATION RATE SLIDER (6 cols) */}
            <div className="md:col-span-6 bg-[#0f1118] p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-nes text-emerald-400 block">
                    MODULATION RATE (SPEED)
                  </span>
                  <span className="text-[9px] text-slate-400 font-retro-mono">
                    Low-Frequency Oscillator speed (0.5 to 16.0 Hz)
                  </span>
                </div>
                <span className="font-retro-mono text-sm font-bold text-emerald-400 bg-[#161822] px-2.5 py-1 rounded border border-slate-700">
                  {params.vibratoRate.toFixed(1)} <span className="text-[10px] text-slate-400">Hz</span>
                </span>
              </div>

              {/* Rate Slider */}
              <input
                type="range"
                min="0.5"
                max="16.0"
                step="0.1"
                value={params.vibratoRate}
                onChange={(e) => onUpdateParams({ vibratoRate: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />

              {/* Speed Range Ticks */}
              <div className="flex justify-between text-[9px] font-retro-mono text-slate-500">
                <span>0.5 Hz (SLOW DRIFT)</span>
                <span>4.0 Hz</span>
                <span>8.0 Hz (FAST)</span>
                <span>12.0 Hz</span>
                <span>16.0 Hz (RAPID FLUTTER)</span>
              </div>
            </div>

          </div>

          {/* LFO WAVEFORM SHAPE & OSCILLATION GRAPH */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-[#0f1118] p-4 rounded-xl border border-slate-800">
            
            {/* LFO Waveform Shape Selector (6 cols) */}
            <div className="md:col-span-6 space-y-2">
              <span className="text-[10px] font-nes text-slate-300 block">
                LFO MODULATION WAVEFORM
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'sine', label: 'SINE', desc: 'Smooth analog glide' },
                  { id: 'triangle', label: 'TRIANGLE', desc: 'Linear retro pitch' },
                  { id: 'square', label: 'SQUARE', desc: 'Chiptune trill jump' },
                  { id: 'sawtooth', label: 'SAWTOOTH', desc: 'Ramping dive' },
                ].map((shape) => (
                  <button
                    key={shape.id}
                    type="button"
                    onClick={() => onUpdateParams({ vibratoWaveform: shape.id as any })}
                    className={`p-2 rounded-lg text-left border cursor-pointer transition-all ${
                      (params.vibratoWaveform || 'sine') === shape.id
                        ? 'bg-sky-950/70 border-sky-500 text-sky-200 font-bold shadow-[0_0_8px_rgba(14,165,233,0.3)]'
                        : 'bg-[#151720] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-retro-mono text-[10px] font-bold">{shape.label}</div>
                    <div className="text-[8px] text-slate-500 leading-tight">{shape.desc}</div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 pt-1 font-retro-mono">
                Modulates the detune register of the active Ricoh 2A03 audio voices in real time.
              </p>
            </div>

            {/* Live Real-Time LFO Wave Visualizer (6 cols) */}
            <div className="md:col-span-6 flex flex-col items-center justify-center p-3 bg-[#13151f] rounded-lg border border-slate-800">
              <div className="flex items-center justify-between w-full text-[9px] font-retro-mono text-slate-400 mb-1">
                <span>REAL-TIME LFO WAVEFORM</span>
                <span className="text-sky-400">
                  {params.vibratoEnabled && currentVibratoIntensity > 0
                    ? `${(params.vibratoWaveform || 'sine').toUpperCase()} · ±${currentVibratoIntensity.toFixed(0)}¢ @ ${params.vibratoRate.toFixed(1)} Hz`
                    : 'MUTED / 0 INTENSITY'}
                </span>
              </div>
              <LfoWaveVisualizer
                rate={params.vibratoRate}
                intensity={params.vibratoEnabled ? currentVibratoIntensity : 0}
                waveform={params.vibratoWaveform || 'sine'}
              />
            </div>

          </div>
        </div>
      )}

      {/* TAB CONTENT: ARPEGGIATOR */}
      {activeTab === 'arpeggiator' && (
        <div className="space-y-4">
          {/* Arp Top Control & Gamepad D-Pad Link */}
          <div className="bg-[#0f1118] p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            {/* Master Toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onUpdateParams({ arpEnabled: !params.arpEnabled })}
                className={`px-4 py-2.5 rounded-lg font-nes text-xs cursor-pointer flex items-center gap-2 transition-all ${
                  params.arpEnabled
                    ? 'bg-emerald-600 text-white shadow-[0_0_16px_rgba(16,185,129,0.5)] border border-emerald-400'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
              >
                <Zap className={`w-4 h-4 ${params.arpEnabled ? 'fill-current text-amber-300 animate-pulse' : ''}`} />
                <span>ARPEGGIATOR {params.arpEnabled ? 'ONLINE' : 'OFF'}</span>
              </button>

              <div className="text-[11px] font-retro-mono text-slate-400">
                <span>STATUS: {params.arpEnabled ? 'CYCLES SEQUENCE ON HELD KEYS' : 'HOLD KEYS TO ARPEGGIATE WHEN ACTIVE'}</span>
              </div>
            </div>

            {/* Gamepad D-Pad Mode Control */}
            <div className="flex items-center gap-2 bg-[#181a24] px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-retro-mono">
              <span className="text-slate-400">GAMEPAD D-PAD LINK:</span>
              <button
                type="button"
                onClick={() =>
                  onUpdateParams({
                    dpadMode: params.dpadMode === 'arpeggiator' ? 'standard' : 'arpeggiator',
                  })
                }
                className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                  params.dpadMode === 'arpeggiator'
                    ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {params.dpadMode === 'arpeggiator' ? '🎮 ARP CONTROLLER ACTIVE' : 'OCTAVE/DUTY (STANDARD)'}
              </button>
            </div>
          </div>

          {/* Arp Chord / Scale Selection */}
          <div className="bg-[#0f1118] p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-nes text-amber-400">
                1. CHORD / SCALE SELECTION (GAMEPAD D-PAD LEFT / RIGHT)
              </span>
              <span className="text-[11px] font-retro-mono text-slate-400">
                CYCLE VIA GAMEPAD ◀ / ▶
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {ARP_SCALES.map((scale) => (
                <button
                  key={scale.id}
                  type="button"
                  onClick={() => onUpdateParams({ arpChordScale: scale.id })}
                  className={`p-2.5 rounded-lg text-left border cursor-pointer transition-all ${
                    params.arpChordScale === scale.id
                      ? 'bg-amber-950/70 border-amber-500 text-amber-200 font-bold shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                      : 'bg-[#151720] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className="font-retro-mono text-[10px] font-bold uppercase truncate">
                    {scale.label}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1 line-clamp-1">
                    {scale.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Arp Patterns & Rate Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Pattern Selection (7 cols) */}
            <div className="md:col-span-7 bg-[#0f1118] p-4 rounded-xl border border-slate-800">
              <div className="text-[10px] font-nes text-amber-400 mb-2">
                2. ARPEGGIO NOTE DIRECTION & PATTERN
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ARP_PATTERNS.map((pat) => (
                  <button
                    key={pat.id}
                    type="button"
                    onClick={() => onUpdateParams({ arpPattern: pat.id })}
                    className={`p-2 rounded-lg text-left border cursor-pointer transition-all ${
                      params.arpPattern === pat.id
                        ? 'bg-rose-950/70 border-rose-500 text-rose-200 font-bold shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                        : 'bg-[#151720] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <div className="font-retro-mono text-[10px] font-bold">{pat.label}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">{pat.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Rate & Octave Span (5 cols) */}
            <div className="md:col-span-5 bg-[#0f1118] p-4 rounded-xl border border-slate-800 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-nes text-amber-400">
                    3. ARPEGGIO SPEED (D-PAD ▲ / ▼)
                  </span>
                  <span className="text-[10px] font-retro-mono text-slate-400">
                    RATE
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {ARP_RATES.map((rate) => (
                    <button
                      key={rate.id}
                      type="button"
                      onClick={() => onUpdateParams({ arpRate: rate.id })}
                      className={`p-2 rounded-lg text-center border cursor-pointer transition-all ${
                        params.arpRate === rate.id
                          ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 font-bold shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                          : 'bg-[#151720] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <div className="font-retro-mono text-[10px] font-bold">{rate.label}</div>
                      <div className="text-[8px] text-slate-500">{rate.intervalMs} ms</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Octave Range Span */}
              <div>
                <div className="text-[10px] font-nes text-slate-300 mb-1.5">
                  OCTAVE REPETITION SPAN
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((oct) => (
                    <button
                      key={oct}
                      type="button"
                      onClick={() => onUpdateParams({ arpOctaves: oct })}
                      className={`py-1.5 rounded-lg text-center font-retro-mono text-xs border cursor-pointer transition-all ${
                        params.arpOctaves === oct
                          ? 'bg-amber-600 text-slate-950 font-bold border-amber-400'
                          : 'bg-[#151720] border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {oct} OCTAVE{oct > 1 ? 'S' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Interactive Gamepad D-Pad Remote & Live Sequence Bar */}
          <div className="bg-[#0f1118] p-4 rounded-xl border border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Live Sequence Note Display (8 cols) */}
            <div className="lg:col-span-8 space-y-2">
              <div className="flex items-center justify-between text-xs font-retro-mono">
                <span className="text-[10px] font-nes text-slate-300">
                  ACTIVE ARPEGGIO SEQUENCE ({currentArpSequence.length} NOTES)
                </span>
                <span className="text-amber-400">
                  {currentArpSequence.length === 0
                    ? 'HOLD NOTES ON KEYBOARD OR GAMEPAD A/B'
                    : `CYCLE: ${params.arpPattern.toUpperCase()} @ ${params.arpRate}`}
                </span>
              </div>

              {/* Sequence Note Badges */}
              <div className="flex items-center gap-1.5 flex-wrap min-h-12 p-2 bg-[#141620] rounded-lg border border-slate-800">
                {currentArpSequence.length === 0 ? (
                  <div className="text-xs font-retro-mono text-slate-500 italic px-2">
                    Press any keys on the keyboard or tap Gamepad A / B to populate notes into this scale.
                  </div>
                ) : (
                  currentArpSequence.map((midi, idx) => {
                    const isStepActive = activeArpStep === idx;
                    const noteName = getMidiNoteName(midi);
                    return (
                      <div
                        key={`${midi}-${idx}`}
                        className={`px-3 py-1.5 rounded-md font-retro-mono text-xs font-bold transition-all duration-75 flex flex-col items-center ${
                          isStepActive
                            ? 'bg-amber-400 text-slate-950 scale-110 shadow-[0_0_12px_#f59e0b] ring-2 ring-white z-10'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        <span>{noteName}</span>
                        <span className="text-[8px] opacity-70">#{idx + 1}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Gamepad D-Pad Quick Remote (4 cols) */}
            <div className="lg:col-span-4 bg-[#141620] p-3 rounded-lg border border-slate-800 flex flex-col items-center justify-center">
              <span className="text-[9px] font-nes text-slate-400 mb-2">
                GAMEPAD D-PAD TESTER
              </span>

              {/* Cross Widget */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                {/* UP */}
                <button
                  type="button"
                  onClick={() => onDpadArpControl?.('up')}
                  className="absolute top-0 w-8 h-8 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border border-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                  title="Faster Rate (D-Pad UP)"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                {/* DOWN */}
                <button
                  type="button"
                  onClick={() => onDpadArpControl?.('down')}
                  className="absolute bottom-0 w-8 h-8 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border border-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                  title="Slower Rate (D-Pad DOWN)"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                {/* LEFT */}
                <button
                  type="button"
                  onClick={() => onDpadArpControl?.('left')}
                  className="absolute left-0 w-8 h-8 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border border-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                  title="Previous Scale (D-Pad LEFT)"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                {/* RIGHT */}
                <button
                  type="button"
                  onClick={() => onDpadArpControl?.('right')}
                  className="absolute right-0 w-8 h-8 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border border-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                  title="Next Scale (D-Pad RIGHT)"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
                {/* Center Core */}
                <div className="w-5 h-5 rounded-full bg-slate-950 border border-slate-700"></div>
              </div>

              <span className="text-[9px] font-retro-mono text-slate-500 mt-2 text-center">
                ▲/▼ SPEED · ◀/▶ SCALE
              </span>
            </div>

          </div>
        </div>
      )}

      {/* TAB CONTENT: Envelope */}
      {activeTab === 'envelope' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Attack */}
          <div className="bg-[#0f1118] p-3 rounded-lg border border-slate-800">
            <div className="flex justify-between text-[10px] font-retro-mono text-slate-300 mb-1">
              <span>ATTACK</span>
              <span className="text-amber-400 font-bold">{(params.attack * 1000).toFixed(0)} ms</span>
            </div>
            <input
              type="range"
              min="0.001"
              max="0.5"
              step="0.002"
              value={params.attack}
              onChange={(e) => onUpdateParams({ attack: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="text-[9px] text-slate-500 mt-1">Initial ramp-up punch</div>
          </div>

          {/* Decay */}
          <div className="bg-[#0f1118] p-3 rounded-lg border border-slate-800">
            <div className="flex justify-between text-[10px] font-retro-mono text-slate-300 mb-1">
              <span>DECAY</span>
              <span className="text-amber-400 font-bold">{(params.decay * 1000).toFixed(0)} ms</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="1.0"
              step="0.01"
              value={params.decay}
              onChange={(e) => onUpdateParams({ decay: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="text-[9px] text-slate-500 mt-1">Fall to sustain level</div>
          </div>

          {/* Sustain */}
          <div className="bg-[#0f1118] p-3 rounded-lg border border-slate-800">
            <div className="flex justify-between text-[10px] font-retro-mono text-slate-300 mb-1">
              <span>SUSTAIN</span>
              <span className="text-amber-400 font-bold">{(params.sustain * 100).toFixed(0)} %</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.02"
              value={params.sustain}
              onChange={(e) => onUpdateParams({ sustain: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="text-[9px] text-slate-500 mt-1">Held key volume</div>
          </div>

          {/* Release */}
          <div className="bg-[#0f1118] p-3 rounded-lg border border-slate-800">
            <div className="flex justify-between text-[10px] font-retro-mono text-slate-300 mb-1">
              <span>RELEASE</span>
              <span className="text-amber-400 font-bold">{(params.release * 1000).toFixed(0)} ms</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="1.5"
              step="0.02"
              value={params.release}
              onChange={(e) => onUpdateParams({ release: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="text-[9px] text-slate-500 mt-1">Fade after key lift</div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Hardware Pitch Sweep */}
      {activeTab === 'sweep' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Sweep Enable & Direction */}
          <div className="bg-[#0f1118] p-3 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-nes text-slate-300">SWEEP UNIT</span>
              <button
                type="button"
                onClick={() => onUpdateParams({ sweepEnabled: !params.sweepEnabled })}
                className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                  params.sweepEnabled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {params.sweepEnabled ? 'ACTIVE' : 'OFF'}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => onUpdateParams({ sweepDirection: 'up' })}
                className={`flex-1 py-1.5 rounded text-[10px] font-retro-mono cursor-pointer ${
                  params.sweepDirection === 'up'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                BEND UP ▲
              </button>
              <button
                type="button"
                onClick={() => onUpdateParams({ sweepDirection: 'down' })}
                className={`flex-1 py-1.5 rounded text-[10px] font-retro-mono cursor-pointer ${
                  params.sweepDirection === 'down'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                BEND DOWN ▼
              </button>
            </div>
            <div className="text-[9px] text-slate-500 mt-2">NES APU hardware sweep register</div>
          </div>

          {/* Sweep Shift Amount */}
          <div className="bg-[#0f1118] p-3 rounded-lg border border-slate-800">
            <div className="flex justify-between text-[10px] font-retro-mono text-slate-300 mb-1">
              <span>SWEEP AMOUNT</span>
              <span className="text-amber-400 font-bold">{params.sweepAmount}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={params.sweepAmount}
              onChange={(e) => onUpdateParams({ sweepAmount: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="text-[9px] text-slate-500 mt-1">Pitch shift multiplier range</div>
          </div>

          {/* Sweep Time */}
          <div className="bg-[#0f1118] p-3 rounded-lg border border-slate-800">
            <div className="flex justify-between text-[10px] font-retro-mono text-slate-300 mb-1">
              <span>SWEEP DURATION</span>
              <span className="text-amber-400 font-bold">{(params.sweepTime * 1000).toFixed(0)} ms</span>
            </div>
            <input
              type="range"
              min="0.02"
              max="0.5"
              step="0.01"
              value={params.sweepTime}
              onChange={(e) => onUpdateParams({ sweepTime: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="text-[9px] text-slate-500 mt-1">Glide ramp speed</div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Effects (Vibrato, 4-bit Quantizer, Cavern Echo) */}
      {activeTab === 'effects' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vibrato in Effects Tab */}
            <div className="bg-[#0f1118] p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-nes text-sky-400">VIBRATO LFO INTENSITY & RATE</span>
                <button
                  type="button"
                  onClick={() => onUpdateParams({ vibratoEnabled: !params.vibratoEnabled })}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                    params.vibratoEnabled && currentVibratoIntensity > 0
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {params.vibratoEnabled && currentVibratoIntensity > 0 ? 'ACTIVE' : 'OFF'}
                </button>
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-retro-mono text-slate-300 mb-1">
                  <span>INTENSITY (DEPTH):</span>
                  <span className="text-sky-400 font-bold">{currentVibratoIntensity.toFixed(0)}% (±{currentVibratoIntensity.toFixed(0)}¢)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={currentVibratoIntensity}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    onUpdateParams({
                      vibratoIntensity: val,
                      vibratoDepth: val,
                      vibratoEnabled: val > 0 ? true : params.vibratoEnabled,
                    });
                  }}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-retro-mono text-slate-300 mb-1">
                  <span>MODULATION RATE:</span>
                  <span className="text-emerald-400 font-bold">{params.vibratoRate.toFixed(1)} Hz</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="16.0"
                  step="0.1"
                  value={params.vibratoRate}
                  onChange={(e) => onUpdateParams({ vibratoRate: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* 4-Bit DAC Quantizer (Bitcrusher) */}
            <div className="bg-[#0f1118] p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-nes text-slate-300">4-BIT DAC STEPPING</span>
                <button
                  type="button"
                  onClick={() => onUpdateParams({ bitcrushEnabled: !params.bitcrushEnabled })}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                    params.bitcrushEnabled
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {params.bitcrushEnabled ? '16 STEPS' : '32-BIT CLEAN'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 font-retro-mono">
                Quantizes audio output to 16 discrete amplitude levels, recreating the physical 4-bit DAC resistor ladder of the Ricoh 2A03 chip.
              </p>
            </div>
          </div>

          {/* Cavern Echo / Delay */}
          <div className="bg-[#0f1118] p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-nes text-slate-300">CAVERN DELAY ECHO</span>
              <button
                type="button"
                onClick={() => onUpdateParams({ echoEnabled: !params.echoEnabled })}
                className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                  params.echoEnabled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {params.echoEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <span className="text-[10px] font-retro-mono text-slate-400 block mb-1">
                  DELAY TIME: {(params.echoTime * 1000).toFixed(0)} ms
                </span>
                <input
                  type="range"
                  min="0.05"
                  max="0.6"
                  step="0.05"
                  value={params.echoTime}
                  onChange={(e) => onUpdateParams({ echoTime: Number(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
              <div>
                <span className="text-[10px] font-retro-mono text-slate-400 block mb-1">
                  FEEDBACK: {(params.echoFeedback * 100).toFixed(0)}%
                </span>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={params.echoFeedback}
                  onChange={(e) => onUpdateParams({ echoFeedback: Number(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Presets Library */}
      {activeTab === 'presets' && (
        <div className="space-y-4">
          {/* Preset list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {SYNTH_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onLoadPreset(preset)}
                className="p-3 bg-[#0f1118] hover:bg-[#181b26] border border-slate-800 hover:border-amber-500/60 rounded-lg text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-nes text-[10px] text-slate-200 group-hover:text-amber-400">
                    {preset.name}
                  </span>
                  <span className="text-[9px] font-retro-mono text-slate-500 uppercase px-1.5 py-0.5 bg-slate-900 rounded">
                    {preset.category}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                  {preset.description}
                </div>
              </button>
            ))}
          </div>

          {/* User Custom Saved Presets */}
          <div className="pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-nes text-[10px] text-amber-400">SAVED USER PATCHES</span>
              <form onSubmit={handleSaveUserPreset} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Patch Name..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="bg-[#0f1118] border border-slate-700 text-xs px-2 py-1 rounded text-slate-200 font-retro-mono outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-retro-mono cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span>SAVE CURRENT</span>
                </button>
              </form>
            </div>

            {userPresets.length === 0 ? (
              <div className="text-[11px] font-retro-mono text-slate-500 italic py-2">
                No custom patches saved yet. Tweak controls above and click "Save Current".
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {userPresets.map((up) => (
                  <div
                    key={up.id}
                    className="flex items-center justify-between p-2 bg-[#0f1118] border border-slate-800 rounded-lg"
                  >
                    <button
                      type="button"
                      onClick={() => onLoadPreset(up)}
                      className="font-retro-mono text-xs text-amber-300 hover:underline cursor-pointer truncate"
                    >
                      {up.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUserPreset(up.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                      title="Delete patch"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
