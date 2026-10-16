/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { EventBus } from './EventBus.ts';
import { TimeManager } from './TimeManager.ts';
import { RoadNetwork, SpatialGrid } from '../world/RoadNetwork.ts';
import { TrafficManager, TrafficMetrics } from '../traffic/TrafficManager.ts';
import { AStarPathfinder } from '../navigation/AStarPathfinder.ts';
import { Vehicle } from '../vehicles/Vehicle.ts';
import { VehicleClass } from '../vehicles/VehicleTypes.ts';
import { SceneManager } from '../rendering/SceneManager.ts';

export class SimulationEngine {
  public roadNetwork: RoadNetwork;
  public trafficManager: TrafficManager;
  public pathfinder: AStarPathfinder;
  public timeManager: TimeManager;
  public eventBus: EventBus;
  public sceneManager: SceneManager;

  // Vehicle Fleet
  public vehicles: Map<string, Vehicle> = new Map();
  public vehicleSpatialGrid: SpatialGrid<{ id: string; x: number; z: number }> = new SpatialGrid(25);
  public selectedVehicle: Vehicle | null = null;

  // Simulation parameters
  public targetDensity: number = 36;
  private nextVehicleId: number = 1;

  // Animation frame id
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  private collisionCooldowns: Map<string, number> = new Map();

  constructor(container: HTMLElement) {
    this.eventBus = EventBus.getInstance();
    this.timeManager = new TimeManager(60);
    this.roadNetwork = new RoadNetwork();
    this.trafficManager = new TrafficManager();
    this.pathfinder = new AStarPathfinder(this.roadNetwork);

    // Initialize Scene & City World
    this.sceneManager = new SceneManager(container);
    this.sceneManager.initCity(this.roadNetwork, this.trafficManager);

    // Initial vehicle fleet population
    this.populateInitialFleet(this.targetDensity);

    // Bind event handlers
    this.bindEvents();
  }

  private bindEvents(): void {
    this.eventBus.on('vehicle:selected', ({ vehicleId }) => {
      if (!vehicleId) {
        this.selectedVehicle = null;
      } else {
        this.selectedVehicle = this.vehicles.get(vehicleId) || null;
      }
      this.sceneManager.cameraController.targetVehicle = this.selectedVehicle;
    });

    this.eventBus.on('simulation:speed', ({ speed }) => {
      this.timeManager.setTimeScale(speed);
    });

    this.eventBus.on('simulation:pause', ({ isPaused }) => {
      this.timeManager.setPaused(isPaused);
    });

    this.eventBus.on('simulation:reset', () => {
      this.resetSimulation();
    });

    this.eventBus.on('environment:change', ({ timeOfDay, weather }) => {
      this.sceneManager.environment.setTimeOfDay(timeOfDay);
      this.sceneManager.environment.setWeather(weather);
    });

    this.eventBus.on('debug:overlay_toggle', ({ key, enabled }) => {
      if (key === 'sensors') this.sceneManager.showSensors = enabled;
      if (key === 'trajectories') this.sceneManager.showTrajectories = enabled;
      if (key === 'lanes') this.sceneManager.setLaneGraphVisible(enabled);
    });

    this.eventBus.on('layer:landmark_toggle', ({ landmarkId, visible }) => {
      this.setLandmarkVisibility(landmarkId, visible);
    });

    this.eventBus.on('layer:city_toggle', ({ layerKey, visible }) => {
      this.setCityLayerVisibility(layerKey, visible);
    });
  }

  public populateInitialFleet(count: number): void {
    const lanes = this.roadNetwork.getAllLanes();
    if (lanes.length === 0) return;

    const classes: VehicleClass[] = ['TROTRO', 'GH_TAXI', 'SUV_EV', 'SEDAN', 'VAN'];

    let spawned = 0;
    let attempts = 0;

    while (spawned < count && attempts < count * 4) {
      attempts++;
      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      if (lane.totalLength < 15) continue;

      const offsetDist = 5 + Math.random() * (lane.totalLength - 10);
      const vehClass = classes[Math.floor(Math.random() * classes.length)];

      const veh = this.spawnVehicle(vehClass, lane.id, offsetDist);
      if (veh) spawned++;
    }
  }

