/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SignalState = 'GREEN' | 'YELLOW' | 'RED';

export interface TrafficSignalPhase {
  duration: number; // in seconds
  stateNS: SignalState;
  stateEW: SignalState;
  name: string;
}

/**
 * TrafficLight controls multi-phase signal cycles with realistic clearance intervals.
 */
export class TrafficLight {
  public id: string;
  public intersectionId: string;
  public phases: TrafficSignalPhase[];
  public currentPhaseIndex: number = 0;
  public timeInCurrentPhase: number = 0;
  public position: { x: number; y: number; z: number };

  constructor(id: string, intersectionId: string, position: { x: number; y: number; z: number }) {
    this.id = id;
    this.intersectionId = intersectionId;
    this.position = position;

    // Standard 4-phase sequence with safety clearance (All-Red)
    this.phases = [
      { duration: 12.0, stateNS: 'GREEN', stateEW: 'RED', name: 'NS Flow' },
      { duration: 3.0, stateNS: 'YELLOW', stateEW: 'RED', name: 'NS Yellow' },
      { duration: 1.5, stateNS: 'RED', stateEW: 'RED', name: 'Clearance' },
      { duration: 10.0, stateNS: 'RED', stateEW: 'GREEN', name: 'EW Flow' },
      { duration: 3.0, stateNS: 'RED', stateEW: 'YELLOW', name: 'EW Yellow' },
      { duration: 1.5, stateNS: 'RED', stateEW: 'RED', name: 'Clearance' },
    ];
  }

  public update(dt: number): boolean {
    this.timeInCurrentPhase += dt;
    const currentPhase = this.phases[this.currentPhaseIndex];

    if (this.timeInCurrentPhase >= currentPhase.duration) {
      this.timeInCurrentPhase = 0;
      this.currentPhaseIndex = (this.currentPhaseIndex + 1) % this.phases.length;
      return true; // Phase changed
    }
    return false;
  }

  public getStateForDirection(direction: 'NS' | 'EW'): SignalState {
    const currentPhase = this.phases[this.currentPhaseIndex];
    return direction === 'NS' ? currentPhase.stateNS : currentPhase.stateEW;
  }

  public getCurrentPhase(): TrafficSignalPhase {
    return this.phases[this.currentPhaseIndex];
  }

  public getRemainingPhaseTime(): number {
    const currentPhase = this.phases[this.currentPhaseIndex];
    return Math.max(0, currentPhase.duration - this.timeInCurrentPhase);
  }
}
