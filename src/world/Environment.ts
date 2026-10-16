/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type TimeOfDay = 'day' | 'sunset' | 'night';
export type WeatherType = 'clear' | 'fog' | 'rain';

export class Environment {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;

  // Lights
  public dirSunLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;
  public ambientLight: THREE.AmbientLight;

  // Rain system
  private rainParticles: THREE.Points | null = null;

  // Current states
  public currentTimeOfDay: TimeOfDay = 'day';
  public currentWeather: WeatherType = 'clear';

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;

    // 1. Mandatory Studio Environment Reflection (RoomEnvironment) per Three.js guidelines
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 2. Directional Sun/Moon Light with tight orthographic shadow frustum
    this.dirSunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    this.dirSunLight.position.set(120, 160, 100);
    this.dirSunLight.castShadow = true;

    // Shadow configuration
    const d = 160;
    this.dirSunLight.shadow.camera.left = -d;
    this.dirSunLight.shadow.camera.right = d;
    this.dirSunLight.shadow.camera.top = d;
    this.dirSunLight.shadow.camera.bottom = -d;
    this.dirSunLight.shadow.camera.near = 10;
    this.dirSunLight.shadow.camera.far = 400;
    this.dirSunLight.shadow.mapSize.width = 2048;
    this.dirSunLight.shadow.mapSize.height = 2048;
    this.dirSunLight.shadow.bias = -0.0004;
    this.dirSunLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirSunLight);

    // 3. Hemisphere Fill Light (warm sky / cool ground)
    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x1e293b, 1.2);
    this.scene.add(this.hemiLight);

    // 4. Ambient Light baseline
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    // 5. Initialize Fog
    this.scene.fog = new THREE.FogExp2(0x94a3b8, 0.0035);

    // Apply default Day / Clear
    this.setTimeOfDay('day');
  }

  public setTimeOfDay(time: TimeOfDay): void {
    this.currentTimeOfDay = time;

    switch (time) {
      case 'day':
        this.dirSunLight.position.set(120, 160, 100);
        this.dirSunLight.color.setHex(0xfffaed);
        this.dirSunLight.intensity = 2.4;
        this.hemiLight.color.setHex(0xbae6fd);
        this.hemiLight.groundColor.setHex(0x1e293b);
        this.hemiLight.intensity = 1.3;
        this.ambientLight.intensity = 0.5;
        this.scene.background = new THREE.Color(0xa5c9eb);
        (this.scene.fog as THREE.FogExp2).color.setHex(0xa5c9eb);
        (this.scene.fog as THREE.FogExp2).density = this.currentWeather === 'fog' ? 0.02 : 0.0025;
        break;

      case 'sunset':
        this.dirSunLight.position.set(180, 45, 60);
        this.dirSunLight.color.setHex(0xf97316); // Golden orange
        this.dirSunLight.intensity = 2.8;
        this.hemiLight.color.setHex(0xfdba74);
        this.hemiLight.groundColor.setHex(0x312e81);
        this.hemiLight.intensity = 1.0;
        this.ambientLight.intensity = 0.35;
        this.scene.background = new THREE.Color(0x7c2d12);
        (this.scene.fog as THREE.FogExp2).color.setHex(0x7c2d12);
        (this.scene.fog as THREE.FogExp2).density = this.currentWeather === 'fog' ? 0.022 : 0.0035;
        break;

      case 'night':
        this.dirSunLight.position.set(-80, 120, -90);
        this.dirSunLight.color.setHex(0xdbeafe); // Soft natural moonlight
        this.dirSunLight.intensity = 0.45;
        this.hemiLight.color.setHex(0x0f172a);
        this.hemiLight.groundColor.setHex(0x020617);
        this.hemiLight.intensity = 0.4;
        this.ambientLight.intensity = 0.2;
        this.scene.background = new THREE.Color(0x020617);
        (this.scene.fog as THREE.FogExp2).color.setHex(0x020617);
        (this.scene.fog as THREE.FogExp2).density = this.currentWeather === 'fog' ? 0.025 : 0.004;
        break;
    }
  }

  public setWeather(weather: WeatherType): void {
    this.currentWeather = weather;

    const fog = this.scene.fog as THREE.FogExp2;
    if (weather === 'fog') {
      // Harmattan dust haze / coastal Atlantic mist
      fog.density = 0.015;
      if (this.currentTimeOfDay === 'day') {
        fog.color.setHex(0xd6be9e); // warm Saharan Harmattan dust haze
      } else if (this.currentTimeOfDay === 'sunset') {
        fog.color.setHex(0x9a5a32);
      }
    } else {
      fog.density = this.currentTimeOfDay === 'night' ? 0.004 : 0.0025;
      if (this.currentTimeOfDay === 'day') fog.color.setHex(0xa5c9eb);
      else if (this.currentTimeOfDay === 'sunset') fog.color.setHex(0x7c2d12);
      else fog.color.setHex(0x020617);
    }

    if (weather === 'rain') {
      this.initRain();
    } else {
      this.removeRain();
    }
  }

  private initRain(): void {
    if (this.rainParticles) return;

    const count = 3500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 320;
      positions[i * 3 + 1] = Math.random() * 80;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 320;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.6,
      transparent: true,
      opacity: 0.6,
    });

    this.rainParticles = new THREE.Points(geometry, material);
    this.scene.add(this.rainParticles);
  }

  private removeRain(): void {
    if (this.rainParticles) {
      this.scene.remove(this.rainParticles);
      this.rainParticles.geometry.dispose();
      (this.rainParticles.material as THREE.PointsMaterial).dispose();
      this.rainParticles = null;
    }
  }

  public update(dt: number): void {
    // Animate rain drops falling
    if (this.rainParticles) {
      const positions = this.rainParticles.geometry.attributes.position.array as Float32Array;
      const count = positions.length / 3;
      const fallSpeed = 55 * dt;

      for (let i = 0; i < count; i++) {
        positions[i * 3 + 1] -= fallSpeed;
        if (positions[i * 3 + 1] < 0) {
          positions[i * 3 + 1] = 80;
        }
      }
      this.rainParticles.geometry.attributes.position.needsUpdate = true;
    }
  }
}
