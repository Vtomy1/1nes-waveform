import React, { useEffect, useRef, useState, useCallback } from 'react';
import { nesSynth } from '../audio/nesAudioEngine';
import { SequencerSong, DEMO_SONGS, SequencerTrack } from '../audio/nesPresets';
import { Play, Square, RotateCcw, Volume2, VolumeX } from 'lucide-react';

interface NesSequencerProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export const NesSequencer: React.FC<NesSequencerProps> = ({ isPlaying, onTogglePlay }) => {
  const [currentSong, setCurrentSong] = useState<SequencerSong>(DEMO_SONGS[0]);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [bpm, setBpm] = useState<number>(DEMO_SONGS[0].bpm);
  const [mutedTracks, setMutedTracks] = useState<{ [channel: string]: boolean }>({});

  const isPlayingRef = useRef(isPlaying);
  const bpmRef = useRef(bpm);
  const stepRef = useRef(0);
  const songRef = useRef(currentSong);
  const mutedRef = useRef(mutedTracks);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    songRef.current = currentSong;
  }, [currentSong]);

  useEffect(() => {
    mutedRef.current = mutedTracks;
  }, [mutedTracks]);

  // Load a demo song
  const handleSelectSong = (songId: string) => {
    const selected = DEMO_SONGS.find((s) => s.id === songId);
    if (selected) {
      setCurrentSong(JSON.parse(JSON.stringify(selected)));
      setBpm(selected.bpm);
      setActiveStep(0);
      stepRef.current = 0;
    }
  };

  // Toggle step activation
  const toggleStep = (trackIndex: number, stepIndex: number) => {
    setCurrentSong((prev) => {
      const copy: SequencerSong = JSON.parse(JSON.stringify(prev));
      const step = copy.tracks[trackIndex].steps[stepIndex];
      step.enabled = !step.enabled;
      return copy;
    });
  };

  // Toggle track mute
  const toggleMute = (channel: string) => {
    setMutedTracks((prev) => ({
      ...prev,
      [channel]: !prev[channel],
    }));
  };

  // Clear all steps
  const clearAllSteps = () => {
    setCurrentSong((prev) => {
      const copy: SequencerSong = JSON.parse(JSON.stringify(prev));
      copy.tracks.forEach((track) => {
        track.steps.forEach((step) => {
          step.enabled = false;
        });
      });
      return copy;
    });
  };

  // Sequencer playback audio timing loop
  useEffect(() => {
    let timerId: number | null = null;

    const playNextStep = () => {
      if (!isPlayingRef.current) return;

      const currentStepIdx = stepRef.current;
      setActiveStep(currentStepIdx);

      const song = songRef.current;
      const muted = mutedRef.current;

      // Play notes for each track on this step
      song.tracks.forEach((track) => {
        if (muted[track.channel]) return;

        const step = track.steps[currentStepIdx];
        if (step && step.enabled && step.midi > 0) {
          if (track.channel === 'noise') {
            // Drum hits
            if (step.noteName === 'K') {
              nesSynth.playSoundEffect('hurt');
            } else if (step.noteName === 'S') {
              nesSynth.playSoundEffect('explosion');
            } else {
              nesSynth.playSoundEffect('coin');
            }
          } else {
            // Note on
            const voice = nesSynth.noteOn(step.midi, step.noteName, track.channel);
            // Auto note release for 16th note gate
            const stepDurationMs = (60 / bpmRef.current / 4) * 850;
            setTimeout(() => {
              if (voice) voice.stop();
            }, stepDurationMs);
          }
        }
      });

      // Advance step
      stepRef.current = (stepRef.current + 1) % 16;

      // Schedule next step (16th note = 1/4 of a quarter beat)
      const intervalMs = (60 / bpmRef.current / 4) * 1000;
      timerId = window.setTimeout(playNextStep, intervalMs);
    };

    if (isPlaying) {
      nesSynth.initAudio();
      stepRef.current = 0;
      playNextStep();
    } else {
      setActiveStep(0);
      stepRef.current = 0;
      if (timerId) clearTimeout(timerId);
    }

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [isPlaying]);

  return (
    <div className="w-full bg-[#161822] rounded-xl border-2 border-[#2b303d] p-4 sm:p-5 shadow-[0_12px_24px_rgba(0,0,0,0.6)]">
      {/* Sequencer Top Bar */}
      <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-slate-800 text-xs font-retro-mono gap-3">
        <div className="flex items-center gap-2">
          <span className="font-nes text-[10px] text-amber-400">16-STEP CHIPTUNE TRACKER</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-300">{currentSong.title}</span>
        </div>

        {/* Global Sequencer Controls */}
        <div className="flex items-center gap-3">
          {/* Song selector dropdown */}
          <select
            value={currentSong.id}
            onChange={(e) => handleSelectSong(e.target.value)}
            className="bg-[#0f1118] border border-slate-700 text-slate-200 text-xs px-2 py-1 rounded cursor-pointer font-retro-mono focus:border-amber-400 outline-none"
          >
            {DEMO_SONGS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>

          {/* BPM Slider */}
          <div className="flex items-center gap-2 bg-[#0f1118] px-2 py-1 rounded border border-slate-800">
            <span className="text-slate-400 text-[10px]">BPM:</span>
            <input
              type="range"
              min="70"
              max="200"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-16 accent-amber-500 cursor-pointer"
            />
            <span className="font-bold text-amber-400 text-[11px] w-7 text-right">{bpm}</span>
          </div>

          {/* Clear Button */}
          <button
            onClick={clearAllSteps}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded text-[11px] cursor-pointer"
            title="Clear all steps in sequence"
          >
            <RotateCcw className="w-3 h-3" />
            <span>CLEAR</span>
          </button>

          {/* Play / Stop Master Button */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded font-nes text-[10px] cursor-pointer transition-colors ${
              isPlaying
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_12px_rgba(225,29,72,0.6)]'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]'
            }`}
          >
            {isPlaying ? (
              <>
                <Square className="w-3 h-3 fill-current" />
                <span>STOP</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>PLAY</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Description subtitle */}
      <div className="text-[11px] font-retro-mono text-slate-400 mb-3">
        {currentSong.description}
      </div>

      {/* 4 Tracks Grid */}
      <div className="space-y-2 overflow-x-auto">
        {currentSong.tracks.map((track, trackIdx) => {
          const isMuted = mutedTracks[track.channel];
          return (
            <div
              key={track.channel}
              className={`flex items-center gap-2 p-2 rounded-lg border transition-opacity ${
                isMuted
                  ? 'bg-slate-900/40 border-slate-900 opacity-50'
                  : 'bg-[#10121a] border-slate-800/80'
              }`}
            >
              {/* Track Title & Mute */}
              <div className="w-36 shrink-0 flex items-center justify-between pr-2 border-r border-slate-800">
                <div className="flex flex-col">
                  <span className="font-nes text-[9px] text-slate-200 truncate">
                    {track.name}
                  </span>
                  <span className="text-[9px] font-retro-mono text-slate-500 uppercase">
                    {track.channel}
                  </span>
                </div>
                <button
                  onClick={() => toggleMute(track.channel)}
                  className={`p-1 rounded cursor-pointer ${
                    isMuted ? 'text-rose-400 bg-rose-950/40' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={isMuted ? 'Unmute Track' : 'Mute Track'}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* 16 Step Buttons */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-[500px]">
                {track.steps.map((step, stepIdx) => {
                  const isCurrent = isPlaying && activeStep === stepIdx;
                  const isMeasureStart = stepIdx % 4 === 0;

                  return (
                    <button
                      key={stepIdx}
                      type="button"
                      onClick={() => toggleStep(trackIdx, stepIdx)}
                      className={`relative flex-1 h-10 rounded cursor-pointer font-retro-mono text-[9px] flex flex-col items-center justify-center transition-all ${
                        isCurrent
                          ? 'ring-2 ring-white scale-105 z-10'
                          : ''
                      } ${
                        step.enabled
                          ? track.channel === 'pulse1'
                            ? 'bg-rose-600 text-white border border-rose-400 shadow-[0_0_8px_rgba(225,29,72,0.5)]'
                            : track.channel === 'pulse2'
                            ? 'bg-amber-600 text-white border border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                            : track.channel === 'triangle'
                            ? 'bg-emerald-600 text-white border border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                            : 'bg-cyan-600 text-white border border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                          : isMeasureStart
                          ? 'bg-[#1e222e] text-slate-600 border border-slate-700/60 hover:bg-slate-700/60'
                          : 'bg-[#151720] text-slate-600 border border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {step.enabled ? (
                        <span className="font-bold text-[8px] leading-none truncate px-0.5">
                          {step.noteName}
                        </span>
                      ) : (
                        <span className="text-[7px] text-slate-600 opacity-60">
                          {stepIdx + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step Numbers Legend */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/80 text-[10px] font-retro-mono text-slate-400">
        <div className="w-36 shrink-0 text-slate-500">BEAT DIVISION:</div>
        <div className="flex items-center justify-between flex-1 min-w-[500px] text-center">
          <span>MEASURE 1 (1-4)</span>
          <span>MEASURE 2 (5-8)</span>
          <span>MEASURE 3 (9-12)</span>
          <span>MEASURE 4 (13-16)</span>
        </div>
      </div>
    </div>
  );
};
