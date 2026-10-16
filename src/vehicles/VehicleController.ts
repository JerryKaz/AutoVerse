/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { VehicleConfig } from './VehicleTypes.ts';
import { Waypoint } from '../world/RoadNetwork.ts';

export class VehicleController {
  private config: VehicleConfig;

  // State variables
  public x: number = 0;
  public y: number = 0;
  public z: number = 0;
  public yaw: number = 0; // heading angle in radians (0 = along +Z axis, PI/2 = along +X axis)
  public velocity: number = 0; // m/s
  public acceleration: number = 0; // m/s^2
  public steeringAngle: number = 0; // radians
  public wheelRotation: number = 0; // visual wheel spinning angle

  // Reusable vectors for zero GC in update loop
  private static readonly _lookaheadVec = new THREE.Vector2();

  constructor(config: VehicleConfig, initialX: number, initialZ: number, initialYaw: number) {
    this.config = config;
    this.x = initialX;
    this.z = initialZ;
    this.yaw = initialYaw;
  }

  /**
   * Updates vehicle kinematics based on target acceleration and target path.
   */
  public update(
    dt: number,
    targetAcc: number,
    targetWaypoints: Waypoint[],
    currentWaypointIndex: number
  ): number {
    // 1. Longitudinal acceleration integration
    this.acceleration = targetAcc;
    this.velocity = Math.max(0, this.velocity + this.acceleration * dt);

    // 2. Lateral control via Pure Pursuit tracking
    const lookaheadDist = Math.max(3.5, 0.45 * this.velocity);
    const { targetPoint, nextIndex } = this.findLookaheadPoint(
      targetWaypoints,
      currentWaypointIndex,
      lookaheadDist
    );

    let targetSteering = 0;
    if (targetPoint) {
      VehicleController._lookaheadVec.set(targetPoint.x - this.x, targetPoint.z - this.z);
      const angleToTarget = Math.atan2(VehicleController._lookaheadVec.x, VehicleController._lookaheadVec.y);

      // Relative heading error normalized to [-PI, PI]
      let alpha = angleToTarget - this.yaw;
      while (alpha > Math.PI) alpha -= 2 * Math.PI;
      while (alpha < -Math.PI) alpha += 2 * Math.PI;

      // Pure Pursuit curvature formula: delta = atan2(2 * L * sin(alpha), lookaheadDist)
      const L = this.config.wheelbase;
      targetSteering = Math.atan2(2 * L * Math.sin(alpha), lookaheadDist);
      targetSteering = Math.max(-this.config.maxSteeringAngle, Math.min(this.config.maxSteeringAngle, targetSteering));
    }

    // Steering slew rate limit (smoothes steering commands, avoids instant snapping)
    const maxSteerRate = 2.4; // rad/s
    const steerDiff = targetSteering - this.steeringAngle;
    const maxChange = maxSteerRate * dt;
    this.steeringAngle += Math.max(-maxChange, Math.min(maxChange, steerDiff));

    // 3. Bicycle kinematics integration
    const L = this.config.wheelbase;
    const lr = L * 0.5; // center of gravity near midpoint
    const beta = Math.atan((lr / L) * Math.tan(this.steeringAngle));

    // Motion equations
    const vx = this.velocity * Math.sin(this.yaw + beta);
    const vz = this.velocity * Math.cos(this.yaw + beta);
    const yawRate = (this.velocity / L) * Math.cos(beta) * Math.tan(this.steeringAngle);

    this.x += vx * dt;
    this.z += vz * dt;
    this.yaw += yawRate * dt;

    // Normalize yaw to [-PI, PI]
    while (this.yaw > Math.PI) this.yaw -= 2 * Math.PI;
    while (this.yaw < -Math.PI) this.yaw += 2 * Math.PI;

    // Visual wheel rotation around axle
    const wheelRadius = 0.35;
    this.wheelRotation += (this.velocity / wheelRadius) * dt;

    return nextIndex;
  }

  /**
   * Finds lookahead target point on the path ahead of the vehicle.
   */
  private findLookaheadPoint(
    waypoints: Waypoint[],
    startIndex: number,
    lookaheadDistance: number
  ): { targetPoint: Waypoint | null; nextIndex: number } {
    if (waypoints.length === 0) {
      return { targetPoint: null, nextIndex: startIndex };
    }

    let currentIndex = Math.min(startIndex, waypoints.length - 1);
    let targetPoint: Waypoint | null = null;

    for (let i = currentIndex; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const dx = wp.x - this.x;
      const dz = wp.z - this.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist >= lookaheadDistance) {
        targetPoint = wp;
        currentIndex = Math.max(0, i - 1);
        break;
      }
    }

    // If reached end of waypoints, aim at the final waypoint
    if (!targetPoint && waypoints.length > 0) {
      targetPoint = waypoints[waypoints.length - 1];
    }

    return { targetPoint, nextIndex: currentIndex };
  }
}
