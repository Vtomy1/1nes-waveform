import React, { useEffect, useState, useRef, useCallback } from 'react';
import { DutyCycle, ChannelType, ArpRate, ArpChordScale } from '../audio/nesAudioEngine';

interface NesGamepadProps {
  currentChannel: ChannelType;
  dutyCycle: DutyCycle;
  octaveOffset: number;
  isSequencerPlaying: boolean;
  arpEnabled?: boolean;
  dpadMode?: 'standard' | 'arpeggiator';
  arpRate?: ArpRate;
  arpChordScale?: ArpChordScale;
  onDpadModeToggle?: () => void;
  onDpadArpControl?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onChannelChange: (channel: ChannelType) => void;
  onDutyCycleChange: (duty: DutyCycle) => void;
  onOctaveChange: (delta: number) => void;
  onToggleSequencer: () => void;
  onTriggerActionA: (isPressed: boolean) => void;
  onTriggerActionB: (isPressed: boolean) => void;
  onTriggerTurboA: (isPressed: boolean) => void;
  onTriggerTurboB: (isPressed: boolean) => void;
}

export const NesGamepad: React.FC<NesGamepadProps> = ({
  currentChannel,
  dutyCycle,
  octaveOffset,
  isSequencerPlaying,
  arpEnabled = false,
  dpadMode = 'standard',
  arpRate = '1/16',
  arpChordScale = 'major',
  onDpadModeToggle,
  onDpadArpControl,
  onChannelChange,
  onDutyCycleChange,
  onOctaveChange,
  onToggleSequencer,
  onTriggerActionA,
  onTriggerActionB,
  onTriggerTurboA,
  onTriggerTurboB,
}) => {
  // Pressed states for visual feedback
  const [pressedButtons, setPressedButtons] = useState<{ [key: string]: boolean }>({});
  const [connectedGamepadName, setConnectedGamepadName] = useState<string | null>(null);
  const [turboActiveA, setTurboActiveA] = useState(false);
  const [turboActiveB, setTurboActiveB] = useState(false);
  const [turboStrobe, setTurboStrobe] = useState(false);

  const prevGamepadButtonsRef = useRef<{ [key: number]: boolean }>({});

  // Turbo LED strobe effect
  useEffect(() => {
    if (turboActiveA || turboActiveB) {
      const interval = window.setInterval(() => {
        setTurboStrobe((prev) => !prev);
      }, 75);
      return () => clearInterval(interval);
    } else {
      setTurboStrobe(false);
    }
  }, [turboActiveA, turboActiveB]);

  const setBtn = useCallback((btn: string, isDown: boolean) => {
    setPressedButtons((prev) => ({ ...prev, [btn]: isDown }));
  }, []);

  // Duty cycles list
  const duties: DutyCycle[] = ['12.5%', '25%', '50%', '75%'];
  const cycleDuty = useCallback(
    (step: number) => {
      const idx = duties.indexOf(dutyCycle);
      const nextIdx = (idx + step + duties.length) % duties.length;
      onDutyCycleChange(duties[nextIdx]);
    },
    [dutyCycle, onDutyCycleChange]
  );

  // Channel list
  const channels: ChannelType[] = ['pulse1', 'pulse2', 'triangle', 'noise'];
  const cycleChannel = useCallback(() => {
    const idx = channels.indexOf(currentChannel);
    const nextIdx = (idx + 1) % channels.length;
    onChannelChange(channels[nextIdx]);
  }, [currentChannel, onChannelChange]);

  // Handle D-Pad actions according to current dpadMode
  const handleDpadUp = useCallback(() => {
    if (dpadMode === 'arpeggiator' && onDpadArpControl) {
      onDpadArpControl('up');
    } else {
      onOctaveChange(1);
    }
  }, [dpadMode, onDpadArpControl, onOctaveChange]);

  const handleDpadDown = useCallback(() => {
    if (dpadMode === 'arpeggiator' && onDpadArpControl) {
      onDpadArpControl('down');
    } else {
      onOctaveChange(-1);
    }
  }, [dpadMode, onDpadArpControl, onOctaveChange]);

  const handleDpadLeft = useCallback(() => {
    if (dpadMode === 'arpeggiator' && onDpadArpControl) {
      onDpadArpControl('left');
    } else {
      cycleDuty(-1);
    }
  }, [dpadMode, onDpadArpControl, cycleDuty]);

  const handleDpadRight = useCallback(() => {
    if (dpadMode === 'arpeggiator' && onDpadArpControl) {
      onDpadArpControl('right');
    } else {
      cycleDuty(1);
    }
  }, [dpadMode, onDpadArpControl, cycleDuty]);

  // Physical Gamepad API polling loop
  useEffect(() => {
    const handleGamepadConnected = (e: GamepadEvent) => {
      setConnectedGamepadName(e.gamepad.id);
    };

    const handleGamepadDisconnected = () => {
      setConnectedGamepadName(null);
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    let animationFrameId: number;
    const pollGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads[0];

      if (gp) {
        if (!connectedGamepadName) {
          setConnectedGamepadName(gp.id);
        }

        const prev = prevGamepadButtonsRef.current;
        const currentButtons: { [key: number]: boolean } = {};

        // D-Pad Up (Button 12)
        if (gp.buttons[12]?.pressed && !prev[12]) {
          handleDpadUp();
          setBtn('up', true);
        } else if (!gp.buttons[12]?.pressed && prev[12]) {
          setBtn('up', false);
        }

        // D-Pad Down (Button 13)
        if (gp.buttons[13]?.pressed && !prev[13]) {
          handleDpadDown();
          setBtn('down', true);
        } else if (!gp.buttons[13]?.pressed && prev[13]) {
          setBtn('down', false);
        }

        // D-Pad Left (Button 14)
        if (gp.buttons[14]?.pressed && !prev[14]) {
          handleDpadLeft();
          setBtn('left', true);
        } else if (!gp.buttons[14]?.pressed && prev[14]) {
          setBtn('left', false);
        }

        // D-Pad Right (Button 15)
        if (gp.buttons[15]?.pressed && !prev[15]) {
          handleDpadRight();
          setBtn('right', true);
        } else if (!gp.buttons[15]?.pressed && prev[15]) {
          setBtn('right', false);
        }

        // Button A (Standard button 0)
        if (gp.buttons[0]?.pressed !== prev[0]) {
          const down = !!gp.buttons[0]?.pressed;
          onTriggerActionA(down);
          setBtn('a', down);
        }

        // Button B (Standard button 1)
        if (gp.buttons[1]?.pressed !== prev[1]) {
          const down = !!gp.buttons[1]?.pressed;
          onTriggerActionB(down);
          setBtn('b', down);
        }

        // Select (Button 8)
        if (gp.buttons[8]?.pressed && !prev[8]) {
          cycleChannel();
          setBtn('select', true);
        } else if (!gp.buttons[8]?.pressed && prev[8]) {
          setBtn('select', false);
        }

        // Start (Button 9)
        if (gp.buttons[9]?.pressed && !prev[9]) {
          onToggleSequencer();
          setBtn('start', true);
        } else if (!gp.buttons[9]?.pressed && prev[9]) {
          setBtn('start', false);
        }

        gp.buttons.forEach((b, i) => {
          currentButtons[i] = b.pressed;
        });
        prevGamepadButtonsRef.current = currentButtons;
      }

      animationFrameId = requestAnimationFrame(pollGamepad);
    };

    animationFrameId = requestAnimationFrame(pollGamepad);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    connectedGamepadName,
    handleDpadUp,
    handleDpadDown,
    handleDpadLeft,
    handleDpadRight,
    onTriggerActionA,
    onTriggerActionB,
    cycleChannel,
    onToggleSequencer,
    setBtn,
  ]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const code = e.code;
      if (code === 'ArrowUp' || code === 'KeyW') {
        if (!pressedButtons['up']) {
          handleDpadUp();
          setBtn('up', true);
        }
      } else if (code === 'ArrowDown' || code === 'KeyS') {
        if (!pressedButtons['down']) {
          handleDpadDown();
          setBtn('down', true);
        }
      } else if (code === 'ArrowLeft' || code === 'KeyA') {
        if (!pressedButtons['left']) {
          handleDpadLeft();
          setBtn('left', true);
        }
      } else if (code === 'ArrowRight' || code === 'KeyD') {
        if (!pressedButtons['right']) {
          handleDpadRight();
          setBtn('right', true);
        }
      } else if (code === 'KeyZ' || code === 'KeyJ') {
        if (!pressedButtons['b']) {
          onTriggerActionB(true);
          setBtn('b', true);
        }
      } else if (code === 'KeyX' || code === 'KeyK') {
        if (!pressedButtons['a']) {
          onTriggerActionA(true);
          setBtn('a', true);
        }
      } else if (code === 'KeyC') {
        if (!pressedButtons['turboB']) {
          setTurboActiveB(true);
          onTriggerTurboB(true);
          setBtn('turboB', true);
        }
      } else if (code === 'KeyV') {
        if (!pressedButtons['turboA']) {
          setTurboActiveA(true);
          onTriggerTurboA(true);
          setBtn('turboA', true);
        }
      } else if (code === 'Tab' || code === 'Backspace') {
        e.preventDefault();
        if (!pressedButtons['select']) {
          cycleChannel();
          setBtn('select', true);
        }
      } else if (code === 'Enter') {
        e.preventDefault();
        if (!pressedButtons['start']) {
          onToggleSequencer();
          setBtn('start', true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      const code = e.code;

      if (code === 'ArrowUp' || code === 'KeyW') setBtn('up', false);
      else if (code === 'ArrowDown' || code === 'KeyS') setBtn('down', false);
      else if (code === 'ArrowLeft' || code === 'KeyA') setBtn('left', false);
      else if (code === 'ArrowRight' || code === 'KeyD') setBtn('right', false);
      else if (code === 'KeyZ' || code === 'KeyJ') {
        onTriggerActionB(false);
        setBtn('b', false);
      } else if (code === 'KeyX' || code === 'KeyK') {
        onTriggerActionA(false);
        setBtn('a', false);
      } else if (code === 'KeyC') {
        setTurboActiveB(false);
        onTriggerTurboB(false);
        setBtn('turboB', false);
      } else if (code === 'KeyV') {
        setTurboActiveA(false);
        onTriggerTurboA(false);
        setBtn('turboA', false);
      } else if (code === 'Tab' || code === 'Backspace') setBtn('select', false);
      else if (code === 'Enter') setBtn('start', false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    pressedButtons,
    handleDpadUp,
    handleDpadDown,
    handleDpadLeft,
    handleDpadRight,
    onTriggerActionA,
    onTriggerActionB,
    onTriggerTurboA,
    onTriggerTurboB,
    cycleChannel,
    onToggleSequencer,
    setBtn,
  ]);

  return (
    <div className="relative w-full max-w-4xl mx-auto select-none">
      {/* Molded Controller Body */}
      <div className="relative bg-[#c8c9ce] border-4 border-[#9498a3] rounded-2xl p-4 sm:p-7 shadow-[0_12px_32px_rgba(0,0,0,0.65),inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-4px_6px_rgba(0,0,0,0.3)]">
        
        {/* Recessed Dark Center Plate */}
        <div className="relative bg-[#1a1c23] rounded-xl p-4 sm:p-6 border-2 border-[#121318] shadow-[inset_0_4px_12px_rgba(0,0,0,0.9),0_1px_2px_rgba(255,255,255,0.3)]">
          
          {/* Authentic NES Controller Top Header */}
          <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#2d313d] mb-5 gap-3">
            <div className="flex items-center gap-3">
              <span className="font-nes text-sm sm:text-base tracking-widest text-[#e11d48] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                Nintendo
              </span>
              <span className="font-retro-mono text-xs text-slate-400 font-semibold tracking-wider">
                ENTERTAINMENT SYSTEM™
              </span>
            </div>

            {/* D-Pad Mode Selector & USB Status */}
            <div className="flex items-center gap-2 text-xs font-retro-mono">
              {/* D-Pad Mode Toggle */}
              {onDpadModeToggle && (
                <button
                  type="button"
                  onClick={onDpadModeToggle}
                  className={`px-2.5 py-1 rounded text-[10px] font-nes cursor-pointer transition-colors border ${
                    dpadMode === 'arpeggiator'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                      : 'bg-[#2b303c] text-slate-300 border-slate-600 hover:text-white'
                  }`}
                  title="Switch D-Pad between Octave/Duty and Arpeggiator Rate/Scale"
                >
                  {dpadMode === 'arpeggiator' ? '⚡ D-PAD: ARPEGGIATOR' : '🎮 D-PAD: OCTAVE/DUTY'}
                </button>
              )}

              {connectedGamepadName ? (
                <span className="text-emerald-400 text-[10px] bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
                  USB GAMEPAD READY
                </span>
              ) : (
                <span className="text-slate-400 text-[10px] bg-slate-800/80 px-2 py-0.5 rounded">
                  KEYBOARD / TOUCH ACTIVE
                </span>
              )}
            </div>
          </div>

          {/* Main Controls Row: D-Pad | Center Select/Start | Action Buttons A/B + Turbo */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* ZONE 1: Directional Pad (Left) */}
            <div className="md:col-span-4 flex flex-col items-center">
              <div className="text-[10px] font-nes text-slate-400 mb-2 tracking-wider">
                {dpadMode === 'arpeggiator' ? 'ARPEGGIATOR D-PAD' : 'OCTAVE & DUTY PAD'}
              </div>

              {/* D-Pad Cross */}
              <div className="relative w-36 h-36 bg-[#16181f] rounded-full p-2 border border-slate-700/60 shadow-[inset_0_2px_8px_rgba(0,0,0,0.9)] flex items-center justify-center">
                {/* Horizontal Bar */}
                <div className="absolute w-32 h-10 bg-[#2b303c] rounded-md shadow-[0_4px_6px_rgba(0,0,0,0.8)]"></div>
                {/* Vertical Bar */}
                <div className="absolute w-10 h-32 bg-[#2b303c] rounded-md shadow-[0_4px_6px_rgba(0,0,0,0.8)]"></div>
                
                {/* Center Pivot Ring */}
                <div className="absolute w-6 h-6 rounded-full bg-[#1e222b] border border-slate-600/50 shadow-inner z-10 flex items-center justify-center">
                  <div className={`w-2.5 h-2.5 rounded-full ${dpadMode === 'arpeggiator' ? 'bg-amber-400 animate-pulse' : 'bg-[#12141a]'}`}></div>
                </div>

                {/* UP: Faster Rate or Octave Up */}
                <button
                  type="button"
                  onMouseDown={() => { handleDpadUp(); setBtn('up', true); }}
                  onMouseUp={() => setBtn('up', false)}
                  onMouseLeave={() => setBtn('up', false)}
                  className={`absolute top-2 w-10 h-11 dpad-btn rounded-t-sm z-20 flex flex-col items-center justify-start pt-1.5 cursor-pointer text-slate-300 text-xs ${
                    pressedButtons['up'] ? 'active' : ''
                  }`}
                  title={dpadMode === 'arpeggiator' ? 'Faster Arp Rate (Key: W / ArrowUp)' : 'Octave Up (Key: W / ArrowUp)'}
                >
                  <span className="text-[10px] font-bold">▲</span>
                  {dpadMode === 'arpeggiator' && <span className="text-[7px] text-amber-300">SPD+</span>}
                </button>

                {/* DOWN: Slower Rate or Octave Down */}
                <button
                  type="button"
                  onMouseDown={() => { handleDpadDown(); setBtn('down', true); }}
                  onMouseUp={() => setBtn('down', false)}
                  onMouseLeave={() => setBtn('down', false)}
                  className={`absolute bottom-2 w-10 h-11 dpad-btn rounded-b-sm z-20 flex flex-col items-center justify-end pb-1.5 cursor-pointer text-slate-300 text-xs ${
                    pressedButtons['down'] ? 'active' : ''
                  }`}
                  title={dpadMode === 'arpeggiator' ? 'Slower Arp Rate (Key: S / ArrowDown)' : 'Octave Down (Key: S / ArrowDown)'}
                >
                  {dpadMode === 'arpeggiator' && <span className="text-[7px] text-amber-300">SPD-</span>}
                  <span className="text-[10px] font-bold">▼</span>
                </button>

                {/* LEFT: Previous Scale or Duty Cycle Prev */}
                <button
                  type="button"
                  onMouseDown={() => { handleDpadLeft(); setBtn('left', true); }}
                  onMouseUp={() => setBtn('left', false)}
                  onMouseLeave={() => setBtn('left', false)}
                  className={`absolute left-2 w-11 h-10 dpad-btn rounded-l-sm z-20 flex items-center justify-start pl-1.5 cursor-pointer text-slate-300 text-xs ${
                    pressedButtons['left'] ? 'active' : ''
                  }`}
                  title={dpadMode === 'arpeggiator' ? 'Previous Scale (Key: A / ArrowLeft)' : 'Previous Waveform / Duty (Key: A / ArrowLeft)'}
                >
                  <span className="text-[10px] font-bold">◀</span>
                </button>

                {/* RIGHT: Next Scale or Duty Cycle Next */}
                <button
                  type="button"
                  onMouseDown={() => { handleDpadRight(); setBtn('right', true); }}
                  onMouseUp={() => setBtn('right', false)}
                  onMouseLeave={() => setBtn('right', false)}
                  className={`absolute right-2 w-11 h-10 dpad-btn rounded-r-sm z-20 flex items-center justify-end pr-1.5 cursor-pointer text-slate-300 text-xs ${
                    pressedButtons['right'] ? 'active' : ''
                  }`}
                  title={dpadMode === 'arpeggiator' ? 'Next Scale (Key: D / ArrowRight)' : 'Next Waveform / Duty (Key: D / ArrowRight)'}
                >
                  <span className="text-[10px] font-bold">▶</span>
                </button>
              </div>

              {/* D-Pad Labels Dynamic Readout */}
              <div className="flex items-center gap-2 mt-3 text-[10px] font-retro-mono text-slate-400 text-center">
                {dpadMode === 'arpeggiator' ? (
                  <>
                    <span className="text-emerald-400 font-bold">RATE: {arpRate}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-400 font-bold uppercase">{arpChordScale}</span>
                  </>
                ) : (
                  <>
                    <span>OCT: {octaveOffset >= 0 ? `+${octaveOffset}` : octaveOffset}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-400 font-bold">{dutyCycle}</span>
                  </>
                )}
              </div>
            </div>

            {/* ZONE 2: Center Rubber Pill Buttons (Select / Start) */}
            <div className="md:col-span-4 flex flex-col items-center justify-center">
              <div className="flex items-center gap-6 sm:gap-8 bg-[#13141a] px-6 py-4 rounded-xl border border-slate-800 shadow-inner">
                {/* SELECT BUTTON */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onMouseDown={() => { cycleChannel(); setBtn('select', true); }}
                    onMouseUp={() => setBtn('select', false)}
                    onMouseLeave={() => setBtn('select', false)}
                    className={`w-12 h-5 bg-[#3b4252] rounded-full border border-[#2e3440] shadow-[0_3px_0_#1e222b,inset_0_1px_1px_rgba(255,255,255,0.2)] cursor-pointer transition-transform ${
                      pressedButtons['select'] ? 'translate-y-1 shadow-[0_1px_0_#1e222b]' : ''
                    }`}
                    title="Switch APU Channel (Key: Tab)"
                  />
                  <span className="font-nes text-[9px] text-[#e11d48] mt-2 tracking-wider">
                    SELECT
                  </span>
                  <span className="font-retro-mono text-[9px] text-slate-400 uppercase mt-0.5">
                    {currentChannel}
                  </span>
                </div>

                {/* START BUTTON */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onMouseDown={() => { onToggleSequencer(); setBtn('start', true); }}
                    onMouseUp={() => setBtn('start', false)}
                    onMouseLeave={() => setBtn('start', false)}
                    className={`w-12 h-5 bg-[#3b4252] rounded-full border border-[#2e3440] shadow-[0_3px_0_#1e222b,inset_0_1px_1px_rgba(255,255,255,0.2)] cursor-pointer transition-transform ${
                      pressedButtons['start'] ? 'translate-y-1 shadow-[0_1px_0_#1e222b]' : ''
                    }`}
                    title="Toggle Sequencer (Key: Enter)"
                  />
                  <span className="font-nes text-[9px] text-[#e11d48] mt-2 tracking-wider">
                    START
                  </span>
                  <span className={`font-retro-mono text-[9px] font-bold mt-0.5 ${isSequencerPlaying ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {isSequencerPlaying ? 'RUNNING' : 'STOPPED'}
                  </span>
                </div>
              </div>

              {/* Instructions tip */}
              <div className="mt-3 text-[10px] text-slate-400 font-retro-mono text-center">
                Press <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-300">TAB</kbd> Channel · <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-300">ENTER</kbd> Seq
              </div>
            </div>

            {/* ZONE 3: Red Action Buttons (B & A) + TURBO Modifiers */}
            <div className="md:col-span-4 flex flex-col items-center">
              <div className="text-[10px] font-nes text-slate-400 mb-2 tracking-wider">
                ACTION & TURBO
              </div>

              <div className="bg-[#13141a] p-4 rounded-xl border border-slate-800 shadow-inner flex flex-col gap-3">
                {/* Turbo Row */}
                <div className="flex items-center justify-center gap-6">
                  {/* Turbo B */}
                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      onMouseDown={() => { setTurboActiveB(true); onTriggerTurboB(true); setBtn('turboB', true); }}
                      onMouseUp={() => { setTurboActiveB(false); onTriggerTurboB(false); setBtn('turboB', false); }}
                      onMouseLeave={() => { setTurboActiveB(false); onTriggerTurboB(false); setBtn('turboB', false); }}
                      className={`w-10 h-10 rounded-full btn-nes-red cursor-pointer flex items-center justify-center ${
                        pressedButtons['turboB'] ? 'active' : ''
                      }`}
                      title="Turbo B Rapid Strike (Key: C)"
                    >
                      <div className={`w-2 h-2 rounded-full ${turboActiveB && turboStrobe ? 'bg-amber-300 shadow-[0_0_8px_#fde047]' : 'bg-red-950'}`}></div>
                    </button>
                    <span className="font-retro-mono text-[9px] text-amber-400 font-semibold mt-1">TURBO B</span>
                  </div>

                  {/* Turbo A */}
                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      onMouseDown={() => { setTurboActiveA(true); onTriggerTurboA(true); setBtn('turboA', true); }}
                      onMouseUp={() => { setTurboActiveA(false); onTriggerTurboA(false); setBtn('turboA', false); }}
                      onMouseLeave={() => { setTurboActiveA(false); onTriggerTurboA(false); setBtn('turboA', false); }}
                      className={`w-10 h-10 rounded-full btn-nes-red cursor-pointer flex items-center justify-center ${
                        pressedButtons['turboA'] ? 'active' : ''
                      }`}
                      title="Turbo A Rapid Strike (Key: V)"
                    >
                      <div className={`w-2 h-2 rounded-full ${turboActiveA && turboStrobe ? 'bg-amber-300 shadow-[0_0_8px_#fde047]' : 'bg-red-950'}`}></div>
                    </button>
                    <span className="font-retro-mono text-[9px] text-amber-400 font-semibold mt-1">TURBO A</span>
                  </div>
                </div>

                {/* Primary B & A Action Buttons */}
                <div className="flex items-center justify-center gap-6 pt-1">
                  {/* BUTTON B */}
                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      onMouseDown={() => { onTriggerActionB(true); setBtn('b', true); }}
                      onMouseUp={() => { onTriggerActionB(false); setBtn('b', false); }}
                      onMouseLeave={() => { onTriggerActionB(false); setBtn('b', false); }}
                      className={`w-12 h-12 rounded-full btn-nes-red cursor-pointer flex items-center justify-center text-white font-nes text-xs ${
                        pressedButtons['b'] ? 'active' : ''
                      }`}
                      title="Action B: Sub-Bass / Hit (Key: Z / J)"
                    >
                      B
                    </button>
                    <span className="font-nes text-[10px] text-[#e11d48] mt-1.5 font-bold">B</span>
                    <span className="font-retro-mono text-[8px] text-slate-500">
                      {arpEnabled ? 'ARP BASS' : 'SUB / NOISE'}
                    </span>
                  </div>

                  {/* BUTTON A */}
                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      onMouseDown={() => { onTriggerActionA(true); setBtn('a', true); }}
                      onMouseUp={() => { onTriggerActionA(false); setBtn('a', false); }}
                      onMouseLeave={() => { onTriggerActionA(false); setBtn('a', false); }}
                      className={`w-12 h-12 rounded-full btn-nes-red cursor-pointer flex items-center justify-center text-white font-nes text-xs ${
                        pressedButtons['a'] ? 'active' : ''
                      }`}
                      title="Action A: Trigger Lead Note / Arp (Key: X / K)"
                    >
                      A
                    </button>
                    <span className="font-nes text-[10px] text-[#e11d48] mt-1.5 font-bold">A</span>
                    <span className="font-retro-mono text-[8px] text-slate-500">
                      {arpEnabled ? 'ARP TRIGGER' : 'LEAD GATE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action shortcut text */}
              <div className="mt-2 text-[10px] text-slate-400 font-retro-mono text-center">
                Keys: <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-300">Z</kbd> B · <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-300">X</kbd> A
              </div>
            </div>

          </div>

          {/* Controller Bottom Bevel Stripe */}
          <div className="mt-5 pt-3 border-t border-[#252834] flex flex-wrap items-center justify-between text-[11px] font-retro-mono text-slate-400">
            <div>
              <span>RICOH 2A03 APU EMULATOR</span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span>1.789773 MHz NTSC CLOCK</span>
            </div>
            <div className="text-slate-500">
              {arpEnabled ? '⚡ ARPEGGIATOR D-PAD LINK READY' : 'PHYSICAL CONTROLLERS AUTO-DETECTED'}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
