/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TrafficMetrics } from '../traffic/TrafficManager.ts';

interface SimulationStatsProps {
  telemetry: TrafficMetrics & { fps: number; simTime: number; timeScale: number; isPaused: boolean };
  isLayerControllerOpen?: boolean;
  onToggleLayerController?: () => void;
  activeLandmarkCount?: number;
}

export const SimulationStats: React.FC<SimulationStatsProps> = ({
  telemetry,
  isLayerControllerOpen = false,
  onToggleLayerController,
  activeLandmarkCount,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="absolute top-0 left-0 right-0 h-14 bg-[#0d1015] border-b border-white/[0.08] px-6 flex items-center justify-between pointer-events-auto z-20 select-none">
      {/* Brand & System Identity */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 bg-[#e58514] rounded-[1px]" aria-hidden="true" />
          <span className="font-semibold text-sm tracking-wider text-[#f0f3f6] uppercase font-mono">
            AutoVerse
          </span>
        </div>
        <span className="text-[#3b424d] font-mono" aria-hidden="true">|</span>
        <span className="text-xs text-[#8b949e] font-normal tracking-wide">
          Accra Autonomous Urban Mobility Simulation · 5.6037° N, 0.1870° W
        </span>
      </div>

      {/* Engineering Telemetry Readouts */}
      <div className="flex items-center gap-6 text-xs">
        {/* Active Fleet */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#656d76]">Active Fleet</span>
          <span className="font-mono font-medium text-[#f0f3f6]">
            {telemetry.activeVehicles} <span className="text-[#656d76] text-[10px]">AVs</span>
          </span>
        </div>

        <span className="text-[#21262d] font-mono" aria-hidden="true">|</span>

        {/* Mean Velocity */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#656d76]">Mean Velocity</span>
          <span className="font-mono font-medium text-[#f0f3f6]">
            {telemetry.averageSpeedKmh.toFixed(1)} <span className="text-[#656d76] text-[10px]">km/h</span>
          </span>
        </div>

        <span className="text-[#21262d] font-mono" aria-hidden="true">|</span>

        {/* Network Flow Rate */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#656d76]">Flow Rate</span>
          <span className="font-mono font-medium text-[#f0f3f6]">
            {telemetry.flowRateVehPerMin} <span className="text-[#656d76] text-[10px]">veh/min</span>
          </span>
        </div>

        <span className="text-[#21262d] font-mono" aria-hidden="true">|</span>

        {/* Congestion Index */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#656d76]">Congestion</span>
          <span className="font-mono font-medium text-[#f0f3f6]">
            {Math.round(telemetry.congestionIndex * 100)}%
          </span>
        </div>

        <span className="text-[#21262d] font-mono" aria-hidden="true">|</span>

        {/* Collision Invariant */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#656d76]">Collisions</span>
          <span className={`font-mono font-medium ${telemetry.collisionCount === 0 ? 'text-[#8b949e]' : 'text-[#f85149]'}`}>
            {telemetry.collisionCount}
          </span>
        </div>

        <span className="text-[#21262d] font-mono" aria-hidden="true">|</span>

        {/* Clock & Refresh Rate */}
        <div className="flex items-center gap-3 pl-1 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[#656d76]">Epoch</span>
            <span className="text-xs text-[#f0f3f6]">{formatTime(telemetry.simTime)}</span>
          </div>
          <span className="text-[#3b424d]" aria-hidden="true">·</span>
          <div className="text-xs text-[#8b949e]">
            {telemetry.fps} <span className="text-[10px] text-[#656d76]">FPS</span>
          </div>
        </div>

        {/* 3D Scene Layer Controller Button */}
        {onToggleLayerController && (
          <button
            type="button"
            onClick={onToggleLayerController}
            title="Toggle 3D Scene Landmarks & Layers (L)"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono border transition-colors ${
              isLayerControllerOpen
                ? 'bg-[#1c212a] text-[#e58514] border-[#e58514]/40 font-semibold'
                : 'bg-[#161a22] text-[#c9d1d9] hover:text-[#f0f3f6] hover:bg-[#1c212a] border-white/[0.08]'
            }`}
          >
            <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span className="tracking-wider uppercase text-[11px]">3D Layers</span>
            {activeLandmarkCount !== undefined && (
              <span className="text-[10px] px-1 py-0.2 bg-[#090b0e] text-[#e58514] border border-white/[0.06] font-semibold">
                {activeLandmarkCount}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
};
