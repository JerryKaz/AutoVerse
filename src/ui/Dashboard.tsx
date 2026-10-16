/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SimulationEngine } from '../core/SimulationEngine.ts';
import { SimulationStats } from './SimulationStats.tsx';
import { VehicleInspector } from './VehicleInspector.tsx';
import { LandmarkInspector } from './LandmarkInspector.tsx';
import { ControlsDock } from './ControlsDock.tsx';
import { LayerController, ACCRA_LANDMARK_ITEMS } from './LayerController.tsx';
import { TrafficMetrics } from '../traffic/TrafficManager.ts';
import { CameraMode } from '../rendering/CameraController.ts';
import { TimeOfDay, WeatherType } from '../world/Environment.ts';
import { VehicleClass } from '../vehicles/VehicleTypes.ts';
import { Vehicle } from '../vehicles/Vehicle.ts';
import { AccraAssetManager, LandmarkMetadata } from '../world/AccraAssetManager.ts';

export const Dashboard: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SimulationEngine | null>(null);

  // React state for HUD
  const [telemetry, setTelemetry] = useState<
    TrafficMetrics & { fps: number; simTime: number; timeScale: number; isPaused: boolean }
  >({
    activeVehicles: 36,
    averageSpeedKmh: 42,
    flowRateVehPerMin: 28,
    totalDistanceKm: 0,
    congestionIndex: 0,
    collisionCount: 0,
    waitingVehicles: 0,
    fps: 60,
    simTime: 0,
    timeScale: 1.0,
    isPaused: false,
  });

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<LandmarkMetadata | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('ORBIT');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day');
  const [weather, setWeather] = useState<WeatherType>('clear');
  const [density, setDensity] = useState<number>(36);
  const [showSensors, setShowSensors] = useState<boolean>(true);
  const [showTrajectories, setShowTrajectories] = useState<boolean>(true);
  const [showLaneGraph, setShowLaneGraph] = useState<boolean>(false);

  // 3D Scene Layer & Landmark Visibility State
  const [isLayerControllerOpen, setIsLayerControllerOpen] = useState<boolean>(false);
  const [landmarkVisibility, setLandmarkVisibility] = useState<Record<string, boolean>>({
    black_star_gate: true,
    jamestown_lighthouse: true,
    colonial_customs_house: true,
    colonial_trading_house_1: true,
    colonial_trading_house_2: true,
  });
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    modern_towers: true,
    makola_market: true,
    royal_palms: true,
    road_signs: true,
    traffic_lights: true,
  });

  useEffect(() => {
    if (!mountRef.current) return;

    // Instantiate simulation engine once
    const engine = new SimulationEngine(mountRef.current);
    engineRef.current = engine;
    engine.start();

    // Telemetry polling interval (4 Hz to avoid unnecessary React re-renders)
    const telemetryInterval = setInterval(() => {
      if (engineRef.current) {
        setTelemetry(engineRef.current.getTelemetry());
        if (engineRef.current.selectedVehicle) {
          setSelectedVehicle(engineRef.current.selectedVehicle);
        }
      }
    }, 250);

    // Canvas click raycaster for vehicle or landmark selection
    const handleCanvasClick = (e: MouseEvent) => {
      if (!engineRef.current) return;
      const clickedVehicle = engineRef.current.sceneManager.raycastVehicles(
        Array.from(engineRef.current.vehicles.values())
      );
      if (clickedVehicle) {
        engineRef.current.selectedVehicle = clickedVehicle;
        engineRef.current.sceneManager.cameraController.targetVehicle = clickedVehicle;
        setSelectedVehicle(clickedVehicle);
        setSelectedLandmark(null);
        return;
      }

      const clickedLandmark = engineRef.current.sceneManager.raycastLandmarks();
      if (clickedLandmark) {
        setSelectedLandmark(clickedLandmark);
        engineRef.current.selectedVehicle = null;
        engineRef.current.sceneManager.cameraController.targetVehicle = null;
        setSelectedVehicle(null);
        return;
      }

      if (e.clientY < window.innerHeight - 180 && e.clientY > 80) {
        // Deselect if clicked in middle viewport area
        engineRef.current.selectedVehicle = null;
        engineRef.current.sceneManager.cameraController.targetVehicle = null;
        setSelectedVehicle(null);
        setSelectedLandmark(null);
      }
    };

    const container = mountRef.current;
    container.addEventListener('click', handleCanvasClick);

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (engineRef.current) {
          const paused = engineRef.current.timeManager.togglePause();
          setTelemetry(prev => ({ ...prev, isPaused: paused }));
        }
      } else if (e.code === 'Digit1') {
        engineRef.current?.timeManager.setTimeScale(0.5);
        setTelemetry(prev => ({ ...prev, timeScale: 0.5 }));
      } else if (e.code === 'Digit2') {
        engineRef.current?.timeManager.setTimeScale(1.0);
        setTelemetry(prev => ({ ...prev, timeScale: 1.0 }));
      } else if (e.code === 'Digit3') {
        engineRef.current?.timeManager.setTimeScale(2.0);
        setTelemetry(prev => ({ ...prev, timeScale: 2.0 }));
      } else if (e.code === 'Digit4') {
        engineRef.current?.timeManager.setTimeScale(4.0);
        setTelemetry(prev => ({ ...prev, timeScale: 4.0 }));
      } else if (e.code === 'Digit5') {
        engineRef.current?.timeManager.setTimeScale(8.0);
        setTelemetry(prev => ({ ...prev, timeScale: 8.0 }));
      } else if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey) {
        if (engineRef.current) {
          engineRef.current.resetSimulation();
          setSelectedVehicle(null);
        }
      } else if (e.code === 'KeyL' && !e.metaKey && !e.ctrlKey) {
        setIsLayerControllerOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(telemetryInterval);
      container.removeEventListener('click', handleCanvasClick);
      window.removeEventListener('keydown', handleKeyDown);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleToggleLandmark = useCallback((landmarkId: string, visible: boolean) => {
    if (engineRef.current) {
      engineRef.current.setLandmarkVisibility(landmarkId, visible);
      setLandmarkVisibility(prev => ({ ...prev, [landmarkId]: visible }));

      if (!visible && selectedLandmark && selectedLandmark.id === landmarkId) {
        setSelectedLandmark(null);
      }
    }
  }, [selectedLandmark]);

  const handleToggleLayer = useCallback((layerKey: string, visible: boolean) => {
    if (engineRef.current) {
      engineRef.current.setCityLayerVisibility(layerKey, visible);
      setLayerVisibility(prev => ({ ...prev, [layerKey]: visible }));
    }
  }, []);

  const handleShowAllLandmarks = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.setAllLandmarksVisibility(true);
      setLandmarkVisibility({
        black_star_gate: true,
        jamestown_lighthouse: true,
        colonial_customs_house: true,
        colonial_trading_house_1: true,
        colonial_trading_house_2: true,
      });
    }
  }, []);

  const handleHideAllLandmarks = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.setAllLandmarksVisibility(false);
      setLandmarkVisibility({
        black_star_gate: false,
        jamestown_lighthouse: false,
        colonial_customs_house: false,
        colonial_trading_house_1: false,
        colonial_trading_house_2: false,
      });
      setSelectedLandmark(null);
    }
  }, []);

  const handlePlay = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.timeManager.setPaused(false);
      setTelemetry(prev => ({ ...prev, isPaused: false }));
    }
  }, []);

  const handlePause = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.timeManager.setPaused(true);
      setTelemetry(prev => ({ ...prev, isPaused: true }));
    }
  }, []);

  const handleTogglePause = useCallback(() => {
    if (engineRef.current) {
      const paused = engineRef.current.timeManager.togglePause();
      setTelemetry(prev => ({ ...prev, isPaused: paused }));
    }
  }, []);

  const handleSetTimeScale = useCallback((scale: number) => {
    if (engineRef.current) {
      engineRef.current.timeManager.setTimeScale(scale);
      setTelemetry(prev => ({ ...prev, timeScale: scale }));
    }
  }, []);

  const handleStepFrame = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stepSimulation();
      setTelemetry(engineRef.current.getTelemetry());
    }
  }, []);

  const handleReset = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resetSimulation();
      setSelectedVehicle(null);
    }
  }, []);

  const handleSetCameraMode = useCallback((mode: CameraMode) => {
    if (engineRef.current) {
      engineRef.current.sceneManager.cameraController.setMode(mode, selectedVehicle);
      setCameraMode(mode);

      if (mode === 'BLACK_STAR_GATE') {
        setSelectedLandmark(AccraAssetManager.getInstance().getMetadata('black_star_gate') || null);
        setSelectedVehicle(null);
      } else if (mode === 'JAMESTOWN_LIGHTHOUSE') {
        setSelectedLandmark(AccraAssetManager.getInstance().getMetadata('jamestown_lighthouse') || null);
        setSelectedVehicle(null);
      } else if (mode === 'COLONIAL_DISTRICT') {
        setSelectedLandmark(AccraAssetManager.getInstance().getMetadata('colonial_trading_house_1') || null);
        setSelectedVehicle(null);
      }
    }
  }, [selectedVehicle]);

  const handleSetTimeOfDay = useCallback((tod: TimeOfDay) => {
    if (engineRef.current) {
      engineRef.current.sceneManager.environment.setTimeOfDay(tod);
      setTimeOfDay(tod);
    }
  }, []);

  const handleSetWeather = useCallback((w: WeatherType) => {
    if (engineRef.current) {
      engineRef.current.sceneManager.environment.setWeather(w);
      setWeather(w);
    }
  }, []);

  const handleSetDensity = useCallback((d: number) => {
    if (engineRef.current) {
      engineRef.current.setTargetDensity(d);
      setDensity(d);
    }
  }, []);

  const handleToggleOverlay = useCallback((key: string, enabled: boolean) => {
    if (!engineRef.current) return;
    if (key === 'sensors') {
      setShowSensors(enabled);
      engineRef.current.sceneManager.showSensors = enabled;
    } else if (key === 'trajectories') {
      setShowTrajectories(enabled);
      engineRef.current.sceneManager.showTrajectories = enabled;
    } else if (key === 'lanes') {
      setShowLaneGraph(enabled);
      engineRef.current.sceneManager.setLaneGraphVisible(enabled);
    }
  }, []);

  const handleSpawnVehicle = useCallback((cls: VehicleClass) => {
    if (engineRef.current) {
      const v = engineRef.current.spawnVehicle(cls);
      if (v) {
        engineRef.current.selectedVehicle = v;
        engineRef.current.sceneManager.cameraController.targetVehicle = v;
        setSelectedVehicle(v);
        setSelectedLandmark(null);
      }
    }
  }, []);

  const handleEmergencyBrake = useCallback(() => {
    if (selectedVehicle) {
      selectedVehicle.controller.velocity = 0;
      selectedVehicle.controller.acceleration = -selectedVehicle.config.emergencyDeceleration;
    }
  }, [selectedVehicle]);

  const handleDespawnVehicle = useCallback(() => {
    if (selectedVehicle && engineRef.current) {
      engineRef.current.removeVehicle(selectedVehicle.id);
      setSelectedVehicle(null);
    }
  }, [selectedVehicle]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#090b0e] select-none">
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Telemetry Header */}
      {/* Top Telemetry Header */}
      <SimulationStats
        telemetry={telemetry}
        isLayerControllerOpen={isLayerControllerOpen}
        onToggleLayerController={() => setIsLayerControllerOpen(prev => !prev)}
        activeLandmarkCount={Object.values(landmarkVisibility).filter(Boolean).length}
      />

      {/* Selected Vehicle Telemetry Card */}
      <VehicleInspector
        vehicle={selectedVehicle}
        onClose={() => {
          setSelectedVehicle(null);
          if (engineRef.current) {
            engineRef.current.selectedVehicle = null;
            engineRef.current.sceneManager.cameraController.targetVehicle = null;
          }
        }}
        onFocusCamera={() => handleSetCameraMode('FOLLOW')}
        onEmergencyBrake={handleEmergencyBrake}
        onDespawn={handleDespawnVehicle}
      />

      {/* Selected Accra Landmark Telemetry Card */}
      <LandmarkInspector
        landmark={selectedLandmark}
        onClose={() => setSelectedLandmark(null)}
        onFocusCamera={handleSetCameraMode}
      />

      {/* 3D Scene Layer Controller Overlay */}
      {isLayerControllerOpen && (
        <div className="fixed top-16 left-4 z-30 pointer-events-auto">
          <LayerController
            landmarkVisibility={landmarkVisibility}
            layerVisibility={layerVisibility}
            onToggleLandmark={handleToggleLandmark}
            onToggleLayer={handleToggleLayer}
            onShowAllLandmarks={handleShowAllLandmarks}
            onHideAllLandmarks={handleHideAllLandmarks}
            onFocusLandmark={handleSetCameraMode}
            onClose={() => setIsLayerControllerOpen(false)}
          />
        </div>
      )}

      {/* Collapsible Bottom Control Dock */}
      <ControlsDock
        isPaused={telemetry.isPaused}
        timeScale={telemetry.timeScale}
        simTime={telemetry.simTime}
        cameraMode={cameraMode}
        timeOfDay={timeOfDay}
        weather={weather}
        density={density}
        showSensors={showSensors}
        showTrajectories={showTrajectories}
        showLaneGraph={showLaneGraph}
        hasSelectedVehicle={!!selectedVehicle}
        landmarkVisibility={landmarkVisibility}
        layerVisibility={layerVisibility}
        onPlay={handlePlay}
        onPause={handlePause}
        onTogglePause={handleTogglePause}
        onSetTimeScale={handleSetTimeScale}
        onReset={handleReset}
        onStepFrame={handleStepFrame}
        onSetCameraMode={handleSetCameraMode}
        onSetTimeOfDay={handleSetTimeOfDay}
        onSetWeather={handleSetWeather}
        onSetDensity={handleSetDensity}
        onToggleOverlay={handleToggleOverlay}
        onSpawnVehicle={handleSpawnVehicle}
        onToggleLandmark={handleToggleLandmark}
        onToggleLayer={handleToggleLayer}
        onShowAllLandmarks={handleShowAllLandmarks}
        onHideAllLandmarks={handleHideAllLandmarks}
      />
    </div>
  );
};
