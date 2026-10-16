/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { TrafficLight, SignalState } from '../traffic/TrafficLight.ts';
import { Lane } from '../world/RoadNetwork.ts';

export interface LeadVehicleDetection {
  vehicleId: string;
  distance: number; // in meters
  relativeSpeed: number; // m/s (positive if closing in)
  timeToCollision: number; // in seconds (Infinity if opening)
}

export interface LaneGapInfo {
  isSafe: boolean;
  frontGap: number;
  rearGap: number;
  frontVehicleId: string | null;
  rearVehicleId: string | null;
}

export interface TrafficSignalDetection {
  trafficLightId: string;
  state: SignalState;
  distanceToStopLine: number;
  timeRemaining: number;
  stopRecommended: boolean;
}

export interface SensorData {
  leadVehicle: LeadVehicleDetection | null;
  leftLaneGap: LaneGapInfo;
  rightLaneGap: LaneGapInfo;
  trafficSignal: TrafficSignalDetection | null;
  yieldRequired: boolean;
  lidarPoints: Array<{ x: number; z: number; hit: boolean }>;
}

export class SensorSystem {
  public forwardSensorRange: number = 65.0; // 65 meters LiDAR/radar
  public sideSensorRange: number = 30.0;
  public rearSensorRange: number = 35.0;

  // Reusable vectors for zero-allocation math
  private static readonly _posSelf = new THREE.Vector2();
  private static readonly _posOther = new THREE.Vector2();
  private static readonly _forward = new THREE.Vector2();

  /**
   * Scans forward path for lead vehicle within current lane or lookahead trajectory.
   */
  public detectLeadVehicle(
    selfId: string,
    selfPos: { x: number; z: number },
    selfYaw: number,
    selfSpeed: number,
    selfLaneId: string,
    nearbyVehicles: Array<{ id: string; x: number; z: number; yaw: number; velocity: number; currentLaneId: string }>
  ): LeadVehicleDetection | null {
    SensorSystem._posSelf.set(selfPos.x, selfPos.z);
    SensorSystem._forward.set(Math.sin(selfYaw), Math.cos(selfYaw));

    let closestDistance = this.forwardSensorRange;
    let closestVehicle: { id: string; velocity: number } | null = null;

    for (let i = 0; i < nearbyVehicles.length; i++) {
      const other = nearbyVehicles[i];
      if (other.id === selfId) continue;

      SensorSystem._posOther.set(other.x, other.z);
      const toOtherX = SensorSystem._posOther.x - SensorSystem._posSelf.x;
      const toOtherZ = SensorSystem._posOther.y - SensorSystem._posSelf.y;

      // Project onto forward heading
      const forwardDist = toOtherX * SensorSystem._forward.x + toOtherZ * SensorSystem._forward.y;
      if (forwardDist <= 0 || forwardDist > this.forwardSensorRange) continue;

      // Lateral distance from vehicle centerline
      const lateralDist = Math.abs(-toOtherX * SensorSystem._forward.y + toOtherZ * SensorSystem._forward.x);

      // Check if in same lane or within forward lane corridor (width ~ 2.4m)
      const isCorridorMatch = lateralDist < 2.2;
      const isLaneMatch = other.currentLaneId === selfLaneId && lateralDist < 3.5;

      if (isCorridorMatch || isLaneMatch) {
        if (forwardDist < closestDistance) {
          closestDistance = forwardDist;
          closestVehicle = { id: other.id, velocity: other.velocity };
        }
      }
    }

    if (!closestVehicle) return null;

    const relSpeed = selfSpeed - closestVehicle.velocity;
    const ttc = relSpeed > 0.05 ? closestDistance / relSpeed : Infinity;

    return {
      vehicleId: closestVehicle.id,
      distance: closestDistance,
      relativeSpeed: relSpeed,
      timeToCollision: ttc,
    };
  }

