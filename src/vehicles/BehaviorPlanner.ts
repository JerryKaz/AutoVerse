/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VehicleConfig, DrivingState } from './VehicleTypes.ts';
import { SensorData } from './SensorSystem.ts';
import { Lane } from '../world/RoadNetwork.ts';

export interface BehaviorPlan {
  state: DrivingState;
  targetAcceleration: number;
  targetSpeed: number;
  targetLaneId: string;
  isBraking: boolean;
  turnSignal: 'NONE' | 'LEFT' | 'RIGHT';
  debugMessage: string;
}

export class BehaviorPlanner {
  private config: VehicleConfig;
  private state: DrivingState = 'CRUISING';
  private laneChangeTimer: number = 0;
  private readonly LANE_CHANGE_DURATION: number = 2.4; // 2.4 seconds to complete smooth lane change

  constructor(config: VehicleConfig) {
    this.config = config;
  }

  public plan(
    dt: number,
    currentSpeed: number,
    currentLane: Lane,
    sensorData: SensorData
  ): BehaviorPlan {
    const roadSpeedLimit = currentLane.speedLimit;
    const targetSpeed = Math.min(this.config.maxSpeed, roadSpeedLimit);

    let targetAcceleration = 0;
    let turnSignal: 'NONE' | 'LEFT' | 'RIGHT' = 'NONE';
    let targetLaneId = currentLane.id;
    let debugMessage = 'Cruising normally';

    // 1. EMERGENCY COLLISION AVOIDANCE
    if (sensorData.leadVehicle && (sensorData.leadVehicle.timeToCollision < 1.3 || sensorData.leadVehicle.distance < 2.8)) {
      this.state = 'EMERGENCY_BRAKE';
      targetAcceleration = -this.config.emergencyDeceleration;
      debugMessage = `EMERGENCY BRAKE: TTC=${sensorData.leadVehicle.timeToCollision.toFixed(1)}s, dist=${sensorData.leadVehicle.distance.toFixed(1)}m`;
      return {
        state: this.state,
        targetAcceleration,
        targetSpeed,
        targetLaneId,
        isBraking: true,
        turnSignal: 'NONE',
        debugMessage,
      };
    }

    // 2. ACTIVE LANE CHANGE STATE MACHINE
    if (this.state === 'CHANGING_LANE_LEFT' || this.state === 'CHANGING_LANE_RIGHT') {
      this.laneChangeTimer += dt;
      turnSignal = this.state === 'CHANGING_LANE_LEFT' ? 'LEFT' : 'RIGHT';

      // Longitudinal acceleration during lane change uses IDM
      targetAcceleration = this.computeIdmAcceleration(currentSpeed, targetSpeed, sensorData.leadVehicle);

      if (this.laneChangeTimer >= this.LANE_CHANGE_DURATION) {
        this.laneChangeTimer = 0;
        this.state = 'CRUISING';
        debugMessage = 'Completed lane transition';
      } else {
        debugMessage = `Executing lane change (${this.laneChangeTimer.toFixed(1)}s / ${this.LANE_CHANGE_DURATION}s)`;
      }

      return {
        state: this.state,
        targetAcceleration,
        targetSpeed,
        targetLaneId,
        isBraking: targetAcceleration < -0.3,
        turnSignal,
        debugMessage,
      };
    }

    // 3. TRAFFIC LIGHT / STOP LINE COMPLIANCE
    if (sensorData.trafficSignal && sensorData.trafficSignal.stopRecommended) {
      const stopDist = Math.max(0.5, sensorData.trafficSignal.distanceToStopLine);

      if (stopDist < 2.0 && currentSpeed < 0.3) {
        this.state = 'WAITING_AT_RED';
        targetAcceleration = -1.0;
        debugMessage = `Stopped at red signal (remaining: ${sensorData.trafficSignal.timeRemaining.toFixed(1)}s)`;
      } else {
        this.state = 'STOPPING_AT_LIGHT';
        // Treat stop line as a stationary obstacle (v_lead = 0, delta_v = currentSpeed)
        targetAcceleration = this.computeVirtualObstacleDeceleration(currentSpeed, stopDist);
        debugMessage = `Decelerating for signal (${stopDist.toFixed(1)}m)`;
      }

      return {
        state: this.state,
        targetAcceleration,
        targetSpeed: 0,
        targetLaneId,
        isBraking: true,
        turnSignal: 'NONE',
        debugMessage,
      };
    }

    // If waiting at red and light turns green, release brake
    if (this.state === 'WAITING_AT_RED' && (!sensorData.trafficSignal || !sensorData.trafficSignal.stopRecommended)) {
      this.state = 'CRUISING';
    }

    // 4. MOBIL LANE CHANGE INCENTIVE CHECK
    // If cruising behind a slow vehicle, check if overtaking in left lane is advantageous
    if (sensorData.leadVehicle && sensorData.leadVehicle.distance < 30.0 && currentLane.leftAdjacentLaneId) {
      const leadSpeed = currentSpeed - sensorData.leadVehicle.relativeSpeed;
      if (leadSpeed < targetSpeed * 0.75 && sensorData.leftLaneGap.isSafe) {
        this.state = 'CHANGING_LANE_LEFT';
        this.laneChangeTimer = 0;
        targetLaneId = currentLane.leftAdjacentLaneId;
        turnSignal = 'LEFT';
        debugMessage = 'Overtaking slower vehicle via left lane';

        return {
          state: this.state,
          targetAcceleration: this.computeIdmAcceleration(currentSpeed, targetSpeed, null),
          targetSpeed,
          targetLaneId,
          isBraking: false,
          turnSignal,
          debugMessage,
        };
      }
    }

    // Return to right lane if right lane is clear and safe (Keep-Right road rule)
    if (currentLane.rightAdjacentLaneId && sensorData.rightLaneGap.isSafe && (!sensorData.leadVehicle || sensorData.leadVehicle.distance > 40)) {
      if (Math.random() < 0.005) { // Small probabilistic trigger to keep traffic natural
        this.state = 'CHANGING_LANE_RIGHT';
        this.laneChangeTimer = 0;
        targetLaneId = currentLane.rightAdjacentLaneId;
        turnSignal = 'RIGHT';
        debugMessage = 'Returning to outer lane (Lane discipline)';

        return {
          state: this.state,
          targetAcceleration: this.computeIdmAcceleration(currentSpeed, targetSpeed, null),
          targetSpeed,
          targetLaneId,
          isBraking: false,
          turnSignal,
          debugMessage,
        };
      }
    }

    // 5. CAR-FOLLOWING (IDM) & FREE ROAD ACCELERATION
    if (sensorData.leadVehicle) {
      this.state = 'FOLLOWING_LEAD';
      targetAcceleration = this.computeIdmAcceleration(currentSpeed, targetSpeed, sensorData.leadVehicle);
      debugMessage = `Following lead vehicle (gap=${sensorData.leadVehicle.distance.toFixed(1)}m, v_lead=${(currentSpeed - sensorData.leadVehicle.relativeSpeed).toFixed(1)}m/s)`;
    } else {
      this.state = 'CRUISING';
      targetAcceleration = this.computeIdmAcceleration(currentSpeed, targetSpeed, null);
      debugMessage = `Cruising at ${(currentSpeed * 3.6).toFixed(0)} km/h (limit ${(roadSpeedLimit * 3.6).toFixed(0)})`;
    }

    return {
      state: this.state,
      targetAcceleration,
      targetSpeed,
      targetLaneId,
      isBraking: targetAcceleration < -0.4,
      turnSignal,
      debugMessage,
    };
  }

