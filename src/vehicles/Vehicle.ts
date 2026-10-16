/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { VehicleConfig, VEHICLE_CONFIGS, VehicleClass, DrivingState } from './VehicleTypes.ts';
import { VehicleController } from './VehicleController.ts';
import { SensorSystem, SensorData } from './SensorSystem.ts';
import { BehaviorPlanner } from './BehaviorPlanner.ts';
import { PlannedRoute } from '../navigation/AStarPathfinder.ts';
import { Lane, RoadNetwork } from '../world/RoadNetwork.ts';
import { TrafficManager } from '../traffic/TrafficManager.ts';

export class Vehicle {
  public id: string;
  public config: VehicleConfig;
  public color: string;

  // Subsystems
  public controller: VehicleController;
  public sensors: SensorSystem;
  public planner: BehaviorPlanner;

  // Routing and Navigation state
  public currentLane: Lane;
  public currentRoute: PlannedRoute | null = null;
  public currentWaypointIndex: number = 0;
  public distanceTraveled: number = 0;
  public timeInSimulation: number = 0;

  // 3D Rendering Objects
  public group: THREE.Group;
  private brakeLightMeshes: THREE.Mesh[] = [];
  private leftTurnLightMeshes: THREE.Mesh[] = [];
  private rightTurnLightMeshes: THREE.Mesh[] = [];
  private frontWheelGroups: THREE.Group[] = [];
  private rearWheelGroups: THREE.Group[] = [];
  private lidarPuck: THREE.Mesh | null = null;
  private sensorRayLines: THREE.LineSegments | null = null;
  private trajectoryLine: THREE.Line | null = null;

  // Turn signal blink timer
  private blinkTimer: number = 0;
  private blinkState: boolean = false;

  // Cached sensor data for telemetry and inspection
  public lastSensorData: SensorData | null = null;
  public lastDebugMessage: string = 'Initializing';

  constructor(
    id: string,
    vehicleClass: VehicleClass,
    startLane: Lane,
    startDistanceAlongLane: number,
    colorOverride?: string
  ) {
    this.id = id;
    this.config = VEHICLE_CONFIGS[vehicleClass];
    this.currentLane = startLane;

    // Pick color
    const palette = this.config.colorPalette;
    this.color = colorOverride || palette[Math.floor(Math.random() * palette.length)];

    // Evaluate initial position and heading
    const initialPos = new THREE.Vector3();
    const initialTangent = new THREE.Vector3();
    const dummyNetwork = new RoadNetwork(); // helper evaluator
    dummyNetwork.evaluateLanePosition(startLane, startDistanceAlongLane, initialPos, initialTangent);

    const initialYaw = Math.atan2(initialTangent.x, initialTangent.z);

    this.controller = new VehicleController(this.config, initialPos.x, initialPos.z, initialYaw);
    this.controller.y = 0.2;
    this.sensors = new SensorSystem();
    this.planner = new BehaviorPlanner(this.config);

    // Build 3D procedural composite mesh (3-12 parts)
    this.group = this.buildProceduralMesh();
    this.updateMeshTransforms();
  }

  /**
   * Builds an intricate 3D composite vehicle model conforming to Three.js design guidelines.
   */
  private buildProceduralMesh(): THREE.Group {
    const group = new THREE.Group();
    group.name = `vehicle-${this.id}`;

    const { length, width, height } = this.config;
    const bodyColor = new THREE.Color(this.color);

    // 1. Lower chassis / body
    const chassisGeo = new THREE.BoxGeometry(width, height * 0.45, length);
    const chassisMat = new THREE.MeshPhysicalMaterial({
      color: bodyColor,
      metalness: 0.65,
      roughness: 0.25,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = height * 0.35;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    group.add(chassis);

    // 2. Cabin / Greenhouse (tinted physical glass with specular reflections)
    const cabinLength = length * 0.55;
    const cabinWidth = width * 0.85;
    const cabinHeight = height * 0.45;
    const cabinGeo = new THREE.BoxGeometry(cabinWidth, cabinHeight, cabinLength);
    const cabinMat = new THREE.MeshPhysicalMaterial({
      color: 0x111827,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.3,
      thickness: 0.8,
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, height * 0.72, -length * 0.05);
    cabin.castShadow = true;
    group.add(cabin);

    // 3. Front grille & bumper accent
    const bumperGeo = new THREE.BoxGeometry(width * 0.95, height * 0.2, 0.2);
    const darkAccentMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8, metalness: 0.3 });
    const frontBumper = new THREE.Mesh(bumperGeo, darkAccentMat);
    frontBumper.position.set(0, height * 0.25, length * 0.5);
    group.add(frontBumper);

    // Special Livery for Accra Ghanaian Taxi (Iconic Yellow Fenders)
    if (this.config.isGhTaxi) {
      const yellowFenderMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5, roughness: 0.3 });
      const fenderL = length * 0.28;
      const fenderH = height * 0.44;

      // Front yellow quarter panels
      const frontFenderGeo = new THREE.BoxGeometry(width * 1.01, fenderH, fenderL);
      const frontFender = new THREE.Mesh(frontFenderGeo, yellowFenderMat);
      frontFender.position.set(0, height * 0.35, length * 0.36);
      frontFender.castShadow = true;
      group.add(frontFender);

      // Rear yellow quarter panels
      const rearFenderGeo = new THREE.BoxGeometry(width * 1.01, fenderH, fenderL);
      const rearFender = new THREE.Mesh(rearFenderGeo, yellowFenderMat);
      rearFender.position.set(0, height * 0.35, -length * 0.36);
      rearFender.castShadow = true;
      group.add(rearFender);

      // Illuminated Roof Taxi Light
      const taxiSignGeo = new THREE.BoxGeometry(width * 0.32, 0.14, 0.28);
      const taxiSignMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      const taxiSign = new THREE.Mesh(taxiSignGeo, taxiSignMat);
      taxiSign.position.set(0, height * 0.98, length * 0.05);
      group.add(taxiSign);
    }

