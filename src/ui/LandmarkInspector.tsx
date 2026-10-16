/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LandmarkMetadata } from '../world/AccraAssetManager.ts';
import { CameraMode } from '../rendering/CameraController.ts';

interface LandmarkInspectorProps {
  landmark: LandmarkMetadata | null;
  onClose: () => void;
  onFocusCamera: (mode: CameraMode) => void;
}

export const LandmarkInspector: React.FC<LandmarkInspectorProps> = ({
  landmark,
  onClose,
  onFocusCamera,
}) => {
  if (!landmark) return null;

  const getCameraModeForLandmark = (id: string): CameraMode => {
    switch (id) {
      case 'black_star_gate':
        return 'BLACK_STAR_GATE';
      case 'jamestown_lighthouse':
        return 'JAMESTOWN_LIGHTHOUSE';
      case 'colonial_trading_house_1':
      case 'colonial_trading_house_2':
      case 'colonial_customs_house':
        return 'COLONIAL_DISTRICT';
      default:
        return 'ORBIT';
    }
  };

  return (
    <aside
      aria-label="Accra Heritage Landmark Inspector"
      className="absolute top-18 left-6 w-96 bg-[#111419] border border-white/[0.08] shadow-2xl p-5 text-[#f0f3f6] z-20 font-sans pointer-events-auto rounded-none select-none"
    >
      {/* Header Bar */}
      <div className="flex items-start justify-between pb-3 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-[1px] shrink-0 bg-[#e58514]"
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold tracking-tight text-[#f0f3f6]">
              {landmark.name}
            </h2>
          </div>
          <div className="text-[11px] font-mono text-[#8b949e] mt-0.5">
            LOCATION: {landmark.locationName}
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-xs text-[#8b949e] hover:text-[#f0f3f6] px-2 py-1 bg-[#161a22] hover:bg-[#21262d] border border-white/[0.06] transition-colors"
          aria-label="Close landmark inspector"
        >
          ESC
        </button>
      </div>

      {/* Historical Era & Architecture */}
      <div className="py-3 border-b border-white/[0.08] flex items-center justify-between text-xs">
        <span className="text-[#8b949e] font-mono uppercase text-[10px] tracking-wider">
          Architectural Era
        </span>
        <span className="font-mono text-xs text-[#e58514] font-medium">
          {landmark.historicalPeriod}
        </span>
      </div>

      {/* Grid Coordinates Origin */}
      <div className="py-3 border-b border-white/[0.08]">
        <div className="flex items-center justify-between text-xs font-mono mb-2">
          <span className="text-[#8b949e] uppercase text-[10px] tracking-wider">
            Simulation Grid Origin
          </span>
          <span className="text-[#f0f3f6] text-[11px]">
            [{landmark.coordinates.x.toFixed(1)}, {landmark.coordinates.y.toFixed(1)}, {landmark.coordinates.z.toFixed(1)}]
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
          <div className="bg-[#161a22] p-1.5 border border-white/[0.04]">
            <span className="text-[#656d76] block">X (East/West)</span>
            <span className="text-[#f0f3f6] font-medium">{landmark.coordinates.x} m</span>
          </div>
          <div className="bg-[#161a22] p-1.5 border border-white/[0.04]">
            <span className="text-[#656d76] block">Y (Elevation)</span>
            <span className="text-[#f0f3f6] font-medium">{landmark.coordinates.y} m</span>
          </div>
          <div className="bg-[#161a22] p-1.5 border border-white/[0.04]">
            <span className="text-[#656d76] block">Z (North/South)</span>
            <span className="text-[#f0f3f6] font-medium">{landmark.coordinates.z} m</span>
          </div>
        </div>
      </div>

      {/* Architectural Description */}
      <div className="py-3 border-b border-white/[0.08] text-xs text-[#8b949e] leading-relaxed">
        {landmark.description}
      </div>

      {/* Action Strip */}
      <div className="pt-3 flex items-center justify-between">
        <button
          onClick={() => onFocusCamera(getCameraModeForLandmark(landmark.id))}
          className="w-full py-1.5 text-xs font-mono font-medium tracking-wide bg-[#1c212a] hover:bg-[#262c36] text-[#f0f3f6] border border-white/[0.1] transition-colors flex items-center justify-center gap-2"
        >
          <span>FOCUS OBSERVER CAMERA</span>
        </button>
      </div>
    </aside>
  );
};
