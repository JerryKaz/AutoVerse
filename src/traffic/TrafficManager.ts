/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TrafficLight, SignalState } from './TrafficLight.ts';
import { EventBus } from '../core/EventBus.ts';

export interface TrafficMetrics {
  activeVehicles: number;
  averageSpeedKmh: number;
  flowRateVehPerMin: number;
  totalDistanceKm: number;
  congestionIndex: number; // 0.0 (free flow) to 1.0 (gridlock)
  collisionCount: number;
  waitingVehicles: number;
}

export class TrafficManager {
  private trafficLights: Map<string, TrafficLight> = new Map();
  private eventBus: EventBus;
  private collisionCount: number = 0;
  private totalDistanceMeters: number = 0;
  private completedTrips: number = 0;
  private tripThroughputWindow: number[] = []; // timestamps of completed trips for throughput rate

  constructor() {
    this.eventBus = EventBus.getInstance();
    this.eventBus.on('vehicle:collision', () => {
      this.collisionCount++;
    });
  }

  public registerTrafficLight(light: TrafficLight): void {
    this.trafficLights.set(light.id, light);
  }

  public getTrafficLight(id: string): TrafficLight | undefined {
    return this.trafficLights.get(id);
  }

  public getAllTrafficLights(): TrafficLight[] {
    return Array.from(this.trafficLights.values());
  }

  public update(dt: number, currentTime: number): void {
    for (const light of this.trafficLights.values()) {
      const changed = light.update(dt);
      if (changed) {
        this.eventBus.emit('traffic:light_change', {
          intersectionId: light.intersectionId,
          state: light.getCurrentPhase().name,
          phaseIndex: light.currentPhaseIndex,
        });
      }
    }

    // Prune throughput window older than 60 seconds
    const cutoff = currentTime - 60;
    while (this.tripThroughputWindow.length > 0 && this.tripThroughputWindow[0] < cutoff) {
      this.tripThroughputWindow.shift();
    }
  }

  public recordCompletedTrip(currentTime: number, distanceTraveledMeters: number): void {
    this.completedTrips++;
    this.totalDistanceMeters += distanceTraveledMeters;
    this.tripThroughputWindow.push(currentTime);
  }

  public recordDistance(meters: number): void {
    this.totalDistanceMeters += meters;
  }

  public calculateMetrics(vehicles: Array<{ velocity: number; state: string }>): TrafficMetrics {
    const activeVehicles = vehicles.length;
    if (activeVehicles === 0) {
      return {
        activeVehicles: 0,
        averageSpeedKmh: 0,
        flowRateVehPerMin: 0,
        totalDistanceKm: this.totalDistanceMeters / 1000,
        congestionIndex: 0,
        collisionCount: this.collisionCount,
        waitingVehicles: 0,
      };
    }

    let totalSpeed = 0;
    let waitingVehicles = 0;

    for (const v of vehicles) {
      totalSpeed += v.velocity;
      if (v.velocity < 1.0) {
        waitingVehicles++;
      }
    }

    const avgSpeedMs = totalSpeed / activeVehicles;
    const avgSpeedKmh = avgSpeedMs * 3.6;

    // Congestion index: fraction of vehicles stopped or moving under 3 m/s
    const slowVehicles = vehicles.filter(v => v.velocity < 3.0).length;
    const congestionIndex = Math.min(1.0, slowVehicles / activeVehicles);

    // Flow rate: trips finished in the last minute + passing vehicle flow
    const flowRateVehPerMin = this.tripThroughputWindow.length + Math.round((avgSpeedKmh / 20) * (activeVehicles / 2));

    return {
      activeVehicles,
      averageSpeedKmh: Math.round(avgSpeedKmh * 10) / 10,
      flowRateVehPerMin: Math.max(flowRateVehPerMin, Math.round(activeVehicles * 0.8)),
      totalDistanceKm: Math.round((this.totalDistanceMeters / 1000) * 10) / 10,
      congestionIndex: Math.round(congestionIndex * 100) / 100,
      collisionCount: this.collisionCount,
      waitingVehicles,
    };
  }

  public reset(): void {
    this.collisionCount = 0;
    this.totalDistanceMeters = 0;
    this.completedTrips = 0;
    this.tripThroughputWindow = [];
  }
}
