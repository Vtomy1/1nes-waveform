import React, { useEffect, useCallback, useState } from 'react';

interface KeyDef {
  note: string;
  baseMidi: number; // For octave 0 baseline (e.g. C4 = 60)
  isBlack: boolean;
  keyBinding?: string;
  keyCode?: string;
}

const PIANO_KEYS: KeyDef[] = [
  { note: 'C', baseMidi: 48, isBlack: false, keyBinding: 'A', keyCode: 'KeyA' },
  { note: 'C#', baseMidi: 49, isBlack: true, keyBinding: 'W', keyCode: 'KeyW' },
  { note: 'D', baseMidi: 50, isBlack: false, keyBinding: 'S', keyCode: 'KeyS' },
  { note: 'D#', baseMidi: 51, isBlack: true, keyBinding: 'E', keyCode: 'KeyE' },
  { note: 'E', baseMidi: 52, isBlack: false, keyBinding: 'D', keyCode: 'KeyD' },
  { note: 'F', baseMidi: 53, isBlack: false, keyBinding: 'F', keyCode: 'KeyF' },
  { note: 'F#', baseMidi: 54, isBlack: true, keyBinding: 'T', keyCode: 'KeyT' },
  { note: 'G', baseMidi: 55, isBlack: false, keyBinding: 'G', keyCode: 'KeyG' },
  { note: 'G#', baseMidi: 56, isBlack: true, keyBinding: 'Y', keyCode: 'KeyY' },
  { note: 'A', baseMidi: 57, isBlack: false, keyBinding: 'H', keyCode: 'KeyH' },
  { note: 'A#', baseMidi: 58, isBlack: true, keyBinding: 'U', keyCode: 'KeyU' },
  { note: 'B', baseMidi: 59, isBlack: false, keyBinding: 'J', keyCode: 'KeyJ' },
  { note: 'C', baseMidi: 60, isBlack: false, keyBinding: 'K', keyCode: 'KeyK' },
  { note: 'C#', baseMidi: 61, isBlack: true, keyBinding: 'O', keyCode: 'KeyO' },
  { note: 'D', baseMidi: 62, isBlack: false, keyBinding: 'L', keyCode: 'KeyL' },
  { note: 'D#', baseMidi: 63, isBlack: true, keyBinding: 'P', keyCode: 'KeyP' },
  { note: 'E', baseMidi: 64, isBlack: false, keyBinding: ';', keyCode: 'Semicolon' },
  { note: 'F', baseMidi: 65, isBlack: false, keyBinding: '\'', keyCode: 'Quote' },
  { note: 'F#', baseMidi: 66, isBlack: true },
  { note: 'G', baseMidi: 67, isBlack: false },
  { note: 'G#', baseMidi: 68, isBlack: true },
  { note: 'A', baseMidi: 69, isBlack: false },
  { note: 'A#', baseMidi: 70, isBlack: true },
  { note: 'B', baseMidi: 71, isBlack: false },
  { note: 'C', baseMidi: 72, isBlack: false },
];

interface NesKeyboardProps {
  octaveOffset: number;
  activeMidiNotes: Set<number>;
  onNoteDown: (midi: number, noteName: string) => void;
  onNoteUp: (midi: number) => void;
}

