/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SimulationEventMap = {
  'vehicle:spawned': { id: string; type: string; color: string; position: [number, number, number] };
  'vehicle:removed': { id: string };
  'vehicle:collision': { vehicleId1: string; vehicleId2: string; location: [number, number, number] };
  'vehicle:selected': { vehicleId: string | null };
  'vehicle:emergency_brake': { vehicleId: string; reason: string };
  'traffic:light_change': { intersectionId: string; state: string; phaseIndex: number };
  'simulation:speed': { speed: number };
  'simulation:pause': { isPaused: boolean };
  'simulation:reset': void;
  'camera:mode_change': { mode: string };
  'environment:change': { timeOfDay: 'day' | 'sunset' | 'night'; weather: 'clear' | 'fog' | 'rain' };
  'debug:overlay_toggle': { key: string; enabled: boolean };
  'layer:landmark_toggle': { landmarkId: string; visible: boolean };
  'layer:city_toggle': { layerKey: string; visible: boolean };
};

type EventCallback<T> = (data: T) => void;

/**
 * High-performance, typed EventBus for decoupled communication
 * between simulation loops, traffic managers, vehicle controllers, and UI.
 */
export class EventBus {
  private static instance: EventBus;
  private listeners: Map<keyof SimulationEventMap, Set<EventCallback<any>>> = new Map();

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on<K extends keyof SimulationEventMap>(event: K, callback: EventCallback<SimulationEventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  public off<K extends keyof SimulationEventMap>(event: K, callback: EventCallback<SimulationEventMap[K]>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<K extends keyof SimulationEventMap>(event: K, data: SimulationEventMap[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(data);
        } catch (error) {
          console.error(`Error in event handler for "${String(event)}":`, error);
        }
      }
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}
