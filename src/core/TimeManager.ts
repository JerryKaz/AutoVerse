/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Fixed-timestep time manager for deterministic simulation physics and behavior.
 * Decouples rendering frame rates from simulation physics updates.
 */
export class TimeManager {
  private fixedDeltaTime: number = 1 / 60; // 60Hz fixed simulation rate (16.67ms)
  private accumulator: number = 0;
  private maxSubSteps: number = 5; // Prevent spiral of death during frame drops
  private timeScale: number = 1.0;
  private isPaused: boolean = false;

  private totalSimulatedTime: number = 0;
  private tickCount: number = 0;

  // Frame rate profiling
  private lastTimestamp: number = 0;
  private frameCount: number = 0;
  private fpsAccumulator: number = 0;
  private currentFps: number = 60;
  private lastFpsUpdate: number = 0;

  constructor(fixedHz: number = 60) {
    this.fixedDeltaTime = 1 / fixedHz;
  }

  public update(currentTimestampMs: number): number {
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = currentTimestampMs;
      this.lastFpsUpdate = currentTimestampMs;
      return 0;
    }

    const realDeltaSec = Math.min((currentTimestampMs - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = currentTimestampMs;

    // Profiling FPS
    this.frameCount++;
    this.fpsAccumulator += realDeltaSec;
    if (currentTimestampMs - this.lastFpsUpdate >= 500) {
      this.currentFps = Math.round(this.frameCount / this.fpsAccumulator);
      this.frameCount = 0;
      this.fpsAccumulator = 0;
      this.lastFpsUpdate = currentTimestampMs;
    }

    if (this.isPaused) {
      return 0;
    }

    // Accumulate scaled delta time
    this.accumulator += realDeltaSec * this.timeScale;

    let steps = 0;
    while (this.accumulator >= this.fixedDeltaTime && steps < this.maxSubSteps) {
      this.accumulator -= this.fixedDeltaTime;
      this.totalSimulatedTime += this.fixedDeltaTime;
      this.tickCount++;
      steps++;
    }

    // If still behind after maxSubSteps, discard residue to avoid spiral of death
    if (this.accumulator > this.fixedDeltaTime) {
      this.accumulator = 0;
    }

    return steps;
  }

  public getFixedDelta(): number {
    return this.fixedDeltaTime;
  }

  public getTimeScale(): number {
    return this.timeScale;
  }

  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0.1, Math.min(scale, 8.0));
  }

  public togglePause(): boolean {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public getFps(): number {
    return this.currentFps;
  }

  public getSimulatedTime(): number {
    return this.totalSimulatedTime;
  }

  public getTickCount(): number {
    return this.tickCount;
  }

  public stepOnce(): void {
    this.totalSimulatedTime += this.fixedDeltaTime;
    this.tickCount++;
  }

  public reset(): void {
    this.accumulator = 0;
    this.totalSimulatedTime = 0;
    this.tickCount = 0;
    this.lastTimestamp = 0;
  }
}