  /**
   * Evaluates Intelligent Driver Model (IDM) longitudinal acceleration.
   */
  private computeIdmAcceleration(
    v: number,
    v0: number,
    lead: { distance: number; relativeSpeed: number } | null
  ): number {
    const a = this.config.maxAcceleration;
    const b = this.config.comfortDeceleration;
    const s0 = this.config.jamDistance;
    const T = this.config.desiredTimeHeadway;
    const delta = this.config.accelerationExponent;

    // Free road acceleration term: a * (1 - (v / v0)^delta)
    const ratio = Math.max(0, v / Math.max(1, v0));
    const freeTerm = 1 - Math.pow(ratio, delta);

    let interactionTerm = 0;
    if (lead) {
      const s = Math.max(0.1, lead.distance);
      const deltaV = lead.relativeSpeed; // closing speed

      // Desired dynamic gap: s*(v, deltaV) = s0 + v*T + (v * deltaV) / (2 * sqrt(a * b))
      const dynamicTerm = (v * deltaV) / (2 * Math.sqrt(a * b));
      const sStar = s0 + Math.max(0, v * T + dynamicTerm);

      interactionTerm = Math.pow(sStar / s, 2);
    }

    const rawAcc = a * (freeTerm - interactionTerm);

    // Clamp to vehicle physical boundaries
    return Math.max(-this.config.emergencyDeceleration, Math.min(a, rawAcc));
  }

  /**
   * Smooth braking for virtual obstacles such as stop lines and red signals.
   */
  private computeVirtualObstacleDeceleration(v: number, distance: number): number {
    const s = Math.max(0.5, distance);
    const b = this.config.comfortDeceleration;

    // Required deceleration to stop: v^2 / (2 * s)
    const decelNeeded = (v * v) / (2 * s);
    return -Math.max(0.8, Math.min(b * 1.5, decelNeeded));
  }

  public getState(): DrivingState {
    return this.state;
  }
}