export const NesKeyboard: React.FC<NesKeyboardProps> = ({
  octaveOffset,
  activeMidiNotes,
  onNoteDown,
  onNoteUp,
}) => {
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Global mouse up handler so dragging off keys releases notes
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsMouseDown(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Computer keyboard bindings for piano keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.repeat) return; // Ignore repeat events for clean note trigger

      const keyDef = PIANO_KEYS.find((k) => k.keyCode === e.code);
      if (keyDef) {
        const actualMidi = keyDef.baseMidi + octaveOffset * 12;
        const octaveNum = Math.floor(actualMidi / 12) - 1;
        const fullNoteName = `${keyDef.note}${octaveNum}`;
        onNoteDown(actualMidi, fullNoteName);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      const keyDef = PIANO_KEYS.find((k) => k.keyCode === e.code);
      if (keyDef) {
        const actualMidi = keyDef.baseMidi + octaveOffset * 12;
        onNoteUp(actualMidi);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [octaveOffset, onNoteDown, onNoteUp]);

  const handleKeyInteractionStart = useCallback(
    (midi: number, noteName: string) => {
      setIsMouseDown(true);
      onNoteDown(midi, noteName);
    },
    [onNoteDown]
  );

  const handleKeyInteractionEnter = useCallback(
    (midi: number, noteName: string) => {
      if (isMouseDown) {
        onNoteDown(midi, noteName);
      }
    },
    [isMouseDown, onNoteDown]
  );

  const handleKeyInteractionLeave = useCallback(
    (midi: number) => {
      if (isMouseDown) {
        onNoteUp(midi);
      }
    },
    [isMouseDown, onNoteUp]
  );

  const handleKeyInteractionEnd = useCallback(
    (midi: number) => {
      onNoteUp(midi);
    },
    [onNoteUp]
  );

  // Split into white and black keys layout
  const whiteKeys = PIANO_KEYS.filter((k) => !k.isBlack);

  return (
    <div className="w-full bg-[#181a22] rounded-xl p-4 sm:p-5 border-2 border-[#2b303c] shadow-[0_12px_24px_rgba(0,0,0,0.6)]">
      {/* Keyboard Header / Status Strip */}
      <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-slate-800 text-xs font-retro-mono">
        <div className="flex items-center gap-2">
          <span className="font-nes text-[11px] text-amber-400">25-KEY APU WAVEFORM KEYBOARD</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">POLYPHONIC & LEGATO SLIDE</span>
        </div>
        <div className="flex items-center gap-3 text-slate-400 text-[11px]">
          <span>OCTAVE: C{Math.floor((48 + octaveOffset * 12) / 12) - 1} - C{Math.floor((72 + octaveOffset * 12) / 12) - 1}</span>
          <span className="text-slate-500">·</span>
          <span className="text-emerald-400">
            {activeMidiNotes.size > 0 ? `${activeMidiNotes.size} VOICE ACTIVE` : 'READY'}
          </span>
        </div>
      </div>

      {/* Piano Keys Container */}
      <div className="relative w-full h-44 sm:h-52 bg-[#0d0e12] p-2 rounded-lg border border-slate-800 flex justify-center select-none overflow-x-auto">
        <div className="relative flex h-full">
          {/* Render White Keys */}
          {whiteKeys.map((k) => {
            const actualMidi = k.baseMidi + octaveOffset * 12;
            const octaveNum = Math.floor(actualMidi / 12) - 1;
            const fullNoteName = `${k.note}${octaveNum}`;
            const isActive = activeMidiNotes.has(actualMidi);

            return (
              <div
                key={`white-${actualMidi}`}
                onMouseDown={() => handleKeyInteractionStart(actualMidi, fullNoteName)}
                onMouseEnter={() => handleKeyInteractionEnter(actualMidi, fullNoteName)}
                onMouseLeave={() => handleKeyInteractionLeave(actualMidi)}
                onMouseUp={() => handleKeyInteractionEnd(actualMidi)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleKeyInteractionStart(actualMidi, fullNoteName);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleKeyInteractionEnd(actualMidi);
                }}
                className={`relative w-8 sm:w-11 h-full mx-[1px] rounded-b-md cursor-pointer transition-colors duration-75 flex flex-col justify-end items-center pb-2 z-10 ${
                  isActive
                    ? 'bg-amber-200 border-2 border-amber-500 shadow-[inset_0_-8px_12px_rgba(245,158,11,0.5),0_2px_4px_rgba(0,0,0,0.6)]'
                    : 'bg-[#f4f4f5] hover:bg-slate-100 border-b-4 border-r border-l border-slate-300 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.1),0_4px_6px_rgba(0,0,0,0.5)]'
                }`}
              >
                {/* Key Note Label */}
                <span className={`text-[10px] font-nes font-bold ${isActive ? 'text-amber-900' : 'text-slate-700'}`}>
                  {fullNoteName}
                </span>

                {/* Computer key binding badge */}
                {k.keyBinding && (
                  <span
                    className={`text-[8px] font-retro-mono font-semibold px-1 py-0.5 rounded mt-1 ${
                      isActive ? 'bg-amber-400 text-amber-950' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {k.keyBinding}
                  </span>
                )}
              </div>
            );
          })}

          {/* Render Black Keys as Absolutely Positioned Overlays */}
          {PIANO_KEYS.map((k) => {
            if (!k.isBlack) return null;
            const actualMidi = k.baseMidi + octaveOffset * 12;
            const octaveNum = Math.floor(actualMidi / 12) - 1;
            const fullNoteName = `${k.note}${octaveNum}`;
            const isActive = activeMidiNotes.has(actualMidi);

            // Compute horizontal offset based on which white note preceded it
            // Indices of white keys: C(0), D(1), E(2), F(3), G(4), A(5), B(6), C(7)...
            const whiteKeyIndex = whiteKeys.findIndex((wk) => wk.baseMidi === k.baseMidi - 1);
            if (whiteKeyIndex === -1) return null;

            // In percentage of white keys: each white key has a width
            // Standard placement: offset from white key right edge
            return (
              <div
                key={`black-${actualMidi}`}
                style={{
                  left: `calc(${whiteKeyIndex * 100 / whiteKeys.length}% + ${100 / whiteKeys.length * 0.65}%)`,
                  width: `calc(${100 / whiteKeys.length * 0.7}%)`,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleKeyInteractionStart(actualMidi, fullNoteName);
                }}
                onMouseEnter={() => handleKeyInteractionEnter(actualMidi, fullNoteName)}
                onMouseLeave={() => handleKeyInteractionLeave(actualMidi)}
                onMouseUp={() => handleKeyInteractionEnd(actualMidi)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyInteractionStart(actualMidi, fullNoteName);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleKeyInteractionEnd(actualMidi);
                }}
                className={`absolute top-0 h-[62%] rounded-b-md cursor-pointer z-20 flex flex-col justify-end items-center pb-2 transition-transform duration-75 ${
                  isActive
                    ? 'bg-amber-500 border border-amber-300 shadow-[0_0_12px_#f59e0b,inset_0_-4px_6px_rgba(0,0,0,0.5)] scale-y-95'
                    : 'bg-[#18191f] border-b-4 border-black hover:bg-[#252834] shadow-[0_4px_8px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.2)]'
                }`}
              >
                <span className={`text-[9px] font-nes ${isActive ? 'text-slate-950 font-bold' : 'text-slate-300'}`}>
                  {fullNoteName}
                </span>
                {k.keyBinding && (
                  <span
                    className={`text-[8px] font-retro-mono px-1 py-0.2 rounded mt-1 ${
                      isActive ? 'bg-amber-900 text-amber-200' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {k.keyBinding}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Play Instructions */}
      <div className="flex flex-wrap items-center justify-between mt-3 text-[11px] font-retro-mono text-slate-400">
        <div>
          <span>PLAY VIA KEYS: <kbd className="text-slate-300 bg-slate-800 px-1 py-0.5 rounded">A</kbd> TO <kbd className="text-slate-300 bg-slate-800 px-1 py-0.5 rounded">'</kbd></span>
          <span className="mx-2" aria-hidden="true">·</span>
          <span>SHARPS/FLATS: <kbd className="text-slate-300 bg-slate-800 px-1 py-0.5 rounded">W, E, T, Y, U, O, P</kbd></span>
        </div>
        <div className="text-amber-400">
          CLICK OR DRAG KEYS FOR RETRO GLISSANDO
        </div>
      </div>
    </div>
  );
};
