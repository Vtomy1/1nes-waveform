/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { nesSynth, DEFAULT_SYNTH_PARAMS, SynthParams, DutyCycle, ChannelType } from './audio/nesAudioEngine';
import { SynthPreset, SYNTH_PRESETS } from './audio/nesPresets';
import { NesGamepad } from './components/NesGamepad';
import { NesKeyboard } from './components/NesKeyboard';
import { NesOscilloscope } from './components/NesOscilloscope';
import { NesSequencer } from './components/NesSequencer';
import { NesSoundPanel } from './components/NesSoundPanel';
import {
  Volume2,
  VolumeX,
  Disc3,
  Download,
  Info,
  Radio,
  Gamepad2,
  Music,
  Sliders,
  Terminal,
  Layers,
} from 'lucide-react';

export default function App() {
  const [params, setParams] = useState<SynthParams>(DEFAULT_SYNTH_PARAMS);
  const [octaveOffset, setOctaveOffset] = useState<number>(0);
  const [activeMidiNotes, setActiveMidiNotes] = useState<Set<number>>(new Set());
  const [isSequencerPlaying, setIsSequencerPlaying] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [activeViewSection, setActiveViewSection] = useState<'all' | 'gamepad' | 'keyboard' | 'tracker' | 'params'>('all');
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  // References for turbo intervals
  const turboIntervalARef = useRef<number | null>(null);
  const turboIntervalBRef = useRef<number | null>(null);

  // Keep engine params in sync
  const handleUpdateParams = useCallback((newParams: Partial<SynthParams>) => {
    setParams((prev) => {
      const updated = { ...prev, ...newParams };
      nesSynth.setParams(updated);
      return updated;
    });
  }, []);

  const [activeArpStep, setActiveArpStep] = useState<number>(-1);
  const [currentArpSequence, setCurrentArpSequence] = useState<number[]>([]);

  // Subscribe to real-time Arpeggiator step changes
  useEffect(() => {
    const unsubscribe = nesSynth.subscribeArpStep((stepIdx, _midi, _name, seq) => {
      setActiveArpStep(stepIdx);
      setCurrentArpSequence(seq);
    });
    return unsubscribe;
  }, []);

  // Sync held notes with arpeggiator
  useEffect(() => {
    nesSynth.updateArpHeldNotes(Array.from(activeMidiNotes));
  }, [activeMidiNotes]);

  // Octave Change via D-Pad
  const handleOctaveChange = useCallback((delta: number) => {
    setOctaveOffset((prev) => Math.max(-2, Math.min(2, prev + delta)));
  }, []);

  // Duty Cycle Change via D-Pad
  const handleDutyCycleChange = useCallback((duty: DutyCycle) => {
    handleUpdateParams({ dutyCycle: duty });
  }, [handleUpdateParams]);

  // D-Pad Arpeggiator Controller (UP/DOWN for rate, LEFT/RIGHT for scale/chord)
  const handleDpadArpControl = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (direction === 'up') {
      const nextRate = nesSynth.cycleArpRate(-1); // Faster speed
      setParams((prev) => ({ ...prev, arpRate: nextRate }));
    } else if (direction === 'down') {
      const nextRate = nesSynth.cycleArpRate(1); // Slower speed
      setParams((prev) => ({ ...prev, arpRate: nextRate }));
    } else if (direction === 'left') {
      const nextScale = nesSynth.cycleArpScale(-1);
      setParams((prev) => ({ ...prev, arpChordScale: nextScale }));
    } else if (direction === 'right') {
      const nextScale = nesSynth.cycleArpScale(1);
      setParams((prev) => ({ ...prev, arpChordScale: nextScale }));
    }
  }, []);

  // Toggle D-Pad mode between standard (Octave/Duty) and arpeggiator
  const handleDpadModeToggle = useCallback(() => {
    const nextMode = params.dpadMode === 'arpeggiator' ? 'standard' : 'arpeggiator';
    handleUpdateParams({ dpadMode: nextMode });
  }, [params.dpadMode, handleUpdateParams]);

  // Channel Change via SELECT button
  const handleChannelChange = useCallback((channel: ChannelType) => {
    handleUpdateParams({ channel });
  }, [handleUpdateParams]);

  // Load a preset
  const handleLoadPreset = useCallback((preset: SynthPreset) => {
    handleUpdateParams(preset.params);
  }, [handleUpdateParams]);

  // Note On Handler
  const handleNoteDown = useCallback((midi: number, noteName: string) => {
    nesSynth.initAudio();
    if (!params.arpEnabled) {
      nesSynth.noteOn(midi, noteName);
    }
    setActiveMidiNotes((prev) => new Set(prev).add(midi));
  }, [params.arpEnabled]);

  // Note Off Handler
  const handleNoteUp = useCallback((midi: number) => {
    if (!params.arpEnabled) {
      nesSynth.noteOff(midi);
    }
    setActiveMidiNotes((prev) => {
      const copy = new Set(prev);
      copy.delete(midi);
      return copy;
    });
  }, [params.arpEnabled]);

  // Gamepad Button A trigger (Plays current tonic note or feeds arpeggiator)
  const handleTriggerActionA = useCallback((isPressed: boolean) => {
    const targetMidi = 60 + octaveOffset * 12; // C4 transposed
    if (isPressed) {
      handleNoteDown(targetMidi, `C${4 + octaveOffset}`);
    } else {
      handleNoteUp(targetMidi);
    }
  }, [octaveOffset, handleNoteDown, handleNoteUp]);

  // Gamepad Button B trigger (Plays sub bass note or feeds arpeggiator)
  const handleTriggerActionB = useCallback((isPressed: boolean) => {
    if (params.channel === 'noise') {
      if (isPressed) nesSynth.playSoundEffect('hurt');
    } else {
      const targetMidi = 36 + octaveOffset * 12; // C2 transposed
      if (isPressed) {
        handleNoteDown(targetMidi, `C${2 + octaveOffset}`);
      } else {
        handleNoteUp(targetMidi);
      }
    }
  }, [octaveOffset, params.channel, handleNoteDown, handleNoteUp]);

  // Gamepad Turbo A trigger (Rapid 16th note retrigger)
  const handleTriggerTurboA = useCallback((isPressed: boolean) => {
    if (isPressed) {
      const targetMidi = 60 + octaveOffset * 12;
      let on = false;
      turboIntervalARef.current = window.setInterval(() => {
        on = !on;
        if (on) {
          nesSynth.noteOn(targetMidi, `C${4 + octaveOffset}`);
        } else {
          nesSynth.noteOff(targetMidi);
        }
      }, 75);
    } else {
      if (turboIntervalARef.current) {
        clearInterval(turboIntervalARef.current);
        turboIntervalARef.current = null;
      }
      const targetMidi = 60 + octaveOffset * 12;
      handleNoteUp(targetMidi);
    }
  }, [octaveOffset, handleNoteUp]);

  // Gamepad Turbo B trigger (Rapid sub hit retrigger)
  const handleTriggerTurboB = useCallback((isPressed: boolean) => {
    if (isPressed) {
      let on = false;
      turboIntervalBRef.current = window.setInterval(() => {
        on = !on;
        if (on) {
          if (params.channel === 'noise') {
            nesSynth.playSoundEffect('hurt');
          } else {
            const targetMidi = 36 + octaveOffset * 12;
            nesSynth.noteOn(targetMidi, `C${2 + octaveOffset}`);
          }
        } else {
          if (params.channel !== 'noise') {
            const targetMidi = 36 + octaveOffset * 12;
            nesSynth.noteOff(targetMidi);
          }
        }
      }, 75);
    } else {
      if (turboIntervalBRef.current) {
        clearInterval(turboIntervalBRef.current);
        turboIntervalBRef.current = null;
      }
      const targetMidi = 36 + octaveOffset * 12;
      handleNoteUp(targetMidi);
    }
  }, [octaveOffset, params.channel, handleNoteUp]);

  // Toggle Sequencer
  const handleToggleSequencer = useCallback(() => {
    setIsSequencerPlaying((prev) => !prev);
  }, []);

  // SFX Trigger
  const handleTriggerSfx = useCallback((name: any) => {
    nesSynth.playSoundEffect(name);
  }, []);

  // Start / Stop WAV recording
  const handleToggleRecording = () => {
    if (!isRecording) {
      nesSynth.initAudio();
      nesSynth.startRecording();
      setIsRecording(true);
    } else {
      nesSynth.stopRecordingAndExport(`nes-8bit-${Date.now()}.wav`);
      setIsRecording(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-slate-100 font-body selection:bg-rose-600 selection:text-white pb-16">
      
      {/* Universal Top Bar Contract: [Brand title] — [4-5 nav links] — [1 primary action] */}
      <header className="sticky top-0 z-50 bg-[#12141c]/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-8">
        
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-600 to-rose-800 flex items-center justify-center shadow-[0_0_12px_rgba(225,29,72,0.4)]">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <span className="font-nes text-xs sm:text-sm tracking-wider text-white whitespace-nowrap">
            NES WAVEFORM SYNTHESIZER
          </span>
        </div>

        {/* Zone 2: 4–5 single-line clean text links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-retro-mono text-slate-400">
          <button
            onClick={() => setActiveViewSection('all')}
            className={`cursor-pointer hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeViewSection === 'all' ? 'text-amber-400 font-bold underline underline-offset-4' : ''
            }`}
          >
            All Modules
          </button>
          <button
            onClick={() => setActiveViewSection('gamepad')}
            className={`cursor-pointer hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeViewSection === 'gamepad' ? 'text-amber-400 font-bold underline underline-offset-4' : ''
            }`}
          >
            Gamepad
          </button>
          <button
            onClick={() => setActiveViewSection('keyboard')}
            className={`cursor-pointer hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeViewSection === 'keyboard' ? 'text-amber-400 font-bold underline underline-offset-4' : ''
            }`}
          >
            Waveform Keyboard
          </button>
          <button
            onClick={() => setActiveViewSection('tracker')}
            className={`cursor-pointer hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeViewSection === 'tracker' ? 'text-amber-400 font-bold underline underline-offset-4' : ''
            }`}
          >
            Chiptune Tracker
          </button>
          <button
            onClick={() => setActiveViewSection('params')}
            className={`cursor-pointer hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeViewSection === 'params' ? 'text-amber-400 font-bold underline underline-offset-4' : ''
            }`}
          >
            APU Engine
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Master Volume */}
          <div className="hidden sm:flex items-center gap-2 bg-[#0e1017] px-2.5 py-1.5 rounded-lg border border-slate-800">
            {params.masterVolume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            )}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={params.masterVolume}
              onChange={(e) => handleUpdateParams({ masterVolume: Number(e.target.value) })}
              className="w-16 accent-rose-500 cursor-pointer"
              title="Master Volume"
            />
          </div>

          {/* Quick Help Guide Button */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="p-1.5 rounded-lg bg-[#181a24] hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
            title="Controls & Shortcuts Guide"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Record / Export WAV Primary Button */}
          <button
            onClick={handleToggleRecording}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-nes text-[10px] cursor-pointer transition-all whitespace-nowrap shrink-0 ${
              isRecording
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_14px_rgba(225,29,72,0.8)] animate-pulse'
                : 'bg-[#222533] hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <Disc3 className={`w-3.5 h-3.5 ${isRecording ? 'animate-spin' : ''}`} />
            <span>{isRecording ? 'STOP & SAVE WAV' : 'EXPORT WAV'}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* Retro Header Kicker & Metadata (Zero-pill discipline) */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span>Hardware: Ricoh 2A03 APU</span>
            <span aria-hidden="true">·</span>
            <span>5 Audio Channels (Pulse 1, Pulse 2, Triangle, Noise, DMC)</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-400">Tactile Gamepad Mapped</span>
          </div>
          <div className="flex items-center gap-2 font-retro-mono text-[11px]">
            <span>Latency: 0 ms</span>
            <span aria-hidden="true">·</span>
            <span>Sampling: 44.1 kHz PCM</span>
          </div>
        </div>

        {/* TOP ROW: Oscilloscope & Retro Cartridge Showcase */}
        {(activeViewSection === 'all' || activeViewSection === 'gamepad' || activeViewSection === 'keyboard') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Real-time CRT Oscilloscope (8 cols) */}
            <div className="lg:col-span-8 flex flex-col">
              <NesOscilloscope
                currentChannel={params.channel}
                dutyCycle={params.dutyCycle}
                bitcrushEnabled={params.bitcrushEnabled}
                onTriggerSfx={handleTriggerSfx}
              />
            </div>

            {/* Vintage Cartridge & Quick Presets Showcase (4 cols) */}
            <div className="lg:col-span-4 bg-[#161822] rounded-xl border-2 border-[#2b303d] p-4 flex flex-col justify-between shadow-[0_12px_24px_rgba(0,0,0,0.6)]">
              <div>
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                  <span className="font-nes text-[10px] text-rose-400">AUTHENTIC 8-BIT ROM</span>
                  <span className="text-[10px] font-retro-mono text-slate-500">REV-A 1988</span>
                </div>

                {/* Cartridge Art Thumbnail */}
                <div className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-800 bg-[#0c0d12] mb-3 group">
                  <img
                    src="/src/assets/images/nes_cartridge_label_art_1792979768834.jpg"
                    alt="NES Synth-Wave Hero 8-Bit Cartridge Artwork"
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
                    <span className="font-nes text-[9px] text-white drop-shadow">
                      SYNTH-WAVE HERO 2A03
                    </span>
                  </div>
                </div>

                {/* Quick Presets Strip */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-retro-mono text-slate-400 block mb-1">
                    POPULAR 8-BIT TIMBRES:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SYNTH_PRESETS.slice(0, 4).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleLoadPreset(p)}
                        className="px-2 py-1.5 bg-[#0f1118] hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 rounded text-left cursor-pointer transition-colors"
                      >
                        <div className="font-nes text-[8px] text-slate-200 truncate">{p.name}</div>
                        <div className="text-[8px] font-retro-mono text-slate-500 uppercase">{p.category}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Hardware Clock Badge */}
              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-retro-mono text-slate-500">
                <span>NTSC 1.789 MHz</span>
                <span className="text-emerald-400">WEBAUDIO BUFFER LOCK</span>
              </div>
            </div>
          </div>
        )}

        {/* MIDDLE ROW: Classic Gamepad Controller Interface */}
        {(activeViewSection === 'all' || activeViewSection === 'gamepad') && (
          <section className="space-y-2">
            <NesGamepad
              currentChannel={params.channel}
              dutyCycle={params.dutyCycle}
              octaveOffset={octaveOffset}
              isSequencerPlaying={isSequencerPlaying}
              arpEnabled={params.arpEnabled}
              dpadMode={params.dpadMode}
              arpRate={params.arpRate}
              arpChordScale={params.arpChordScale}
              onDpadModeToggle={handleDpadModeToggle}
              onDpadArpControl={handleDpadArpControl}
              onChannelChange={handleChannelChange}
              onDutyCycleChange={handleDutyCycleChange}
              onOctaveChange={handleOctaveChange}
              onToggleSequencer={handleToggleSequencer}
              onTriggerActionA={handleTriggerActionA}
              onTriggerActionB={handleTriggerActionB}
              onTriggerTurboA={handleTriggerTurboA}
              onTriggerTurboB={handleTriggerTurboB}
            />
          </section>
        )}

        {/* KEYBOARD ROW: 25-Key Waveform Piano */}
        {(activeViewSection === 'all' || activeViewSection === 'keyboard') && (
          <section className="space-y-2">
            <NesKeyboard
              octaveOffset={octaveOffset}
              activeMidiNotes={
                params.arpEnabled && activeArpStep >= 0 && currentArpSequence[activeArpStep]
                  ? new Set([...Array.from(activeMidiNotes), currentArpSequence[activeArpStep]])
                  : activeMidiNotes
              }
              onNoteDown={handleNoteDown}
              onNoteUp={handleNoteUp}
            />
          </section>
        )}

        {/* SEQUENCER ROW: 16-Step Chiptune Tracker */}
        {(activeViewSection === 'all' || activeViewSection === 'tracker') && (
          <section className="space-y-2">
            <NesSequencer
              isPlaying={isSequencerPlaying}
              onTogglePlay={handleToggleSequencer}
            />
          </section>
        )}

        {/* SYNTHESIS ENGINE & ARPEGGIATOR PARAMETERS ROW */}
        {(activeViewSection === 'all' || activeViewSection === 'params') && (
          <section className="space-y-2">
            <NesSoundPanel
              params={params}
              onUpdateParams={handleUpdateParams}
              onLoadPreset={handleLoadPreset}
              activeArpStep={activeArpStep}
              currentArpSequence={currentArpSequence}
              onDpadArpControl={handleDpadArpControl}
            />
          </section>
        )}

      </main>

      {/* Controller & Keyboard Controls Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181a24] border-2 border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-nes text-sm text-amber-400">
                CONTROLLER & SYNTHESIS GUIDE
              </span>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 text-xs font-retro-mono cursor-pointer"
              >
                CLOSE [ESC]
              </button>
            </div>

            <div className="space-y-3 text-xs font-retro-mono text-slate-300 max-h-[70vh] overflow-y-auto pr-1">
              <div className="bg-[#0f1118] p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-nes text-[10px] text-sky-400 block mb-1">
                  〰 LFO VIBRATO PITCH MODULATOR
                </span>
                <p>• <b className="text-white">Vibrato Intensity</b> (0 - 100%): Modulates pitch detune in real-time up to ±100 cents (1 full semitone).</p>
                <p>• <b className="text-white">Configurable Rate</b> (0.5 - 16.0 Hz): Adjusts the modulation speed from slow warm analog drift to fast chiptune trill.</p>
                <p>• <b className="text-white">LFO Waveform Shapes</b>: Select between Sine (analog glide), Triangle (linear retro), Square (bipolar trill), or Sawtooth (ramp dive).</p>
                <p>• Live 60FPS visualizer dynamically illustrates the exact LFO pitch modulation wave.</p>
              </div>

              <div className="bg-[#0f1118] p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-nes text-[10px] text-amber-300 block mb-1">
                  ⚡ 8-BIT ARPEGGIATOR & GAMEPAD D-PAD
                </span>
                <p>• <b className="text-white">D-Pad Up / Down</b> (<kbd className="px-1 bg-slate-800 rounded">W / S</kbd>): Increase or decrease arpeggiator speed (1/8, 1/16, 1/32, or 60Hz NES Macro).</p>
                <p>• <b className="text-white">D-Pad Left / Right</b> (<kbd className="px-1 bg-slate-800 rounded">A / D</kbd>): Cycle arpeggio chords and scales (Major, Minor, Dom7, Pentatonic, Hirajoshi, Octaves, Held).</p>
                <p>• <b className="text-white">D-Pad Mode Toggle</b>: Switch the controller D-Pad between standard Octave/Duty mode and Arpeggiator mode.</p>
                <p>• Hold any keys on the keyboard or press Gamepad A/B to cycle the arpeggio sequence!</p>
              </div>

              <div className="bg-[#0f1118] p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-nes text-[10px] text-rose-400 block mb-1">
                  1. GAMEPAD PERFORMANCE MAPPINGS
                </span>
                <p>• <b className="text-white">Button A</b> (<kbd className="px-1 bg-slate-800 rounded">X / K</kbd>): Trigger active lead note / arpeggiator root.</p>
                <p>• <b className="text-white">Button B</b> (<kbd className="px-1 bg-slate-800 rounded">Z / J</kbd>): Trigger sub-bass / percussive noise strike.</p>
                <p>• <b className="text-white">Turbo A / Turbo B</b> (<kbd className="px-1 bg-slate-800 rounded">V / C</kbd>): Rapid 16th-note continuous retriggers with flashing strobe LED.</p>
                <p>• <b className="text-white">Select Button</b> (<kbd className="px-1 bg-slate-800 rounded">Tab</kbd>): Cycle hardware channel (Pulse 1, Pulse 2, Triangle, Noise).</p>
                <p>• <b className="text-white">Start Button</b> (<kbd className="px-1 bg-slate-800 rounded">Enter</kbd>): Start / Pause the 16-step chiptune tracker.</p>
              </div>

              <div className="bg-[#0f1118] p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-nes text-[10px] text-amber-400 block mb-1">
                  2. 25-KEY PIANO KEYBOARD SHORTCUTS
                </span>
                <p>White keys map naturally across your computer keyboard: <kbd className="px-1 bg-slate-800 rounded">A, S, D, F, G, H, J, K, L, ;</kbd></p>
                <p>Black accidentals / sharps: <kbd className="px-1 bg-slate-800 rounded">W, E, T, Y, U, O, P</kbd></p>
                <p>Touch & drag across keys for retro 8-bit glissando sweeps!</p>
              </div>

              <div className="bg-[#0f1118] p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-nes text-[10px] text-emerald-400 block mb-1">
                  3. HARDWARE USB GAMEPAD SUPPORT
                </span>
                <p>Plug in any USB or Bluetooth gamepad (NES replica, Xbox, PlayStation, Switch Pro). It is automatically recognized with physical D-pad and button response!</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-nes cursor-pointer"
              >
                GOT IT, LET'S PLAY!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-slate-900 text-center text-xs text-slate-600 font-retro-mono">
        <p>NES Ricoh 2A03 APU Waveform Synthesizer · 1985–2026 Chiptune Engine</p>
      </footer>
    </div>
  );
}
