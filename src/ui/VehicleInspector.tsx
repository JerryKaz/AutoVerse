/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Vehicle } from '../vehicles/Vehicle.ts';

interface VehicleInspectorProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onFocusCamera: () => void;
  onEmergencyBrake: () => void;
  onDespawn: () => void;
}

export const VehicleInspector: React.FC<VehicleInspectorProps> = ({
  vehicle,
  onClose,
  onFocusCamera,
  onEmergencyBrake,
  onDespawn,
}) => {
  if (!vehicle) return null;

  const speedKmh = Math.round(vehicle.controller.velocity * 3.6);
  const maxSpeedKmh = Math.round(vehicle.config.maxSpeed * 3.6);
  const speedRatio = Math.min(1, speedKmh / maxSpeedKmh);

  const state = vehicle.getState();
  const formatState = (s: string) => s.replace(/_/g, ' ');

  const sensorData = vehicle.lastSensorData;

  // Semantic state indicator color
  const getStateColor = (s: string) => {
    switch (s) {
      case 'CRUISING':
      case 'FOLLOWING_LEAD':
        return '#3fb950'; // Nominal operational green
      case 'STOPPING_AT_LIGHT':
      case 'CHANGING_LANE_LEFT':
      case 'CHANGING_LANE_RIGHT':
        return '#d29922'; // Cautionary amber
      case 'WAITING_AT_RED':
      case 'EMERGENCY_BRAKE':
        return '#f85149'; // Active stop red
      default:
        return '#8b949e';
    }
  };

  return (
    <aside
      aria-label="Vehicle Telemetry Inspector"
      className="absolute top-18 right-6 w-88 bg-[#111419] border border-white/[0.08] shadow-2xl p-5 text-[#f0f3f6] z-20 font-sans pointer-events-auto rounded-none select-none"
    >
      {/* Header Bar */}
      <div className="flex items-start justify-between pb-3 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-[1px] shrink-0"
              style={{ backgroundColor: vehicle.color }}
              title={`Chassis Finish: ${vehicle.color}`}
            />
            <h2 className="text-sm font-semibold tracking-tight text-[#f0f3f6]">
              {vehicle.config.displayName}
            </h2>
          </div>
          <div className="text-[11px] font-mono text-[#8b949e] mt-0.5">
            IDENTIFIER: {vehicle.id}
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-xs text-[#8b949e] hover:text-[#f0f3f6] px-2 py-1 bg-[#161a22] hover:bg-[#21262d] border border-white/[0.06] transition-colors"
          aria-label="Close inspector"
        >
          ESC
        </button>
      </div>

      {/* Operational State */}
      <div className="py-3 border-b border-white/[0.08] flex items-center justify-between text-xs">
        <span className="text-[#8b949e] font-mono uppercase text-[10px] tracking-wider">
          Controller State
        </span>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span
            className="w-1.5 h-1.5 rounded-[1px]"
            style={{ backgroundColor: getStateColor(state) }}
            aria-hidden="true"
          />
          <span className="font-medium text-[#f0f3f6]">{formatState(state)}</span>
        </div>
      </div>

      {/* Kinematics Telemetry */}
      <div className="py-3 border-b border-white/[0.08] space-y-2">
        <div className="flex justify-between items-baseline font-mono">
          <span className="text-[10px] uppercase tracking-wider text-[#8b949e]">Velocity</span>
          <span className="text-base font-semibold text-[#f0f3f6]">
            {speedKmh} <span className="text-xs text-[#8b949e] font-normal">/ {maxSpeedKmh} km/h</span>
          </span>
        </div>

        {/* Engineered Segmented Progress Bar */}
        <div className="h-1.5 bg-[#161a22] border border-white/[0.04] w-full overflow-hidden">
          <div
            className="h-full bg-[#e58514] transition-all duration-150"
            style={{ width: `${Math.round(speedRatio * 100)}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1 text-xs font-mono text-[#8b949e]">
          <div>
            <span className="text-[10px] uppercase block text-[#656d76]">Acceleration</span>
            <span className="text-[#f0f3f6] font-medium">
              {vehicle.controller.acceleration >= 0 ? '+' : ''}
              {vehicle.controller.acceleration.toFixed(2)} m/s²
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase block text-[#656d76]">Steering Rack</span>
            <span className="text-[#f0f3f6] font-medium">
              {(vehicle.controller.steeringAngle * (180 / Math.PI)).toFixed(1)}°
            </span>
          </div>
        </div>
      </div>

      {/* Perception Matrix */}
      <div className="py-3 border-b border-white/[0.08] space-y-2 text-xs font-mono">
        <div className="text-[10px] uppercase tracking-wider text-[#8b949e]">Perception Matrix</div>

        <div className="space-y-1.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-[#656d76]">Lead Gap</span>
            <span className="text-[#f0f3f6]">
              {sensorData?.leadVehicle ? `${sensorData.leadVehicle.distance.toFixed(1)} m` : 'Nominal (>65m)'}
            </span>
          </div>

          {sensorData?.leadVehicle && (
            <div className="flex justify-between">
              <span className="text-[#656d76]">Closing Rate (Δv)</span>
              <span className={sensorData.leadVehicle.relativeSpeed > 0 ? 'text-[#f85149]' : 'text-[#3fb950]'}>
                {(sensorData.leadVehicle.relativeSpeed * 3.6).toFixed(1)} km/h
              </span>
            </div>
          )}

          {sensorData?.leadVehicle && Number.isFinite(sensorData.leadVehicle.timeToCollision) && (
            <div className="flex justify-between">
              <span className="text-[#656d76]">Time-To-Collision (TTC)</span>
              <span className={sensorData.leadVehicle.timeToCollision < 2.5 ? 'text-[#f85149]' : 'text-[#f0f3f6]'}>
                {sensorData.leadVehicle.timeToCollision.toFixed(1)} s
              </span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-[#656d76]">Signal Approaching</span>
            <span className="text-[#f0f3f6]">
              {sensorData?.trafficSignal
                ? `${sensorData.trafficSignal.state} (${sensorData.trafficSignal.distanceToStopLine.toFixed(0)}m)`
                : 'None'}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-[#656d76]">MOBIL Gap Evaluation</span>
            <span className="text-[#8b949e]">
              L: <span className={sensorData?.leftLaneGap.isSafe ? 'text-[#3fb950]' : 'text-[#656d76]'}>{sensorData?.leftLaneGap.isSafe ? 'CLEAR' : 'OCCUPIED'}</span> · R: <span className={sensorData?.rightLaneGap.isSafe ? 'text-[#3fb950]' : 'text-[#656d76]'}>{sensorData?.rightLaneGap.isSafe ? 'CLEAR' : 'OCCUPIED'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Decision Log */}
      <div className="py-3 border-b border-white/[0.08]">
        <div className="text-[10px] uppercase font-mono tracking-wider text-[#8b949e] mb-1">
          Actuation Dispatch
        </div>
        <p className="text-xs text-[#8b949e] leading-relaxed font-mono">
          {vehicle.lastDebugMessage}
        </p>
      </div>

      {/* Actuator Action Controls */}
      <div className="pt-4 grid grid-cols-3 gap-2">
        <button
          onClick={onFocusCamera}
          className="px-2 py-2 text-xs font-mono font-medium text-[#f0f3f6] bg-[#161a22] hover:bg-[#21262d] border border-white/[0.08] transition-colors"
        >
          Track Cam
        </button>

        <button
          onClick={onEmergencyBrake}
          className="px-2 py-2 text-xs font-mono font-medium text-[#f85149] bg-[#161a22] hover:bg-[#2d1b1f] border border-[#f85149]/30 transition-colors"
        >
          E-Brake
        </button>

        <button
          onClick={onDespawn}
          className="px-2 py-2 text-xs font-mono font-medium text-[#8b949e] hover:text-[#f0f3f6] bg-[#161a22] hover:bg-[#21262d] border border-white/[0.08] transition-colors"
        >
          Despawn
        </button>
      </div>
    </aside>
  );
};