  public spawnVehicle(
    vehicleClass: VehicleClass = 'SEDAN',
    laneId?: string,
    distanceAlong: number = 5,
    color?: string
  ): Vehicle | null {
    const lanes = this.roadNetwork.getAllLanes();
    if (lanes.length === 0) return null;

    let targetLane = laneId ? this.roadNetwork.getLane(laneId) : undefined;
    if (!targetLane) {
      targetLane = lanes[Math.floor(Math.random() * lanes.length)];
    }
    if (!targetLane) return null;

    const id = `veh_${this.nextVehicleId++}`;
    const vehicle = new Vehicle(id, vehicleClass, targetLane, distanceAlong, color);

    // Plan initial route
    const route = this.pathfinder.findRoute(targetLane.id);
    if (route) {
      vehicle.setRoute(route);
    }

    this.vehicles.set(id, vehicle);
    this.sceneManager.scene.add(vehicle.group);
    this.vehicleSpatialGrid.insert({ id, x: vehicle.controller.x, z: vehicle.controller.z });

    this.eventBus.emit('vehicle:spawned', {
      id,
      type: vehicle.config.displayName,
      color: vehicle.color,
      position: [vehicle.controller.x, vehicle.controller.y, vehicle.controller.z],
    });

    return vehicle;
  }

  public removeVehicle(id: string): void {
    const veh = this.vehicles.get(id);
    if (!veh) return;

    if (this.selectedVehicle?.id === id) {
      this.selectedVehicle = null;
      this.sceneManager.cameraController.targetVehicle = null;
      this.eventBus.emit('vehicle:selected', { vehicleId: null });
    }

    this.sceneManager.scene.remove(veh.group);
    veh.dispose();
    this.vehicleSpatialGrid.remove({ id, x: veh.controller.x, z: veh.controller.z });
    this.vehicles.delete(id);

    this.eventBus.emit('vehicle:removed', { id });
  }

