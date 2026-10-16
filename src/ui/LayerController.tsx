/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CameraMode } from '../rendering/CameraController.ts';

export interface LandmarkLayerItem {
  id: string;
  name: string;
  coordinates: { x: number; y: number; z: number };
  category: string;
  period: string;
  cameraMode: CameraMode;
  description: string;
}

export const ACCRA_LANDMARK_ITEMS: LandmarkLayerItem[] = [
  {
    id: 'black_star_gate',
    name: 'Black Star Gate & Independence Arch',
    coordinates: { x: 0, y: 0, z: 0 },
    category: 'National Monument',
    period: 'Triumphal Civic • 1961',
    cameraMode: 'BLACK_STAR_GATE',
    description: 'Double classical pylons with coffered vault and five-pointed Black Star crest.',
  },
  {
    id: 'jamestown_lighthouse',
    name: 'Jamestown Lighthouse & Beacon',
    coordinates: { x: -60, y: 0, z: 80 },
    category: 'Maritime Heritage',
    period: 'Stone Masonry • 1930s',
    cameraMode: 'JAMESTOWN_LIGHTHOUSE',
    description: '28-meter red-and-white banded stone beacon with active 360° maritime light.',
  },
  {
    id: 'colonial_customs_house',
    name: 'British Gold Coast Customs House',
    coordinates: { x: -60, y: 0, z: 5 },
    category: 'Colonial Civic',
    period: 'Doric Classical • c. 1895',
    cameraMode: 'COLONIAL_DISTRICT',
    description: 'Raised rusticated plinth with hexastyle Doric colonnade and classical pediment.',
  },
  {
    id: 'colonial_trading_house_1',
    name: 'Anglo-Danish High Street Trading House',
    coordinates: { x: -60, y: 0, z: 35 },
    category: 'Colonial Mercantile',
    period: 'Veranda Heritage • c. 1880',
    cameraMode: 'COLONIAL_DISTRICT',
    description: 'Wrap-around cantilevered timber veranda with louvered ventilation screens.',
  },
  {
    id: 'colonial_trading_house_2',
    name: 'Ga-Mashie Heritage Merchant Lodge',
    coordinates: { x: -60, y: 0, z: -25 },
    category: 'Ga-Mashie Heritage',
    period: 'Gold Coast Lodge • c. 1905',
    cameraMode: 'COLONIAL_DISTRICT',
    description: 'Two-story stone masonry trading lodge with double-leaf wooden shutters.',
  },
];

export interface CityLayerItem {
  key: string;
  name: string;
  category: string;
  description: string;
}

export const ACCRA_DISTRICT_LAYERS: CityLayerItem[] = [
  {
    key: 'modern_towers',
    name: 'Airport City & Ridge Highrises',
    category: 'Modern Commercial',
    description: 'Commercial corporate glass and terracotta mid-rise towers.',
  },
  {
    key: 'makola_market',
    name: 'Makola Market Stalls & Canopies',
    category: 'Urban Commerce',
    description: 'Authentic high-density street merchant stalls with vibrant canvas awnings.',
  },
  {
    key: 'royal_palms',
    name: 'Boulevard Royal Palms',
    category: 'Coastal Greenery',
    description: '75 tropical royal palm trees line the boulevards and Atlantic coast.',
  },
  {
    key: 'road_signs',
    name: 'Overhead Highway Sign Gantries',
    category: 'Wayfinding',
    description: 'Corridor direction signage for Liberation Road, Independence Avenue, and Oxford Street.',
  },
  {
    key: 'traffic_lights',
    name: 'Intersection Traffic Signals',
    category: 'Infrastructure',
    description: 'Automated 4-phase traffic signal mast assemblies controlling the grid.',
  },
];

export interface LayerControllerProps {
  landmarkVisibility: Record<string, boolean>;
  layerVisibility: Record<string, boolean>;
  onToggleLandmark: (landmarkId: string, visible: boolean) => void;
  onToggleLayer: (layerKey: string, visible: boolean) => void;
  onShowAllLandmarks: () => void;
  onHideAllLandmarks: () => void;
  onFocusLandmark?: (cameraMode: CameraMode) => void;
  onClose?: () => void;
  compact?: boolean;
}

