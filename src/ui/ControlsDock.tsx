/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CameraMode } from '../rendering/CameraController.ts';
import { TimeOfDay, WeatherType } from '../world/Environment.ts';
import { VehicleClass } from '../vehicles/VehicleTypes.ts';
import { SimulationControls } from './SimulationControls.tsx';
import { LayerController } from './LayerController.tsx';

interface ControlsDockProps {
  isPaused: boolean;
  timeScale: number;
  simTime?: number;
  cameraMode: CameraMode;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  density: number;
  showSensors: boolean;
  showTrajectories: boolean;
  showLaneGraph: boolean;
  hasSelectedVehicle: boolean;
  landmarkVisibility: Record<string, boolean>;
  layerVisibility: Record<string, boolean>;
  onPlay?: () => void;
  onPause?: () => void;
  onTogglePause: () => void;
  onSetTimeScale: (scale: number) => void;
  onReset: () => void;
  onStepFrame?: () => void;
  onSetCameraMode: (mode: CameraMode) => void;
  onSetTimeOfDay: (time: TimeOfDay) => void;
  onSetWeather: (weather: WeatherType) => void;
  onSetDensity: (density: number) => void;
  onToggleOverlay: (key: string, enabled: boolean) => void;
  onSpawnVehicle: (cls: VehicleClass) => void;
  onToggleLandmark: (landmarkId: string, visible: boolean) => void;
  onToggleLayer: (layerKey: string, visible: boolean) => void;
  onShowAllLandmarks: () => void;
  onHideAllLandmarks: () => void;
}

type TabType = 'SIMULATION' | 'CAMERA' | 'LAYERS' | 'FLEET' | 'ENVIRONMENT' | 'INSTRUMENTATION';