  public setTargetDensity(newDensity: number): void {
    this.targetDensity = Math.max(5, Math.min(120, newDensity));

    const currentCount = this.vehicles.size;
    if (this.targetDensity > currentCount) {
      const diff = this.targetDensity - currentCount;
      const classes: VehicleClass[] = ['TROTRO', 'GH_TAXI', 'SUV_EV', 'SEDAN', 'VAN'];
      for (let i = 0; i < diff; i++) {
        const cls = classes[Math.floor(Math.random() * classes.length)];
        this.spawnVehicle(cls);
      }
    } else if (this.targetDensity < currentCount) {
      const diff = currentCount - this.targetDensity;
      const keys = Array.from(this.vehicles.keys());
      for (let i = 0; i < diff && i < keys.length; i++) {
        if (keys[i] !== this.selectedVehicle?.id) {
          this.removeVehicle(keys[i]);
        }
      }
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const tick = (timestamp: number) => {
      if (!this.isRunning) return;

      // 1. Fixed Timestep Physics Simulation
      const subSteps = this.timeManager.update(timestamp);
      const fixedDt = this.timeManager.getFixedDelta();

      for (let s = 0; s < subSteps; s++) {
        this.fixedSimulationStep(fixedDt);
      }

      // 2. Render Frame
      const realDt = Math.min(0.05, (timestamp - (this.lastRenderTimestamp || timestamp)) / 1000);
      this.lastRenderTimestamp = timestamp;

      this.sceneManager.updateTrafficLights(this.trafficManager);
      this.sceneManager.updateVehicleOverlays(this.selectedVehicle);
      this.sceneManager.render(realDt);

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  private lastRenderTimestamp: number = 0;

  private fixedSimulationStep(dt: number): void {
    const simTime = this.timeManager.getSimulatedTime();

    // 1. Traffic signals progression
    this.trafficManager.update(dt, simTime);

    // 2. Vehicle autonomous updates (perception, planning, kinematics)
    const vehicleArray = Array.from(this.vehicles.values());

    for (let i = 0; i < vehicleArray.length; i++) {
      const veh = vehicleArray[i];
      const isSelected = veh.id === this.selectedVehicle?.id;
      veh.update(dt, vehicleArray, this.roadNetwork, this.trafficManager, isSelected);

      // Update spatial grid
      this.vehicleSpatialGrid.update({ id: veh.id, x: veh.controller.x, z: veh.controller.z });
    }

    // 3. Collision detection & physical resolution
    this.checkAndResolveCollisions(vehicleArray);

    // 4. Maintain target fleet density
    if (this.vehicles.size < this.targetDensity && Math.random() < 0.05) {
      const classes: VehicleClass[] = ['TROTRO', 'GH_TAXI', 'SUV_EV', 'SEDAN', 'VAN'];
      this.spawnVehicle(classes[Math.floor(Math.random() * classes.length)]);
    }
  }

  /**
   * Collision detection using spatial partitioning and oriented bounding radii.
   */
  private checkAndResolveCollisions(vehicles: Vehicle[]): void {
    const simTime = this.timeManager.getSimulatedTime();

    for (let i = 0; i < vehicles.length; i++) {
      const v1 = vehicles[i];
      const nearby = this.vehicleSpatialGrid.queryRadius(v1.controller.x, v1.controller.z, 10);

      for (let j = 0; j < nearby.length; j++) {
        const item = nearby[j];
        if (item.id <= v1.id) continue; // check each pair once

        const v2 = this.vehicles.get(item.id);
        if (!v2) continue;

        const dx = v2.controller.x - v1.controller.x;
        const dz = v2.controller.z - v1.controller.z;
        const dist = Math.hypot(dx, dz);

        // Physical collision bounding distance (actual geometric overlap)
        const minSafeDist = (v1.config.length + v2.config.length) * 0.36;

        if (dist < minSafeDist && dist > 0.001) {
          const pairKey = `${v1.id}_${v2.id}`;
          const lastCollisionTime = this.collisionCooldowns.get(pairKey) || 0;

          // Enforce a 2.0s cooldown per vehicle pair to prevent 60Hz collision event storms
          if (simTime - lastCollisionTime > 2.0) {
            this.collisionCooldowns.set(pairKey, simTime);
            this.eventBus.emit('vehicle:collision', {
              vehicleId1: v1.id,
              vehicleId2: v2.id,
              location: [(v1.controller.x + v2.controller.x) / 2, 0.5, (v1.controller.z + v2.controller.z) / 2],
            });
          }

          // Soft impulse push-back to prevent overlapping mesh clipping
          const overlap = (minSafeDist - dist) * 0.5;
          const nx = dx / dist;
          const nz = dz / dist;

          v1.controller.x -= nx * overlap;
          v1.controller.z -= nz * overlap;
          v2.controller.x += nx * overlap;
          v2.controller.z += nz * overlap;

          // Dampen velocities on physical collision
          v1.controller.velocity = Math.max(0, v1.controller.velocity * 0.5);
          v2.controller.velocity = Math.max(0, v2.controller.velocity * 0.5);
        }
      }
    }
  }

  public getTelemetry(): TrafficMetrics & { fps: number; simTime: number; timeScale: number; isPaused: boolean } {
    const metrics = this.trafficManager.calculateMetrics(
      Array.from(this.vehicles.values()).map(v => ({
        velocity: v.controller.velocity,
        state: v.getState(),
      }))
    );

    return {
      ...metrics,
      fps: this.timeManager.getFps(),
      simTime: Math.round(this.timeManager.getSimulatedTime()),
      timeScale: this.timeManager.getTimeScale(),
      isPaused: this.timeManager.getIsPaused(),
    };
  }

  public resetSimulation(): void {
    // Remove all vehicles
    for (const veh of this.vehicles.values()) {
      this.sceneManager.scene.remove(veh.group);
      veh.dispose();
    }
    this.vehicles.clear();
    this.vehicleSpatialGrid.clear();
    this.selectedVehicle = null;
    this.sceneManager.cameraController.targetVehicle = null;

    // Reset systems
    this.trafficManager.reset();
    this.timeManager.reset();
    this.collisionCooldowns.clear();

    // Re-populate initial fleet
    this.populateInitialFleet(this.targetDensity);
  }

  public stepSimulation(): void {
    if (!this.timeManager.getIsPaused()) {
      this.timeManager.setPaused(true);
    }
    this.timeManager.stepOnce();
    this.fixedSimulationStep(this.timeManager.getFixedDelta());
    this.sceneManager.updateTrafficLights(this.trafficManager);
    this.sceneManager.updateVehicleOverlays(this.selectedVehicle);
    this.sceneManager.render(0.016);
  }

  public setLandmarkVisibility(landmarkId: string, visible: boolean): void {
    this.sceneManager.setLandmarkVisibility(landmarkId, visible);
  }

  public getLandmarkVisibility(landmarkId: string): boolean {
    return this.sceneManager.getLandmarkVisibility(landmarkId);
  }

  public getAllLandmarkVisibilities(): Record<string, boolean> {
    return this.sceneManager.getAllLandmarkVisibilities();
  }

  public setAllLandmarksVisibility(visible: boolean): void {
    this.sceneManager.setAllLandmarksVisibility(visible);
  }

  public setCityLayerVisibility(layerKey: string, visible: boolean): void {
    this.sceneManager.setCityLayerVisibility(layerKey, visible);
  }

  public getCityLayerVisibility(layerKey: string): boolean {
    return this.sceneManager.getCityLayerVisibility(layerKey);
  }

  public getAllCityLayerVisibilities(): Record<string, boolean> {
    return this.sceneManager.getAllCityLayerVisibilities();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public dispose(): void {
    this.stop();
    this.sceneManager.dispose();
  }
}