    // Special Livery for Accra Trotro (Minibus Transit Stripe & Roof Luggage)
    if (this.config.isTrotro) {
      // Yellow horizontal waistline stripe
      const stripeGeo = new THREE.BoxGeometry(width * 1.02, 0.16, length * 0.98);
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });
      const stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
      stripeMesh.position.set(0, height * 0.52, 0);
      group.add(stripeMesh);

      // Roof luggage rack
      const rackMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.8, roughness: 0.2 });
      const rackGeo = new THREE.BoxGeometry(width * 0.8, 0.12, length * 0.55);
      const rackMesh = new THREE.Mesh(rackGeo, rackMat);
      rackMesh.position.set(0, height * 0.96, -length * 0.08);
      group.add(rackMesh);

      // Luggage boxes / bags on roof
      const bagMat1 = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9 });
      const bagMat2 = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.9 });
      const bag1 = new THREE.Mesh(new THREE.BoxGeometry(width * 0.45, 0.24, 0.8), bagMat1);
      bag1.position.set(-0.15, height * 1.1, -length * 0.15);
      const bag2 = new THREE.Mesh(new THREE.BoxGeometry(width * 0.35, 0.28, 0.7), bagMat2);
      bag2.position.set(0.2, height * 1.12, 0);
      group.add(bag1, bag2);
    }

    // 4. Autonomous Sensor Dome & Rotating LiDAR Puck on Roof
    const roofMountGeo = new THREE.CylinderGeometry(0.28, 0.35, 0.12, 16);
    const roofMountMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.8, roughness: 0.2 });
    const roofMount = new THREE.Mesh(roofMountGeo, roofMountMat);
    roofMount.position.set(0, height * 0.98, -length * 0.05);
    group.add(roofMount);

    const puckGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.14, 16);
    const puckMat = new THREE.MeshStandardMaterial({ color: 0x1c2128, metalness: 0.85, roughness: 0.2 });
    this.lidarPuck = new THREE.Mesh(puckGeo, puckMat);
    this.lidarPuck.position.set(0, height * 1.08, -length * 0.05);
    group.add(this.lidarPuck);

    // 5. Headlights (Bright dual LED strips)
    const headlightGeo = new THREE.BoxGeometry(width * 0.22, 0.08, 0.05);
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const leftHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
    leftHeadlight.position.set(-width * 0.32, height * 0.38, length * 0.505);
    const rightHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
    rightHeadlight.position.set(width * 0.32, height * 0.38, length * 0.505);
    group.add(leftHeadlight, rightHeadlight);

    // 6. Brake lights (Red LED strip across rear)
    const brakeLightGeo = new THREE.BoxGeometry(width * 0.35, 0.08, 0.05);
    const brakeLightMat1 = new THREE.MeshBasicMaterial({ color: 0x7f1d1d });
    const brakeLightMat2 = new THREE.MeshBasicMaterial({ color: 0x7f1d1d });
    const leftBrakeLight = new THREE.Mesh(brakeLightGeo, brakeLightMat1);
    leftBrakeLight.position.set(-width * 0.25, height * 0.42, -length * 0.505);
    const rightBrakeLight = new THREE.Mesh(brakeLightGeo, brakeLightMat2);
    rightBrakeLight.position.set(width * 0.25, height * 0.42, -length * 0.505);
    group.add(leftBrakeLight, rightBrakeLight);
    this.brakeLightMeshes.push(leftBrakeLight, rightBrakeLight);

    // 7. Amber Turn Signals
    const turnSignalGeo = new THREE.BoxGeometry(0.12, 0.06, 0.05);
    const turnMatL = new THREE.MeshBasicMaterial({ color: 0x451a03 });
    const turnMatR = new THREE.MeshBasicMaterial({ color: 0x451a03 });

    const frontLeftTurn = new THREE.Mesh(turnSignalGeo, turnMatL);
    frontLeftTurn.position.set(-width * 0.46, height * 0.38, length * 0.49);
    const rearLeftTurn = new THREE.Mesh(turnSignalGeo, turnMatL);
    rearLeftTurn.position.set(-width * 0.46, height * 0.42, -length * 0.49);
    group.add(frontLeftTurn, rearLeftTurn);
    this.leftTurnLightMeshes.push(frontLeftTurn, rearLeftTurn);

    const frontRightTurn = new THREE.Mesh(turnSignalGeo, turnMatR);
    frontRightTurn.position.set(width * 0.46, height * 0.38, length * 0.49);
    const rearRightTurn = new THREE.Mesh(turnSignalGeo, turnMatR);
    rearRightTurn.position.set(width * 0.46, height * 0.42, -length * 0.49);
    group.add(frontRightTurn, rearRightTurn);
    this.rightTurnLightMeshes.push(frontRightTurn, rearRightTurn);

    // 8. Wheels (4 composite wheels with rubber tire + metallic rim)
    const wheelRadius = 0.35;
    const wheelWidth = 0.22;
    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 18);
    wheelGeo.rotateZ(Math.PI / 2); // align axle along X axis
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9, metalness: 0.1 });

    const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelWidth + 0.02, 12);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85, roughness: 0.2 });

    const halfTrack = width * 0.52;
    const halfBase = this.config.wheelbase * 0.5;

    const createWheel = (x: number, z: number, isFront: boolean): THREE.Group => {
      const wGroup = new THREE.Group();
      wGroup.position.set(x, wheelRadius, z);

      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.castShadow = true;
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wGroup.add(tire, rim);

      if (isFront) {
        this.frontWheelGroups.push(wGroup);
      } else {
        this.rearWheelGroups.push(wGroup);
      }
      return wGroup;
    };

    group.add(createWheel(-halfTrack, halfBase, true));
    group.add(createWheel(halfTrack, halfBase, true));
    group.add(createWheel(-halfTrack, -halfBase, false));
    group.add(createWheel(halfTrack, -halfBase, false));

    // 9. Ground contact shadow plane beneath car (prevents floating illusion per Three.js guidelines)
    const shadowGeo = new THREE.PlaneGeometry(width * 1.2, length * 1.1);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.position.y = 0.02;
    group.add(contactShadow);

    return group;
  }

  /**
   * Sets route planned by A* pathfinder.
   */
  public setRoute(route: PlannedRoute): void {
    this.currentRoute = route;
    this.currentWaypointIndex = 0;
  }

  /**
   * Core simulation tick: perception -> behavior planning -> kinematics.
   */
  public update(
    dt: number,
    allVehicles: Vehicle[],
    roadNetwork: RoadNetwork,
    trafficManager: TrafficManager,
    isSelected: boolean = false
  ): void {
    this.timeInSimulation += dt;

    if (!this.currentRoute || this.currentRoute.waypoints.length === 0) {
      return;
    }

    // 1. Perception Scan
    const currentPos = { x: this.controller.x, z: this.controller.z };

    // Single pass snapshot of all vehicles for perception to minimize GC pressure
    const vehicleProxies = allVehicles.map(v => ({
      id: v.id,
      x: v.controller.x,
      z: v.controller.z,
      yaw: v.controller.yaw,
      velocity: v.controller.velocity,
      currentLaneId: v.currentLane.id,
    }));

    const leadVehicle = this.sensors.detectLeadVehicle(
      this.id,
      currentPos,
      this.controller.yaw,
      this.controller.velocity,
      this.currentLane.id,
      vehicleProxies
    );

    // Calculate distance along current lane
    const closest = roadNetwork.findClosestLane(this.controller.x, this.controller.z);
    if (closest && closest.lane.id === this.currentLane.id) {
      // update lane reference
    }

    const trafficLight = this.currentLane.trafficLightId
      ? trafficManager.getTrafficLight(this.currentLane.trafficLightId)
      : undefined;

    const trafficSignalDetection = this.sensors.detectTrafficSignal(
      this.currentLane,
      closest ? closest.distanceAlong : 0,
      trafficLight,
      this.controller.velocity
    );

    const leftLaneGap = this.sensors.evaluateAdjacentLaneGap(
      this.id,
      currentPos,
      this.controller.yaw,
      this.currentLane.leftAdjacentLaneId,
      vehicleProxies
    );

    const rightLaneGap = this.sensors.evaluateAdjacentLaneGap(
      this.id,
      currentPos,
      this.controller.yaw,
      this.currentLane.rightAdjacentLaneId,
      vehicleProxies
    );

    // Only compute costly 24-ray LiDAR raycasts for the actively selected vehicle overlay
    let lidarPoints: Array<{ x: number; z: number; hit: boolean }> = [];
    if (isSelected) {
      const lidarObstacles = allVehicles
        .filter(v => v.id !== this.id && Math.hypot(v.controller.x - currentPos.x, v.controller.z - currentPos.z) < 30)
        .map(v => ({ x: v.controller.x, z: v.controller.z, radius: 1.5 }));

      lidarPoints = this.sensors.generateLidarPointCloud(currentPos, this.controller.yaw, lidarObstacles);
    }

    this.lastSensorData = {
      leadVehicle,
      leftLaneGap,
      rightLaneGap,
      trafficSignal: trafficSignalDetection,
      yieldRequired: false,
      lidarPoints,
    };

    // 2. Behavior Planning
    const plan = this.planner.plan(dt, this.controller.velocity, this.currentLane, this.lastSensorData);
    this.lastDebugMessage = plan.debugMessage;

    // Handle lane change target update
    if (plan.targetLaneId !== this.currentLane.id) {
      const newLane = roadNetwork.getLane(plan.targetLaneId);
      if (newLane) {
        this.currentLane = newLane;
      }
    }

    // 3. Motion Kinematics Integration
    const prevX = this.controller.x;
    const prevZ = this.controller.z;

    this.currentWaypointIndex = this.controller.update(
      dt,
      plan.targetAcceleration,
      this.currentRoute.waypoints,
      this.currentWaypointIndex
    );

    const stepDist = Math.hypot(this.controller.x - prevX, this.controller.z - prevZ);
    this.distanceTraveled += stepDist;
    trafficManager.recordDistance(stepDist);

    // 4. Check if reached end of current route
    if (this.currentWaypointIndex >= this.currentRoute.waypoints.length - 2) {
      // Select next connecting lane
      const connections = this.currentLane.outgoingConnections;
      if (connections.length > 0) {
        const nextConn = connections[Math.floor(Math.random() * connections.length)];
        const nextLane = roadNetwork.getLane(nextConn.targetLaneId);
        if (nextLane) {
          this.currentLane = nextLane;
          // Loop or stitch next segment
          this.currentWaypointIndex = 0;
        }
      }
    }

    // 5. Visual Lighting & Animation Updates
    this.updateVisualSignals(dt, plan.isBraking, plan.turnSignal);
    this.updateMeshTransforms();
  }

  /**
   * Updates brake lights, turn signal blinkers, and rotating LiDAR sensor puck.
   */
  private updateVisualSignals(dt: number, isBraking: boolean, turnSignal: 'NONE' | 'LEFT' | 'RIGHT'): void {
    // Brake lights
    const brakeColor = isBraking ? 0xef4444 : 0x450a0a; // bright red when braking, dim tail light when off
    for (const mesh of this.brakeLightMeshes) {
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(brakeColor);
    }

    // Turn signal blinking at 1.5 Hz
    this.blinkTimer += dt;
    if (this.blinkTimer >= 0.33) {
      this.blinkTimer = 0;
      this.blinkState = !this.blinkState;
    }

    const amberOn = 0xf59e0b;
    const amberOff = 0x451a03;

    const leftColor = (turnSignal === 'LEFT' && this.blinkState) ? amberOn : amberOff;
    for (const mesh of this.leftTurnLightMeshes) {
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(leftColor);
    }

    const rightColor = (turnSignal === 'RIGHT' && this.blinkState) ? amberOn : amberOff;
    for (const mesh of this.rightTurnLightMeshes) {
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(rightColor);
    }

    // Rotate autonomous LiDAR puck
    if (this.lidarPuck) {
      this.lidarPuck.rotation.y += 15.0 * dt; // 10Hz rotation rate
    }

    // Steer front wheels visual angle
    for (const fw of this.frontWheelGroups) {
      fw.rotation.y = this.controller.steeringAngle;
      fw.children.forEach(c => (c.rotation.x = this.controller.wheelRotation));
    }
    // Spin rear wheels
    for (const rw of this.rearWheelGroups) {
      rw.children.forEach(c => (c.rotation.x = this.controller.wheelRotation));
    }
  }

  /**
   * Updates 3D mesh position and orientation in the Three.js scene.
   */
  private updateMeshTransforms(): void {
    this.group.position.set(this.controller.x, this.controller.y, this.controller.z);
    this.group.rotation.y = this.controller.yaw;
  }

  public getState(): DrivingState {
    return this.planner.getState();
  }

  public dispose(): void {
    this.group.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
  }
}
