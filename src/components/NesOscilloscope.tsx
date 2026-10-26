import React, { useEffect, useRef, useState } from 'react';
import { nesSynth, DutyCycle, ChannelType } from '../audio/nesAudioEngine';

interface NesOscilloscopeProps {
  currentChannel: ChannelType;
  dutyCycle: DutyCycle;
  bitcrushEnabled: boolean;
  onTriggerSfx: (name: 'coin' | 'jump' | 'laser' | 'powerup' | 'explosion' | 'hurt' | 'oneup' | 'warp') => void;
}

type PhosphorColor = 'green' | 'amber' | 'cyan' | 'famicom';

export const NesOscilloscope: React.FC<NesOscilloscopeProps> = ({
  currentChannel,
  dutyCycle,
  bitcrushEnabled,
  onTriggerSfx,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phosphorMode, setPhosphorMode] = useState<PhosphorColor>('green');
  const [viewMode, setViewMode] = useState<'wave' | 'spectrum'>('wave');
  const [crtScanlines, setCrtScanlines] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const bufferLength = 1024;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);

    const phosphorPalettes: Record<PhosphorColor, { main: string; glow: string; grid: string }> = {
      green: { main: '#4ade80', glow: '#22c55e', grid: 'rgba(34, 197, 94, 0.15)' },
      amber: { main: '#fbbf24', glow: '#f59e0b', grid: 'rgba(245, 158, 11, 0.15)' },
      cyan: { main: '#38bdf8', glow: '#0ea5e9', grid: 'rgba(14, 165, 233, 0.15)' },
      famicom: { main: '#f43f5e', glow: '#e11d48', grid: 'rgba(225, 29, 72, 0.15)' },
    };

    const render = () => {
      animId = requestAnimationFrame(render);
      const analyser = nesSynth.getAnalyser();

      // Screen clear with phosphor decay persistence
      ctx.fillStyle = 'rgba(10, 14, 20, 0.28)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const palette = phosphorPalettes[phosphorMode];

      // Draw Oscilloscope Grid Reticle
      ctx.strokeStyle = palette.grid;
      ctx.lineWidth = 1;
      const stepX = canvas.width / 10;
      const stepY = canvas.height / 8;

      ctx.beginPath();
      for (let x = stepX; x < canvas.width; x += stepX) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      for (let y = stepY; y < canvas.height; y += stepY) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();

      // Center crosshair with tick marks
      ctx.strokeStyle = palette.grid;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      if (!analyser) {
        // Flat baseline if audio not started
        ctx.strokeStyle = palette.main;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        return;
      }

      if (viewMode === 'wave') {
        analyser.getByteTimeDomainData(timeData);

        ctx.strokeStyle = palette.main;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = palette.glow;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const y = (v * canvas.height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      } else {
        // Spectrum FFT Mode
        analyser.getByteFrequencyData(freqData);

        const barWidth = (canvas.width / 64);
        ctx.fillStyle = palette.main;
        ctx.shadowColor = palette.glow;
        ctx.shadowBlur = 8;

        for (let i = 0; i < 64; i++) {
          const barHeight = (freqData[i * 2] / 255) * (canvas.height - 20);
          ctx.fillRect(i * barWidth + 1, canvas.height - barHeight, barWidth - 2, barHeight);
        }
        ctx.shadowBlur = 0;
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [phosphorMode, viewMode]);

  return (
    <div className="w-full bg-[#161820] rounded-xl border-2 border-[#282c37] p-4 sm:p-5 shadow-[0_12px_24px_rgba(0,0,0,0.6)]">
      {/* Scope Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-slate-800 text-xs font-retro-mono">
        <div className="flex items-center gap-2">
          <span className="font-nes text-[10px] text-emerald-400">CRT WAVEFORM MONITOR</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-300">
            {currentChannel.toUpperCase()} {currentChannel.includes('pulse') ? `(${dutyCycle} DUTY)` : ''}
          </span>
          {bitcrushEnabled && (
            <span className="text-[10px] text-amber-400 border border-amber-500/40 px-1 rounded">
              4-BIT DAC
            </span>
          )}
        </div>

        {/* Phosphor Mode / Display Controls */}
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-[#0d0e12] rounded p-0.5 border border-slate-800">
            <button
              onClick={() => setViewMode('wave')}
              className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
                viewMode === 'wave' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              OSCILLOSCOPE
            </button>
            <button
              onClick={() => setViewMode('spectrum')}
              className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
                viewMode === 'spectrum' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              SPECTRUM
            </button>
          </div>

          {/* Color Phosphor selector */}
          <div className="flex items-center gap-1 bg-[#0d0e12] px-2 py-1 rounded border border-slate-800 text-[10px]">
            <span className="text-slate-500 mr-1">TUBE:</span>
            {(['green', 'amber', 'cyan', 'famicom'] as PhosphorColor[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setPhosphorMode(mode)}
                className={`w-3.5 h-3.5 rounded-full cursor-pointer transition-transform ${
                  phosphorMode === mode ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'
                }`}
                style={{
                  backgroundColor:
                    mode === 'green' ? '#22c55e' : mode === 'amber' ? '#f59e0b' : mode === 'cyan' ? '#0ea5e9' : '#e11d48',
                }}
                title={`${mode} phosphor`}
              />
            ))}
          </div>

          {/* CRT scanlines toggle */}
          <button
            onClick={() => setCrtScanlines(!crtScanlines)}
            className={`px-2 py-1 text-[10px] rounded border cursor-pointer ${
              crtScanlines ? 'border-emerald-700 text-emerald-400 bg-emerald-950/40' : 'border-slate-800 text-slate-500'
            }`}
            title="Toggle CRT Scanline Overlay"
          >
            SCANLINES {crtScanlines ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* The CRT Screen Viewport */}
      <div className={`relative w-full h-52 sm:h-64 bg-[#0a0e14] rounded-lg border-2 border-slate-900 ${crtScanlines ? 'crt-screen crt-curvature' : ''}`}>
        <canvas
          ref={canvasRef}
          width={800}
          height={320}
          className="w-full h-full object-cover block rounded"
        />

        {/* Screen Bezel Telemetry Overlay */}
        <div className="absolute top-2 left-3 pointer-events-none flex items-center gap-3 text-[10px] font-retro-mono text-emerald-400/80 drop-shadow">
          <span>CH: {currentChannel.toUpperCase()}</span>
          <span>SR: 44.1 kHz</span>
          <span>RES: 16-BIT PCM</span>
        </div>

        <div className="absolute top-2 right-3 pointer-events-none text-[10px] font-retro-mono text-emerald-400/80 drop-shadow">
          <span>SWEEP: {dutyCycle}</span>
        </div>

        {/* Bottom Screen Info */}
        <div className="absolute bottom-2 left-3 pointer-events-none text-[10px] font-retro-mono text-emerald-400/70">
          <span>APU 2A03 · REALTIME FFT & TIME-DOMAIN</span>
        </div>
      </div>

      {/* 8-Bit SFX Soundboard Quick-Pads */}
      <div className="mt-4 pt-3 border-t border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="font-nes text-[10px] text-amber-400">INSTANT 8-BIT SFX SOUNDBOARD</span>
          <span className="text-[11px] font-retro-mono text-slate-400">CLICK TO SYNTHESIZE ICONIC GAME AUDIO</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
          {[
            { id: 'coin', label: 'COIN PICKUP', color: 'hover:border-amber-400 hover:text-amber-300' },
            { id: 'jump', label: 'JUMP GLIDE', color: 'hover:border-emerald-400 hover:text-emerald-300' },
            { id: 'laser', label: 'LASER BLAST', color: 'hover:border-cyan-400 hover:text-cyan-300' },
            { id: 'powerup', label: 'POWER-UP', color: 'hover:border-purple-400 hover:text-purple-300' },
            { id: 'oneup', label: '1-UP CHIME', color: 'hover:border-green-400 hover:text-green-300' },
            { id: 'explosion', label: 'EXPLOSION', color: 'hover:border-red-400 hover:text-red-300' },
            { id: 'hurt', label: 'HIT / DAMAGE', color: 'hover:border-rose-400 hover:text-rose-300' },
            { id: 'warp', label: 'WARP PORTAL', color: 'hover:border-indigo-400 hover:text-indigo-300' },
          ].map((sfx) => (
            <button
              key={sfx.id}
              onClick={() => onTriggerSfx(sfx.id as any)}
              className={`px-2 py-2 bg-[#0e1017] border border-slate-800 rounded-md text-[9px] font-nes text-slate-300 transition-all duration-100 cursor-pointer text-center active:scale-95 active:bg-slate-800 shadow-sm ${sfx.color}`}
            >
              {sfx.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
