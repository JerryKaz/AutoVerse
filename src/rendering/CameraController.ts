/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { Vehicle } from '../vehicles/Vehicle.ts';

export type CameraMode =
  | 'ORBIT'
  | 'AERIAL'
  | 'FOLLOW'
  | 'HOOD'
  | 'BLACK_STAR_GATE'
  | 'JAMESTOWN_LIGHTHOUSE'
  | 'COLONIAL_DISTRICT'
  | 'INTERSECTION'
  | 'FREE_ROAM';

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  public mode: CameraMode = 'ORBIT';
  public targetVehicle: Vehicle | null = null;

  // Orbit state
  private orbitRadius: number = 180;
  private orbitTheta: number = Math.PI / 4; // azimuth
  private orbitPhi: number = Math.PI / 3.2; // elevation
  private targetLookAt: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private currentLookAt: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Interaction dragging
  private isPointerDown: boolean = false;
  private prevPointerX: number = 0;
  private prevPointerY: number = 0;

  // Free Roam Keys
  private keys: Record<string, boolean> = {};

  // Reusable vectors for zero GC
  private static readonly _desiredPos = new THREE.Vector3();
  private static readonly _targetOffset = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.camera.position.set(130, 110, 130);
    this.camera.lookAt(0, 0, 0);

    this.bindEvents(domElement);
  }

  private bindEvents(domElement: HTMLElement): void {
    domElement.addEventListener('pointerdown', (e) => {
      this.isPointerDown = true;
      this.prevPointerX = e.clientX;
      this.prevPointerY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isPointerDown) return;

      const dx = e.clientX - this.prevPointerX;
      const dy = e.clientY - this.prevPointerY;
      this.prevPointerX = e.clientX;
      this.prevPointerY = e.clientY;

      if (this.mode === 'ORBIT' || this.mode === 'AERIAL') {
        this.orbitTheta -= dx * 0.006;
        this.orbitPhi = Math.max(0.1, Math.min(Math.PI / 2.05, this.orbitPhi - dy * 0.006));
      } else if (this.mode === 'FREE_ROAM') {
        this.camera.rotation.y -= dx * 0.003;
        this.camera.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.camera.rotation.x - dy * 0.003));
      }
    });

    window.addEventListener('pointerup', () => {
      this.isPointerDown = false;
    });

    domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY * 0.12;
      this.orbitRadius = Math.max(20, Math.min(380, this.orbitRadius + zoomDelta));
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  public setMode(mode: CameraMode, vehicle: Vehicle | null = null): void {
    this.mode = mode;
    if (vehicle) {
      this.targetVehicle = vehicle;
    }

    if (mode === 'AERIAL') {
      this.orbitPhi = 0.08; // almost direct top-down
      this.orbitRadius = 260;
    } else if (mode === 'ORBIT') {
      this.orbitPhi = Math.PI / 3.2;
      this.orbitRadius = 180;
    }
  }

  public update(dt: number): void {
    const dampingFactor = 1 - Math.exp(-8 * dt);

    switch (this.mode) {
      case 'ORBIT':
      case 'AERIAL': {
        const x = this.orbitRadius * Math.sin(this.orbitPhi) * Math.sin(this.orbitTheta);
        const y = this.orbitRadius * Math.cos(this.orbitPhi);
        const z = this.orbitRadius * Math.sin(this.orbitPhi) * Math.cos(this.orbitTheta);

        CameraController._desiredPos.set(
          this.targetLookAt.x + x,
          this.targetLookAt.y + y,
          this.targetLookAt.z + z
        );

        this.camera.position.lerp(CameraController._desiredPos, dampingFactor);
        this.currentLookAt.lerp(this.targetLookAt, dampingFactor);
        this.camera.lookAt(this.currentLookAt);
        break;
      }

      case 'FOLLOW': {
        if (!this.targetVehicle) {
          this.setMode('ORBIT');
          return;
        }

        const veh = this.targetVehicle;
        const forwardX = Math.sin(veh.controller.yaw);
        const forwardZ = Math.cos(veh.controller.yaw);

        // Chase position: 14 meters behind, 6 meters up
        const chaseDist = 14.0;
        const chaseHeight = 6.0;

        CameraController._desiredPos.set(
          veh.controller.x - forwardX * chaseDist,
          veh.controller.y + chaseHeight,
          veh.controller.z - forwardZ * chaseDist
        );

        this.camera.position.lerp(CameraController._desiredPos, 1 - Math.exp(-10 * dt));

        // Lookahead 12 meters in front of the vehicle
        CameraController._targetOffset.set(
          veh.controller.x + forwardX * 12.0,
          veh.controller.y + 1.2,
          veh.controller.z + forwardZ * 12.0
        );

        this.currentLookAt.lerp(CameraController._targetOffset, 1 - Math.exp(-12 * dt));
        this.camera.lookAt(this.currentLookAt);
        break;
      }

      case 'HOOD': {
        if (!this.targetVehicle) {
          this.setMode('ORBIT');
          return;
        }

        const veh = this.targetVehicle;
        const forwardX = Math.sin(veh.controller.yaw);
        const forwardZ = Math.cos(veh.controller.yaw);

        // Mounted directly on hood / windshield
        CameraController._desiredPos.set(
          veh.controller.x + forwardX * (veh.config.length * 0.3),
          veh.controller.y + veh.config.height * 0.75,
          veh.controller.z + forwardZ * (veh.config.length * 0.3)
        );

        this.camera.position.copy(CameraController._desiredPos);

        // Aim forward along vehicle heading
        CameraController._targetOffset.set(
          veh.controller.x + forwardX * 35.0,
          veh.controller.y + veh.config.height * 0.6,
          veh.controller.z + forwardZ * 35.0
        );

        this.camera.lookAt(CameraController._targetOffset);
        break;
      }

      case 'BLACK_STAR_GATE':
      case 'INTERSECTION': {
        // Grand civic view of the Black Star Gate & Independence Arch
        CameraController._desiredPos.set(0, 18, 38);
        this.camera.position.lerp(CameraController._desiredPos, dampingFactor);
        this.currentLookAt.lerp(new THREE.Vector3(0, 10, 0), dampingFactor);
        this.camera.lookAt(this.currentLookAt);
        break;
      }

      case 'JAMESTOWN_LIGHTHOUSE': {
        // Dramatic view overlooking Jamestown Lighthouse tower, beacon, and the Atlantic Gulf of Guinea
        CameraController._desiredPos.set(-34, 24, 105);
        this.camera.position.lerp(CameraController._desiredPos, dampingFactor);
        this.currentLookAt.lerp(new THREE.Vector3(-60, 16, 80), dampingFactor);
        this.camera.lookAt(this.currentLookAt);
        break;
      }

      case 'COLONIAL_DISTRICT': {
        // Historic Ga-Mashie / High Street Anglo-Danish colonial verandas & customs house
        CameraController._desiredPos.set(-36, 15, 25);
        this.camera.position.lerp(CameraController._desiredPos, dampingFactor);
        this.currentLookAt.lerp(new THREE.Vector3(-60, 6, 10), dampingFactor);
        this.camera.lookAt(this.currentLookAt);
        break;
      }

      case 'FREE_ROAM': {
        const speed = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) ? 60 : 25;
        const moveDist = speed * dt;

        if (this.keys['KeyW']) this.camera.translateZ(-moveDist);
        if (this.keys['KeyS']) this.camera.translateZ(moveDist);
        if (this.keys['KeyA']) this.camera.translateX(-moveDist);
        if (this.keys['KeyD']) this.camera.translateX(moveDist);
        if (this.keys['KeyE'] || this.keys['Space']) this.camera.position.y += moveDist;
        if (this.keys['KeyQ']) this.camera.position.y = Math.max(2, this.camera.position.y - moveDist);
        break;
      }
    }
  }
}