export const LayerController: React.FC<LayerControllerProps> = ({
  landmarkVisibility,
  layerVisibility,
  onToggleLandmark,
  onToggleLayer,
  onShowAllLandmarks,
  onHideAllLandmarks,
  onFocusLandmark,
  onClose,
  compact = false,
}) => {
  const visibleLandmarksCount = ACCRA_LANDMARK_ITEMS.filter(
    (item) => landmarkVisibility[item.id] !== false
  ).length;

  return (
    <div
      className={`bg-[#0d1015] border border-white/[0.08] text-[#f0f3f6] select-none ${
        compact ? 'p-3 w-full' : 'p-4 shadow-2xl w-[440px] max-w-[calc(100vw-2rem)]'
      }`}
      role="region"
      aria-label="3D City Landmarks and Layers Controller"
    >
      {/* Header Strip */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 bg-[#e58514] rounded-[1px]" aria-hidden="true" />
          <h2 className="font-mono text-xs font-semibold tracking-wider uppercase text-[#f0f3f6]">
            3D Scene Layer Controller
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 bg-[#161a22] border border-white/[0.08] text-[#8b949e]">
            {visibleLandmarksCount}/{ACCRA_LANDMARK_ITEMS.length} ACTIVE
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close Layer Controller (L)"
              className="text-[#8b949e] hover:text-[#f0f3f6] p-1 transition-colors hover:bg-[#161a22]"
              aria-label="Close Layer Controller"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Global Landmark Visibility Actuation Bar */}
      <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-white/[0.06] text-xs font-mono">
        <span className="text-[10px] tracking-wider uppercase text-[#8b949e]">
          Accra Landmarks
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onShowAllLandmarks}
            className="px-2 py-1 text-[10px] font-mono uppercase bg-[#161a22] hover:bg-[#1c212a] text-[#f0f3f6] border border-white/[0.08] transition-colors"
          >
            Show All
          </button>
          <button
            type="button"
            onClick={onHideAllLandmarks}
            className="px-2 py-1 text-[10px] font-mono uppercase bg-[#161a22] hover:bg-[#1c212a] text-[#8b949e] hover:text-[#f0f3f6] border border-white/[0.08] transition-colors"
          >
            Hide All
          </button>
        </div>
      </div>

      {/* Section 1: City Landmarks & Monuments */}
      <div className="space-y-2 mb-4">
        {ACCRA_LANDMARK_ITEMS.map((item) => {
          const isVisible = landmarkVisibility[item.id] !== false;

          return (
            <div
              key={item.id}
              className={`p-2.5 border transition-all ${
                isVisible
                  ? 'bg-[#12151c] border-white/[0.1]'
                  : 'bg-[#0d1015]/60 border-white/[0.04] opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-[1px] ${
                        isVisible ? 'bg-[#e58514]' : 'bg-[#484f58]'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-xs tracking-tight text-[#f0f3f6] truncate">
                      {item.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-mono text-[#8b949e] mt-1">
                    <span>
                      ({item.coordinates.x.toFixed(0)}, {item.coordinates.z.toFixed(0)})
                    </span>
                    <span className="text-white/[0.12]">•</span>
                    <span className="text-[#6e7681] truncate">{item.period}</span>
                  </div>
                </div>

                {/* Right Action: Camera Jump & Toggle Switch */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  {onFocusLandmark && isVisible && (
                    <button
                      type="button"
                      onClick={() => onFocusLandmark(item.cameraMode)}
                      title={`Focus Camera on ${item.name}`}
                      className="px-1.5 py-1 text-[10px] font-mono text-[#8b949e] hover:text-[#f0f3f6] bg-[#161a22] hover:bg-[#1c212a] border border-white/[0.08] transition-colors"
                    >
                      Locate
                    </button>
                  )}

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isVisible}
                    onClick={() => onToggleLandmark(item.id, !isVisible)}
                    title={isVisible ? `Hide ${item.name}` : `Show ${item.name}`}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors focus:outline-none ${
                      isVisible ? 'bg-[#e58514]' : 'bg-[#21262d]'
                    }`}
                  >
                    <span className="sr-only">Toggle {item.name} visibility</span>
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-150 ease-in-out ${
                        isVisible ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Section 2: Urban Districts & Environmental Layers */}
      <div className="pt-3 border-t border-white/[0.08]">
        <div className="flex items-center justify-between pb-2 mb-2 text-xs font-mono">
          <span className="text-[10px] tracking-wider uppercase text-[#8b949e]">
            Urban & Infrastructure Layers
          </span>
        </div>

        <div className="space-y-1.5">
          {ACCRA_DISTRICT_LAYERS.map((layer) => {
            const isVisible = layerVisibility[layer.key] !== false;

            return (
              <div
                key={layer.key}
                className="flex items-center justify-between py-1.5 px-2 bg-[#12151c]/70 border border-white/[0.05] text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-[1px] ${
                      isVisible ? 'bg-[#3fb950]' : 'bg-[#484f58]'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="truncate">
                    <span className="text-[11px] text-[#f0f3f6] font-medium block truncate">
                      {layer.name}
                    </span>
                    <span className="text-[9px] font-mono text-[#8b949e] block truncate">
                      {layer.category}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isVisible}
                  onClick={() => onToggleLayer(layer.key, !isVisible)}
                  title={isVisible ? `Disable ${layer.name}` : `Enable ${layer.name}`}
                  className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors focus:outline-none ${
                    isVisible ? 'bg-[#238636]' : 'bg-[#21262d]'
                  }`}
                >
                  <span className="sr-only">Toggle {layer.name}</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-150 ease-in-out ${
                      isVisible ? 'translate-x-3' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Instructions / Keyboard Hint */}
      {!compact && (
        <div className="mt-3 pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] font-mono text-[#8b949e]">
          <span>
            <kbd className="px-1 py-0.5 bg-[#161a22] border border-white/[0.1] text-[#c9d1d9] font-mono mr-1">
              L
            </kbd>
            Toggle Layer Panel
          </span>
          <span className="text-[#6e7681]">AutoVerse 3D Layer Subsystem</span>
        </div>
      )}
    </div>
  );
};
