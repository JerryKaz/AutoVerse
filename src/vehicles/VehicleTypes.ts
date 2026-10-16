/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VehicleClass = 'TROTRO' | 'GH_TAXI' | 'SUV_EV' | 'SEDAN' | 'VAN';

export type DrivingState =
  | 'CRUISING'
  | 'FOLLOWING_LEAD'
  | 'STOPPING_AT_LIGHT'
  | 'WAITING_AT_RED'
  | 'YIELDING_AT_INTERSECTION'
  | 'CHANGING_LANE_LEFT'
  | 'CHANGING_LANE_RIGHT'
  | 'EMERGENCY_BRAKE'
  | 'ARRIVED';

export interface VehicleConfig {
  className: VehicleClass;
  displayName: string;
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  maxSpeed: number; // m/s
  maxAcceleration: number; // m/s^2
  comfortDeceleration: number; // m/s^2
  emergencyDeceleration: number; // m/s^2
  maxSteeringAngle: number; // radians
  desiredTimeHeadway: number; // T in IDM (seconds)
  jamDistance: number; // s0 in IDM (meters)
  accelerationExponent: number; // delta in IDM
  colorPalette: string[];
  isTrotro?: boolean;
  isGhTaxi?: boolean;
}

export const VEHICLE_CONFIGS: Record<VehicleClass, VehicleConfig> = {
  TROTRO: {
    className: 'TROTRO',
    displayName: 'Autonomous Trotro (Minibus)',
    length: 5.3,
    width: 2.05,
    height: 2.25,
    wheelbase: 3.1,
    maxSpeed: 18.0, // ~65 km/h
    maxAcceleration: 2.0,
    comfortDeceleration: 2.2,
    emergencyDeceleration: 6.0,
    maxSteeringAngle: 0.50,
    desiredTimeHeadway: 1.6,
    jamDistance: 4.0,
    accelerationExponent: 4,
    colorPalette: ['#f8fafc', '#ffffff', '#f1f5f9'],
    isTrotro: true,
  },
  GH_TAXI: {
    className: 'GH_TAXI',
    displayName: 'Accra Autonomous Taxi',
    length: 4.55,
    width: 1.82,
    height: 1.48,
    wheelbase: 2.7,
    maxSpeed: 20.0, // ~72 km/h
    maxAcceleration: 2.6,
    comfortDeceleration: 2.4,
    emergencyDeceleration: 6.5,
    maxSteeringAngle: 0.60,
    desiredTimeHeadway: 1.3,
    jamDistance: 3.4,
    accelerationExponent: 4,
    colorPalette: ['#1e293b', '#0f172a', '#1e3a5f', '#334155'],
    isGhTaxi: true,
  },
  SUV_EV: {
    className: 'SUV_EV',
    displayName: 'Airport City Robotaxi SUV',
    length: 4.85,
    width: 2.0,
    height: 1.68,
    wheelbase: 2.95,
    maxSpeed: 24.0,
    maxAcceleration: 3.2,
    comfortDeceleration: 2.8,
    emergencyDeceleration: 7.0,
    maxSteeringAngle: 0.55,
    desiredTimeHeadway: 1.3,
    jamDistance: 3.8,
    accelerationExponent: 4,
    colorPalette: ['#f8fafc', '#cbd5e1', '#475569', '#134e4a', '#1e293b'],
  },
  SEDAN: {
    className: 'SEDAN',
    displayName: 'Executive Autonomous Sedan',
    length: 4.65,
    width: 1.85,
    height: 1.45,
    wheelbase: 2.75,
    maxSpeed: 22.0, // ~80 km/h
    maxAcceleration: 2.8,
    comfortDeceleration: 2.5,
    emergencyDeceleration: 6.5,
    maxSteeringAngle: 0.60,
    desiredTimeHeadway: 1.4,
    jamDistance: 3.5,
    accelerationExponent: 4,
    colorPalette: ['#374151', '#1e293b', '#9ca3af', '#1e3a5f', '#e2e8f0'],
  },
  VAN: {
    className: 'VAN',
    displayName: 'Accra Logistics Courier Van',
    length: 5.4,
    width: 2.1,
    height: 2.3,
    wheelbase: 3.3,
    maxSpeed: 18.0,
    maxAcceleration: 1.8,
    comfortDeceleration: 2.0,
    emergencyDeceleration: 5.5,
    maxSteeringAngle: 0.48,
    desiredTimeHeadway: 1.8,
    jamDistance: 4.5,
    accelerationExponent: 4,
    colorPalette: ['#f1f5f9', '#334155', '#b45309', '#4b5563'],
  },
};