  /**
   * Evaluates gap safety for adjacent lane (left or right) for MOBIL lane changing.
   */
  public evaluateAdjacentLaneGap(
    selfId: string,
    selfPos: { x: number; z: number },
    selfYaw: number,
    targetLaneId: string | null,
    nearbyVehicles: Array<{ id: string; x: number; z: number; velocity: number; currentLaneId: string }>
  ): LaneGapInfo {
    if (!targetLaneId) {
      return { isSafe: false, frontGap: 0, rearGap: 0, frontVehicleId: null, rearVehicleId: null };
    }

    SensorSystem._posSelf.set(selfPos.x, selfPos.z);
    SensorSystem._forward.set(Math.sin(selfYaw), Math.cos(selfYaw));

    let minFrontGap = this.sideSensorRange;
    let minRearGap = this.rearSensorRange;
    let frontVehId: string | null = null;
    let rearVehId: string | null = null;

    for (let i = 0; i < nearbyVehicles.length; i++) {
      const other = nearbyVehicles[i];
      if (other.id === selfId) continue;
      if (other.currentLaneId !== targetLaneId) continue;

      const dx = other.x - selfPos.x;
      const dz = other.z - selfPos.z;
      const longitudinalDist = dx * SensorSystem._forward.x + dz * SensorSystem._forward.y;

      if (longitudinalDist >= 0) {
        if (longitudinalDist < minFrontGap) {
          minFrontGap = longitudinalDist;
          frontVehId = other.id;
        }
      } else {
        const rearDist = -longitudinalDist;
        if (rearDist < minRearGap) {
          minRearGap = rearDist;
          rearVehId = other.id;
        }
      }
    }

    // Safety criteria: front gap >= 10m, rear gap >= 12m
    const isSafe = minFrontGap >= 10.0 && minRearGap >= 12.0;

    return {
      isSafe,
      frontGap: minFrontGap,
      rearGap: minRearGap,
      frontVehicleId: frontVehId,
      rearVehicleId: rearVehId,
    };
  }

  /**
   * Scans upcoming traffic signal and stop line.
   */
  public detectTrafficSignal(
    lane: Lane,
    distanceAlongLane: number,
    trafficLight: TrafficLight | undefined,
    selfSpeed: number
  ): TrafficSignalDetection | null {
    if (!trafficLight || !lane.stopLinePoint) return null;

    const distToStopLine = lane.totalLength - distanceAlongLane;
    // Only detect if within 60 meters of the intersection
    if (distToStopLine < 0 || distToStopLine > 60) return null;

    // Determine direction of this lane (North-South vs East-West based on start/end coordinates)
    const pStart = lane.waypoints[0];
    const pEnd = lane.waypoints[lane.waypoints.length - 1];
    const isNS = Math.abs(pEnd.z - pStart.z) > Math.abs(pEnd.x - pStart.x);
    const state = trafficLight.getStateForDirection(isNS ? 'NS' : 'EW');

    let stopRecommended = false;

    if (state === 'RED') {
      stopRecommended = true;
    } else if (state === 'YELLOW') {
      // Dilemma zone calculation:
      // Stopping distance = v^2 / (2 * a_comfort)
      const stoppingDist = (selfSpeed * selfSpeed) / (2 * 2.8);
      // If we are too close to stop comfortably before the stop line, proceed safely
      stopRecommended = distToStopLine > stoppingDist && distToStopLine > 8.0;
    }

    return {
      trafficLightId: trafficLight.id,
      state,
      distanceToStopLine: distToStopLine,
      timeRemaining: trafficLight.getRemainingPhaseTime(),
      stopRecommended,
    };
  }

  /**
   * Generates LiDAR simulated ray points for 3D visualization.
   */
  public generateLidarPointCloud(
    selfPos: { x: number; z: number },
    selfYaw: number,
    nearbyObstacles: Array<{ x: number; z: number; radius: number }>
  ): Array<{ x: number; z: number; hit: boolean }> {
    const points: Array<{ x: number; z: number; hit: boolean }> = [];
    const beamCount = 24;
    const fov = (Math.PI * 2) * (180 / 360); // 180 degree forward arc
    const startAngle = selfYaw - fov / 2;
    const step = fov / (beamCount - 1);

    for (let i = 0; i < beamCount; i++) {
      const angle = startAngle + i * step;
      const dirX = Math.sin(angle);
      const dirZ = Math.cos(angle);

      let hitDist = 28.0;
      let hit = false;

      // Test intersection against obstacle spheres
      for (let j = 0; j < nearbyObstacles.length; j++) {
        const obs = nearbyObstacles[j];
        const ox = obs.x - selfPos.x;
        const oz = obs.z - selfPos.z;

        const proj = ox * dirX + oz * dirZ;
        if (proj > 0 && proj < hitDist) {
          const perpSq = (ox * ox + oz * oz) - (proj * proj);
          if (perpSq < obs.radius * obs.radius) {
            hitDist = Math.max(1.0, proj - Math.sqrt(Math.max(0, obs.radius * obs.radius - perpSq)));
            hit = true;
          }
        }
      }

      points.push({
        x: selfPos.x + dirX * hitDist,
        z: selfPos.z + dirZ * hitDist,
        hit,
      });
    }

    return points;
  }
}