export const ControlsDock: React.FC<ControlsDockProps> = ({
  isPaused,
  timeScale,
  simTime = 0,
  cameraMode,
  timeOfDay,
  weather,
  density,
  showSensors,
  showTrajectories,
  showLaneGraph,
  hasSelectedVehicle,
  landmarkVisibility,
  layerVisibility,
  onPlay,
  onPause,
  onTogglePause,
  onSetTimeScale,
  onReset,
  onStepFrame,
  onSetCameraMode,
  onSetTimeOfDay,
  onSetWeather,
  onSetDensity,
  onToggleOverlay,
  onSpawnVehicle,
  onToggleLandmark,
  onToggleLayer,
  onShowAllLandmarks,
  onHideAllLandmarks,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('SIMULATION');

  const speeds = [0.25, 0.5, 1.0, 2.0, 4.0];

  const cameraModes: { id: CameraMode; label: string; disabled?: boolean }[] = [
    { id: 'ORBIT', label: 'Orbit Accra' },
    { id: 'AERIAL', label: 'Aerial Ortho' },
    { id: 'BLACK_STAR_GATE', label: 'Black Star Gate' },
    { id: 'JAMESTOWN_LIGHTHOUSE', label: 'Jamestown Lighthouse' },
    { id: 'COLONIAL_DISTRICT', label: 'Old Accra Colonial' },
    { id: 'FOLLOW', label: 'Vehicle Chase', disabled: !hasSelectedVehicle },
    { id: 'HOOD', label: 'Driver Cockpit', disabled: !hasSelectedVehicle },
    { id: 'FREE_ROAM', label: 'Free Flight' },
  ];

  return (
    <footer
      aria-label="Simulation Control Console"
      className="fixed left-1/2 -translate-x-1/2 z-30 transition-transform duration-200 ease-out pointer-events-auto select-none"
      style={{
        bottom: isCollapsed ? '-142px' : '20px',
        maxWidth: 'min(980px, 94vw)',
        width: '100%',
      }}
    >
      {/* Console Toggle Tab */}
      <div className="flex justify-center mb-1">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-[11px] font-mono tracking-wider text-[#8b949e] hover:text-[#f0f3f6] bg-[#0d1015] border border-white/[0.08] px-3 py-1 transition-colors flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 bg-[#e58514] rounded-[1px]" aria-hidden="true" />
          <span>{isCollapsed ? 'OPEN CONTROL CONSOLE' : 'COLLAPSE WORKSTATION (ZEN)'}</span>
        </button>
      </div>

      {/* Main Solid Graphite Console Surface */}
      <div className="bg-[#0d1015] border border-white/[0.08] shadow-2xl p-4 text-[#f0f3f6]">
        {/* Navigation Tabs Strip */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-3">
          <div className="flex items-center gap-1 font-mono text-xs">
            <button
              onClick={() => setActiveTab('SIMULATION')}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                activeTab === 'SIMULATION'
                  ? 'bg-[#1c212a] text-[#f0f3f6] border border-white/[0.12] font-semibold'
                  : 'text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#161a22]'
              }`}
            >
              SIMULATION
            </button>

            <button
              onClick={() => setActiveTab('CAMERA')}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                activeTab === 'CAMERA'
                  ? 'bg-[#1c212a] text-[#f0f3f6] border border-white/[0.12] font-semibold'
                  : 'text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#161a22]'
              }`}
            >
              OBSERVER CAM
            </button>

            <button
              onClick={() => setActiveTab('LAYERS')}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                activeTab === 'LAYERS'
                  ? 'bg-[#1c212a] text-[#f0f3f6] border border-white/[0.12] font-semibold'
                  : 'text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#161a22]'
              }`}
            >
              CITY LAYERS
            </button>

            <button
              onClick={() => setActiveTab('FLEET')}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                activeTab === 'FLEET'
                  ? 'bg-[#1c212a] text-[#f0f3f6] border border-white/[0.12] font-semibold'
                  : 'text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#161a22]'
              }`}
            >
              TRAFFIC FLEET
            </button>

            <button
              onClick={() => setActiveTab('ENVIRONMENT')}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                activeTab === 'ENVIRONMENT'
                  ? 'bg-[#1c212a] text-[#f0f3f6] border border-white/[0.12] font-semibold'
                  : 'text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#161a22]'
              }`}
            >
              ATMOSPHERE
            </button>

            <button
              onClick={() => setActiveTab('INSTRUMENTATION')}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                activeTab === 'INSTRUMENTATION'
                  ? 'bg-[#1c212a] text-[#f0f3f6] border border-white/[0.12] font-semibold'
                  : 'text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#161a22]'
              }`}
            >
              INSTRUMENTATION
            </button>
          </div>

          {/* Quick Actuation: Pause/Resume & Reset */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              onClick={onTogglePause}
              className={`px-3 py-1 text-xs font-semibold tracking-wider transition-colors ${
                isPaused
                  ? 'bg-[#238636] hover:bg-[#2ea043] text-white'
                  : 'bg-[#9e6a03] hover:bg-[#bb8009] text-white'
              }`}
            >
              {isPaused ? 'RESUME SIMULATION' : 'PAUSE SIMULATION'}
            </button>

            <button
              onClick={onReset}
              className="px-3 py-1 text-xs text-[#8b949e] hover:text-[#f0f3f6] bg-[#161a22] hover:bg-[#21262d] border border-white/[0.08] transition-colors"
              title="Reset simulation parameters and agent fleet"
            >
              RESET
            </button>
          </div>
        </div>

        {/* Tab 1: Simulation Controls */}
        {activeTab === 'SIMULATION' && (
          <div className="py-0.5">
            <SimulationControls
              isPaused={isPaused}
              timeScale={timeScale}
              simTime={simTime}
              onPlay={onPlay}
              onPause={onPause}
              onTogglePause={onTogglePause}
              onRestart={onReset}
              onSetSpeed={onSetTimeScale}
              onStepFrame={onStepFrame}
              compact={true}
            />
          </div>
        )}

        {/* Tab 2: Camera Controls */}
        {activeTab === 'CAMERA' && (
          <div className="flex items-center justify-between gap-3 py-1 font-mono text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              {cameraModes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onSetCameraMode(m.id)}
                  disabled={m.disabled}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    cameraMode === m.id
                      ? 'bg-[#e58514] text-white font-semibold'
                      : m.disabled
                      ? 'bg-[#111419] text-[#484f58] cursor-not-allowed border border-transparent'
                      : 'bg-[#161a22] text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#21262d] border border-white/[0.06]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {!hasSelectedVehicle && (
              <span className="text-[11px] font-mono text-[#656d76] tracking-wide">
                Select vehicle in 3D to enable Chase & Cockpit view
              </span>
            )}
          </div>
        )}

        {/* Tab 3: City Layers & Landmarks */}
        {activeTab === 'LAYERS' && (
          <div className="py-1">
            <LayerController
              landmarkVisibility={landmarkVisibility}
              layerVisibility={layerVisibility}
              onToggleLandmark={onToggleLandmark}
              onToggleLayer={onToggleLayer}
              onShowAllLandmarks={onShowAllLandmarks}
              onHideAllLandmarks={onHideAllLandmarks}
              onFocusLandmark={onSetCameraMode}
              compact={true}
            />
          </div>
        )}

        {/* Tab 4: Fleet Management */}
        {activeTab === 'FLEET' && (
          <div className="flex items-center justify-between gap-6 py-1 font-mono text-xs">
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-wider text-[#8b949e]">Agent Density:</span>
              <input
                type="range"
                min="10"
                max="90"
                value={density}
                onChange={(e) => onSetDensity(Number(e.target.value))}
                className="w-40 accent-[#e58514] cursor-pointer"
              />
              <span className="text-xs font-mono font-medium text-[#f0f3f6] w-14">{density} AVs</span>
            </div>

            <div className="flex items-center gap-2 border-l border-white/[0.08] pl-4">
              <span className="text-[10px] uppercase tracking-wider text-[#8b949e] mr-1">Inject Vehicle:</span>
              <button
                onClick={() => onSpawnVehicle('TROTRO')}
                className="px-2.5 py-1 text-xs bg-[#161a22] hover:bg-[#21262d] text-[#f0f3f6] border border-white/[0.08] transition-colors"
              >
                + Trotro (Minibus)
              </button>
              <button
                onClick={() => onSpawnVehicle('GH_TAXI')}
                className="px-2.5 py-1 text-xs bg-[#161a22] hover:bg-[#21262d] text-[#f0f3f6] border border-white/[0.08] transition-colors"
              >
                + Accra Taxi
              </button>
              <button
                onClick={() => onSpawnVehicle('SUV_EV')}
                className="px-2.5 py-1 text-xs bg-[#161a22] hover:bg-[#21262d] text-[#f0f3f6] border border-white/[0.08] transition-colors"
              >
                + Robotaxi SUV
              </button>
              <button
                onClick={() => onSpawnVehicle('SEDAN')}
                className="px-2.5 py-1 text-xs bg-[#161a22] hover:bg-[#21262d] text-[#f0f3f6] border border-white/[0.08] transition-colors"
              >
                + Sedan
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Environment & Atmosphere */}
        {activeTab === 'ENVIRONMENT' && (
          <div className="flex items-center justify-between gap-6 py-1 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-[#8b949e] mr-2">Solar State:</span>
              <button
                onClick={() => onSetTimeOfDay('day')}
                className={`px-3 py-1 transition-colors ${
                  timeOfDay === 'day'
                    ? 'bg-[#1c212a] text-[#f0f3f6] border border-white/[0.14] font-semibold'
                    : 'text-[#8b949e] hover:text-[#f0f3f6] bg-[#111419]'
                }`}
              >
                Equatorial Noon
              </button>
              <button
                onClick={() => onSetTimeOfDay('sunset')}
                className={`px-3 py-1 transition-colors ${
                  timeOfDay === 'sunset'
                    ? 'bg-[#1c212a] text-[#f0f3f6] border border-white/[0.14] font-semibold'
                    : 'text-[#8b949e] hover:text-[#f0f3f6] bg-[#111419]'
                }`}
              >
                Atlantic Sunset
              </button>
              <button
                onClick={() => onSetTimeOfDay('night')}
                className={`px-3 py-1 transition-colors ${
                  timeOfDay === 'night'
                    ? 'bg-[#1c212a] text-[#f0f3f6] border border-white/[0.14] font-semibold'
                    : 'text-[#8b949e] hover:text-[#f0f3f6] bg-[#111419]'
                }`}
              >
                Coastal Night
              </button>
            </div>

            <div className="flex items-center gap-2 border-l border-white/[0.08] pl-4">
              <span className="text-[10px] uppercase tracking-wider text-[#8b949e] mr-2">Atmosphere:</span>
              <button
                onClick={() => onSetWeather('clear')}
                className={`px-3 py-1 transition-colors ${
                  weather === 'clear'
                    ? 'bg-[#1c212a] text-[#f0f3f6] border border-white/[0.14] font-semibold'
                    : 'text-[#8b949e] hover:text-[#f0f3f6] bg-[#111419]'
                }`}
              >
                Clear Sky
              </button>
              <button
                onClick={() => onSetWeather('fog')}
                className={`px-3 py-1 transition-colors ${
                  weather === 'fog'
                    ? 'bg-[#1c212a] text-[#f0f3f6] border border-white/[0.14] font-semibold'
                    : 'text-[#8b949e] hover:text-[#f0f3f6] bg-[#111419]'
                }`}
              >
                Harmattan Haze
              </button>
              <button
                onClick={() => onSetWeather('rain')}
                className={`px-3 py-1 transition-colors ${
                  weather === 'rain'
                    ? 'bg-[#1c212a] text-[#f0f3f6] border border-white/[0.14] font-semibold'
                    : 'text-[#8b949e] hover:text-[#f0f3f6] bg-[#111419]'
                }`}
              >
                Monsoon Rain
              </button>
            </div>
          </div>
        )}

        {/* Tab 5: Instrumentation Overlays */}
        {activeTab === 'INSTRUMENTATION' && (
          <div className="flex items-center gap-6 py-1 font-mono text-xs">
            <label className="flex items-center gap-2 text-[#8b949e] hover:text-[#f0f3f6] cursor-pointer">
              <input
                type="checkbox"
                checked={showSensors}
                onChange={(e) => onToggleOverlay('sensors', e.target.checked)}
                className="rounded-none accent-[#e58514]"
              />
              <span>LiDAR Point Rays & Cones</span>
            </label>

            <label className="flex items-center gap-2 text-[#8b949e] hover:text-[#f0f3f6] cursor-pointer">
              <input
                type="checkbox"
                checked={showTrajectories}
                onChange={(e) => onToggleOverlay('trajectories', e.target.checked)}
                className="rounded-none accent-[#e58514]"
              />
              <span>Lookahead Trajectory Splines</span>
            </label>

            <label className="flex items-center gap-2 text-[#8b949e] hover:text-[#f0f3f6] cursor-pointer">
              <input
                type="checkbox"
                checked={showLaneGraph}
                onChange={(e) => onToggleOverlay('lanes', e.target.checked)}
                className="rounded-none accent-[#e58514]"
              />
              <span>Lane Graph Topology Nodes</span>
            </label>
          </div>
        )}
      </div>
    </footer>
  );
};
