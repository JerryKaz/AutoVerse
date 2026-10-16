/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { CameraController, CameraMode } from './CameraController.ts';
import { Environment } from '../world/Environment.ts';
import { CityGenerator, GeneratedCity } from '../world/CityGenerator.ts';
import { RoadNetwork } from '../world/RoadNetwork.ts';
import { TrafficManager } from '../traffic/TrafficManager.ts';
import { Vehicle } from '../vehicles/Vehicle.ts';
import { AccraAssetManager, LandmarkMetadata } from '../world/AccraAssetManager.ts';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public cameraController: CameraController;
  public environment: Environment;

  private cityData: GeneratedCity | null = null;
  private selectedVehicleOverlay: THREE.Group;
  private sensorRayLines: THREE.LineSegments | null = null;
  private trajectoryLine: THREE.Line | null = null;

  // Raycaster for clicking vehicles
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouseVec: THREE.Vector2 = new THREE.Vector2();

  // Debug visualization flags
  public showSensors: boolean = true;
  public showTrajectories: boolean = true;
  public showLaneGraph: boolean = false;

  public landmarkVisibility: Map<string, boolean> = new Map([
    ['black_star_gate', true],
    ['jamestown_lighthouse', true],
    ['colonial_trading_house_1', true],
    ['colonial_trading_house_2', true],
    ['colonial_customs_house', true],
  ]);

  public layerVisibility: Map<string, boolean> = new Map([
    ['modern_towers', true],
    ['makola_market', true],
    ['royal_palms', true],
    ['road_signs', true],
    ['traffic_lights', true],
  ]);

  private laneGraphGroup: THREE.Group | null = null;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();

    // Setup Perspective Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.5,
      1200
    );

    // Setup Renderer with PBR pipeline
    const isHeadless = navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    this.renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance',
    });

    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !isHeadless;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // Initialize Camera Controller & Environment
    this.cameraController = new CameraController(this.camera, container);
    this.environment = new Environment(this.scene, this.renderer);

    // Group for selected vehicle visual indicators
    this.selectedVehicleOverlay = new THREE.Group();
    this.scene.add(this.selectedVehicleOverlay);

    // Handle Window Resize
    window.addEventListener('resize', () => this.onWindowResize(container));

    // Handle Click Selection
    container.addEventListener('pointerdown', (e) => this.onPointerDown(e, container));
  }

  public initCity(roadNetwork: RoadNetwork, trafficManager: TrafficManager): void {
    const generator = new CityGenerator(roadNetwork, trafficManager);
    this.cityData = generator.generate();
    this.scene.add(this.cityData.worldGroup);

    // Optional Lane Graph lines
    this.buildLaneGraphDebug(roadNetwork);
  }

  private buildLaneGraphDebug(roadNetwork: RoadNetwork): void {
    this.laneGraphGroup = new THREE.Group();
    this.laneGraphGroup.name = 'LaneGraphDebug';
    this.laneGraphGroup.visible = this.showLaneGraph;

    const lineMat = new THREE.LineBasicMaterial({ color: 0x8b949e, transparent: true, opacity: 0.45 });

    for (const lane of roadNetwork.getAllLanes()) {
      const points = lane.waypoints.map(w => new THREE.Vector3(w.x, 0.4, w.z));
      if (points.length < 2) continue;
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, lineMat);
      this.laneGraphGroup.add(line);
    }

    this.scene.add(this.laneGraphGroup);
  }

  public updateTrafficLights(trafficManager: TrafficManager): void {
    if (!this.cityData) return;

    for (const [lightId, poleList] of this.cityData.trafficLightMeshes.entries()) {
      const light = trafficManager.getTrafficLight(lightId);
      if (!light) continue;

      for (const pole of poleList) {
        const state = light.getStateForDirection(pole.direction);

        const rMat = pole.redMesh.material as THREE.MeshBasicMaterial;
        const yMat = pole.yellowMesh.material as THREE.MeshBasicMaterial;
        const gMat = pole.greenMesh.material as THREE.MeshBasicMaterial;

        // Realistic emissive glow values
        if (state === 'RED') {
          rMat.color.setHex(0xef4444);
          yMat.color.setHex(0x312003);
          gMat.color.setHex(0x052e16);
        } else if (state === 'YELLOW') {
          rMat.color.setHex(0x3f0a0a);
          yMat.color.setHex(0xf59e0b);
          gMat.color.setHex(0x052e16);
        } else {
          // GREEN
          rMat.color.setHex(0x3f0a0a);
          yMat.color.setHex(0x312003);
          gMat.color.setHex(0x22c55e);
        }
      }
    }
  }

  public updateVehicleOverlays(selectedVehicle: Vehicle | null): void {
    // Clear previous debug overlays
    while (this.selectedVehicleOverlay.children.length > 0) {
      const obj = this.selectedVehicleOverlay.children[0];
      this.selectedVehicleOverlay.remove(obj);
      if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
      if ((obj as THREE.Mesh).material) {
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat.dispose();
      }
    }

    if (!selectedVehicle) return;

    // 1. Selection indicator around vehicle
    const ringGeo = new THREE.RingGeometry(selectedVehicle.config.length * 0.7, selectedVehicle.config.length * 0.76, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xe58514, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(selectedVehicle.controller.x, 0.05, selectedVehicle.controller.z);
    this.selectedVehicleOverlay.add(ring);

    // 2. Lookahead Planned Trajectory Ribbon
    if (this.showTrajectories && selectedVehicle.currentRoute && selectedVehicle.currentRoute.waypoints.length > 0) {
      const points: THREE.Vector3[] = [];
      const wps = selectedVehicle.currentRoute.waypoints;
      for (let i = selectedVehicle.currentWaypointIndex; i < Math.min(wps.length, selectedVehicle.currentWaypointIndex + 25); i++) {
        points.push(new THREE.Vector3(wps[i].x, 0.25, wps[i].z));
      }

      if (points.length >= 2) {
        const trajGeo = new THREE.BufferGeometry().setFromPoints(points);
        const trajMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 });
        const trajLine = new THREE.Line(trajGeo, trajMat);
        this.selectedVehicleOverlay.add(trajLine);
      }
    }

    // 3. Sensor Ray / LiDAR Point Cloud lines
    if (this.showSensors && selectedVehicle.lastSensorData) {
      const lines: THREE.Vector3[] = [];
      const origin = new THREE.Vector3(
        selectedVehicle.controller.x,
        selectedVehicle.config.height * 1.05,
        selectedVehicle.controller.z
      );

      for (const pt of selectedVehicle.lastSensorData.lidarPoints) {
        lines.push(origin);
        lines.push(new THREE.Vector3(pt.x, 0.8, pt.z));
      }

      if (lines.length > 0) {
        const sensorGeo = new THREE.BufferGeometry().setFromPoints(lines);
        const sensorMat = new THREE.LineBasicMaterial({
          color: 0xe58514,
          transparent: true,
          opacity: 0.35,
        });
        const sensorRays = new THREE.LineSegments(sensorGeo, sensorMat);
        this.selectedVehicleOverlay.add(sensorRays);
      }
    }
  }

  private onPointerDown(e: MouseEvent, container: HTMLElement): void {
    // Raycast on vehicles if not dragging camera heavily
    const rect = container.getBoundingClientRect();
    this.mouseVec.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
    this.mouseVec.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseVec, this.camera);
  }

  public raycastVehicles(vehicles: Vehicle[]): Vehicle | null {
    const candidateMeshes: { mesh: THREE.Mesh; vehicle: Vehicle }[] = [];

    for (const v of vehicles) {
      v.group.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          candidateMeshes.push({ mesh: child as THREE.Mesh, vehicle: v });
        }
      });
    }

    const intersects = this.raycaster.intersectObjects(candidateMeshes.map(c => c.mesh), false);
    if (intersects.length > 0) {
      const hit = candidateMeshes.find(c => c.mesh === intersects[0].object);
      if (hit) return hit.vehicle;
    }

    return null;
  }

  public raycastLandmarks(): LandmarkMetadata | null {
    if (!this.cityData) return null;
    const landmarkGroup = this.cityData.worldGroup.getObjectByName('AccraBuildingsAndMonuments');
    if (!landmarkGroup) return null;

    const landmarkMeshes: { mesh: THREE.Mesh; landmarkId: string }[] = [];
    landmarkGroup.traverse(child => {
      if ((child as THREE.Mesh).isMesh && child.visible) {
        let curr: THREE.Object3D | null = child;
        let isHierarchyVisible = true;
        let id: string | null = null;
        while (curr && curr !== landmarkGroup) {
          if (!curr.visible) {
            isHierarchyVisible = false;
            break;
          }
          if (curr.name.startsWith('landmark_')) {
            id = curr.name.replace('landmark_', '');
          }
          curr = curr.parent;
        }
        if (isHierarchyVisible && id && (this.landmarkVisibility.get(id) ?? true)) {
          landmarkMeshes.push({ mesh: child as THREE.Mesh, landmarkId: id });
        }
      }
    });

    if (landmarkMeshes.length === 0) return null;

    const intersects = this.raycaster.intersectObjects(landmarkMeshes.map(m => m.mesh), false);
    if (intersects.length > 0) {
      const hit = landmarkMeshes.find(m => m.mesh === intersects[0].object);
      if (hit) {
        return AccraAssetManager.getInstance().getMetadata(hit.landmarkId) || null;
      }
    }

    return null;
  }

  public setLandmarkVisibility(landmarkId: string, visible: boolean): void {
    this.landmarkVisibility.set(landmarkId, visible);
    if (!this.cityData) return;
    const landmarkObj = this.cityData.worldGroup.getObjectByName(`landmark_${landmarkId}`);
    if (landmarkObj) {
      landmarkObj.visible = visible;
    }
  }

  public getLandmarkVisibility(landmarkId: string): boolean {
    return this.landmarkVisibility.get(landmarkId) ?? true;
  }

  public getAllLandmarkVisibilities(): Record<string, boolean> {
    const res: Record<string, boolean> = {};
    for (const [k, v] of this.landmarkVisibility.entries()) {
      res[k] = v;
    }
    return res;
  }

  public setAllLandmarksVisibility(visible: boolean): void {
    for (const id of this.landmarkVisibility.keys()) {
      this.setLandmarkVisibility(id, visible);
    }
  }

  public setCityLayerVisibility(layerKey: string, visible: boolean): void {
    this.layerVisibility.set(layerKey, visible);
    if (!this.cityData) return;
    const layerObj = this.cityData.worldGroup.getObjectByName(`layer_${layerKey}`);
    if (layerObj) {
      layerObj.visible = visible;
    }
  }

  public getCityLayerVisibility(layerKey: string): boolean {
    return this.layerVisibility.get(layerKey) ?? true;
  }

  public getAllCityLayerVisibilities(): Record<string, boolean> {
    const res: Record<string, boolean> = {};
    for (const [k, v] of this.layerVisibility.entries()) {
      res[k] = v;
    }
    return res;
  }

  public setLaneGraphVisible(visible: boolean): void {
    this.showLaneGraph = visible;
    if (this.laneGraphGroup) {
      this.laneGraphGroup.visible = visible;
    }
  }

  public render(dt: number): void {
    this.cameraController.update(dt);
    this.environment.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize(container: HTMLElement): void {
    if (!container) return;
    this.camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  public dispose(): void {
    this.renderer.dispose();
  }
}
