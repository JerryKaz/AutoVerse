/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface SimulationControlsProps {
  isPaused: boolean;
  timeScale: number;
  simTime?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onTogglePause?: () => void;
  onRestart: () => void;
  onSetSpeed: (speed: number) => void;
  onStepFrame?: () => void;
  compact?: boolean;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  isPaused,
  timeScale,
  simTime = 0,
  onPlay,
  onPause,
  onTogglePause,
  onRestart,
  onSetSpeed,
  onStepFrame,
  compact = false,
}) => {
  const speedPresets = [0.5, 1.0, 2.0, 4.0, 8.0];

  const handlePlayClick = () => {
    if (onPlay) {
      onPlay();
    } else if (onTogglePause && isPaused) {
      onTogglePause();
    }
  };

  const handlePauseClick = () => {
    if (onPause) {
      onPause();
    } else if (onTogglePause && !isPaused) {
      onTogglePause();
    }
  };

  const handleSpeedDown = () => {
    const currentIdx = speedPresets.findIndex(s => Math.abs(s - timeScale) < 0.1);
    if (currentIdx > 0) {
      onSetSpeed(speedPresets[currentIdx - 1]);
    } else if (currentIdx === -1) {
      // Find closest lower preset
      const lower = speedPresets.filter(s => s < timeScale);
      if (lower.length > 0) {
        onSetSpeed(lower[lower.length - 1]);
      } else {
        onSetSpeed(0.5);
      }
    }
  };

  const handleSpeedUp = () => {
    const currentIdx = speedPresets.findIndex(s => Math.abs(s - timeScale) < 0.1);
    if (currentIdx >= 0 && currentIdx < speedPresets.length - 1) {
      onSetSpeed(speedPresets[currentIdx + 1]);
    } else if (currentIdx === -1) {
      // Find closest higher preset
      const higher = speedPresets.filter(s => s > timeScale);
      if (higher.length > 0) {
        onSetSpeed(higher[0]);
      } else {
        onSetSpeed(8.0);
      }
    }
  };

  const formatSimTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div
      className={`bg-[#0d1015] border border-white/[0.08] text-[#f0f3f6] select-none ${
        compact ? 'p-2.5' : 'p-3.5 shadow-2xl'
      }`}
      role="region"
      aria-label="Autonomous Driving Simulation Controls"
    >
      {/* Top Header / Status Strip */}
      <div className="flex items-center justify-between gap-3 pb-2.5 mb-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-[1px] transition-colors ${
              isPaused ? 'bg-[#d29922]' : 'bg-[#2ea043] animate-pulse'
            }`}
            aria-hidden="true"
          />
          <span className="font-mono text-[11px] font-semibold tracking-wider uppercase text-[#c9d1d9]">
            {isPaused ? 'Scenario Paused' : 'Scenario Running'}
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-[#8b949e]">
          <div>
            <span className="text-[#8b949e] mr-1">T+</span>
            <span className="text-[#f0f3f6] font-medium tracking-tight">
              {formatSimTime(simTime)}
            </span>
          </div>
          <div className="text-white/[0.12]">•</div>
          <div>
            <span className="text-[#8b949e] mr-1">RATE:</span>
            <span className="text-[#e58514] font-medium">{timeScale.toFixed(1)}x</span>
          </div>
        </div>
      </div>

      {/* Main Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Play / Pause / Restart / Step Cluster */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          {/* Play Button */}
          <button
            type="button"
            onClick={handlePlayClick}
            disabled={!isPaused}
            title="Resume simulation (Space)"
            className={`px-3 py-1.5 flex items-center gap-1.5 font-medium transition-colors border ${
              !isPaused
                ? 'bg-[#1f3b28] border-[#2ea043]/60 text-[#3fb950] cursor-default'
                : 'bg-[#161a22] hover:bg-[#1c212a] text-[#f0f3f6] border-white/[0.1] active:bg-[#202632]'
            }`}
            aria-pressed={!isPaused}
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="text-[11px] tracking-wider uppercase font-semibold">Play</span>
          </button>

          {/* Pause Button */}
          <button
            type="button"
            onClick={handlePauseClick}
            disabled={isPaused}
            title="Pause scenario (Space)"
            className={`px-3 py-1.5 flex items-center gap-1.5 font-medium transition-colors border ${
              isPaused
                ? 'bg-[#3b2d18] border-[#d29922]/60 text-[#e3b341] cursor-default'
                : 'bg-[#161a22] hover:bg-[#1c212a] text-[#f0f3f6] border-white/[0.1] active:bg-[#202632]'
            }`}
            aria-pressed={isPaused}
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
            <span className="text-[11px] tracking-wider uppercase font-semibold">Pause</span>
          </button>

          {/* Restart Button */}
          <button
            type="button"
            onClick={onRestart}
            title="Restart scenario and re-populate traffic"
            className="px-3 py-1.5 flex items-center gap-1.5 bg-[#161a22] hover:bg-[#231b18] hover:text-[#ff7b72] hover:border-[#ff7b72]/40 text-[#c9d1d9] border border-white/[0.1] transition-colors active:bg-[#2e1d1a]"
          >
            <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-[11px] tracking-wider uppercase font-semibold">Restart</span>
          </button>

          {/* Single-Frame Step Button (only enabled when paused) */}
          {onStepFrame && (
            <button
              type="button"
              onClick={onStepFrame}
              disabled={!isPaused}
              title={isPaused ? "Advance simulation by 1 fixed frame (16.7ms)" : "Pause first to step frame-by-frame"}
              className={`px-2.5 py-1.5 flex items-center gap-1 text-[11px] font-mono border transition-colors ${
                isPaused
                  ? 'bg-[#161a22] hover:bg-[#1c212a] text-[#8b949e] hover:text-[#f0f3f6] border-white/[0.1]'
                  : 'bg-[#101318] text-[#484f58] border-transparent cursor-not-allowed'
              }`}
            >
              <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 4v16l9-8zm11 0v16h2V4z" />
              </svg>
              <span className="tracking-wider uppercase">Step</span>
            </button>
          )}
        </div>

        {/* Speed Adjustment Cluster */}
        <div className="flex items-center gap-1 font-mono text-xs">
          <span className="text-[10px] tracking-widest uppercase text-[#8b949e] mr-1 hidden sm:inline">
            Speed:
          </span>

          {/* Stepping Minus Button */}
          <button
            type="button"
            onClick={handleSpeedDown}
            disabled={timeScale <= 0.5}
            title="Decrease speed"
            className="w-7 h-7 flex items-center justify-center bg-[#161a22] hover:bg-[#1c212a] disabled:opacity-30 disabled:hover:bg-[#161a22] text-[#c9d1d9] border border-white/[0.08] transition-colors"
            aria-label="Decrease simulation speed"
          >
            <svg className="w-3 h-3 fill-none stroke-current stroke-2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>

          {/* Speed Preset Buttons */}
          <div className="flex items-center border border-white/[0.08] bg-[#12151c] p-0.5">
            {speedPresets.map(preset => {
              const isActive = Math.abs(preset - timeScale) < 0.05;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onSetSpeed(preset)}
                  className={`px-2 py-1 text-[11px] font-mono transition-colors ${
                    isActive
                      ? 'bg-[#e58514] text-[#090b0e] font-bold shadow-sm'
                      : 'text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#1c212a]'
                  }`}
                  aria-pressed={isActive}
                >
                  {preset}x
                </button>
              );
            })}
          </div>

          {/* Stepping Plus Button */}
          <button
            type="button"
            onClick={handleSpeedUp}
            disabled={timeScale >= 8.0}
            title="Increase speed"
            className="w-7 h-7 flex items-center justify-center bg-[#161a22] hover:bg-[#1c212a] disabled:opacity-30 disabled:hover:bg-[#161a22] text-[#c9d1d9] border border-white/[0.08] transition-colors"
            aria-label="Increase simulation speed"
          >
            <svg className="w-3 h-3 fill-none stroke-current stroke-2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14m-7-7h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Keyboard Shortcut Indicator */}
      {!compact && (
        <div className="mt-2.5 pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] font-mono text-[#8b949e]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 bg-[#161a22] border border-white/[0.1] text-[#c9d1d9] font-mono mr-1">
                Space
              </kbd>
              Play / Pause
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-[#161a22] border border-white/[0.1] text-[#c9d1d9] font-mono mr-1">
                1
              </kbd>
              <kbd className="px-1 py-0.5 bg-[#161a22] border border-white/[0.1] text-[#c9d1d9] font-mono mr-1">
                2
              </kbd>
              <kbd className="px-1 py-0.5 bg-[#161a22] border border-white/[0.1] text-[#c9d1d9] font-mono mr-1">
                3
              </kbd>
              Speed Presets
            </span>
          </div>
          <span className="text-[#6e7681]">Autonomous Scenario Control Engine</span>
        </div>
      )}
    </div>
  );
};
