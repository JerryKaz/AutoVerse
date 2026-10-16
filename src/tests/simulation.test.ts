/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { TimeManager } from '../core/TimeManager.ts';
import { RoadNetwork, Lane, Waypoint } from '../world/RoadNetwork.ts';
import { TrafficLight } from '../traffic/TrafficLight.ts';
import { TrafficManager } from '../traffic/TrafficManager.ts';
import { AStarPathfinder } from '../navigation/AStarPathfinder.ts';
import { SensorSystem } from '../vehicles/SensorSystem.ts';
import { BehaviorPlanner } from '../vehicles/BehaviorPlanner.ts';
import { VEHICLE_CONFIGS } from '../vehicles/VehicleTypes.ts';
import { AccraAssetManager } from '../world/AccraAssetManager.ts';
import { CityGenerator } from '../world/CityGenerator.ts';
import { ACCRA_LANDMARK_ITEMS, ACCRA_DISTRICT_LAYERS } from '../ui/LayerController.tsx';

describe('TimeManager Subsystem', () => {
  it('should initialize with 60Hz fixed delta time', () => {
    const tm = new TimeManager(60);
    expect(tm.getFixedDelta()).toBeCloseTo(1 / 60, 4);
    expect(tm.getIsPaused()).toBe(false);
  });

  it('should produce sub-steps matching elapsed time', () => {
    const tm = new TimeManager(60);
    // Initial call sets timestamp
    tm.update(1000);
    // Advance 50ms (~3 fixed steps of 16.67ms)
    const steps = tm.update(1050);
    expect(steps).toBe(3);
    expect(tm.getTickCount()).toBe(3);
  });

  it('should respect pause state and scale multipliers', () => {
    const tm = new TimeManager(60);
    tm.update(1000);
    tm.setPaused(true);
    expect(tm.update(1100)).toBe(0);

    tm.setPaused(false);
    tm.setTimeScale(2.0);
    expect(tm.getTimeScale()).toBe(2.0);
  });
});

describe('RoadNetwork & Spatial Indexing', () => {
  let network: RoadNetwork;

  beforeEach(() => {
    network = new RoadNetwork();
  });

  it('should add intersections and straight lanes correctly', () => {
    network.addIntersection('n1', new THREE.Vector3(0, 0, 0), 'SIGNALIZED');
    network.addIntersection('n2', new THREE.Vector3(0, 0, 100), 'SIGNALIZED');

    const waypoints: Waypoint[] = [
      { x: 0, y: 0, z: 0, tangentX: 0, tangentZ: 1, cumulativeDist: 0 },
      { x: 0, y: 0, z: 100, tangentX: 0, tangentZ: 1, cumulativeDist: 100 },
    ];

    const lane: Lane = {
      id: 'test_lane_1',
      roadSegmentId: 'seg_1',
      laneIndex: 0,
      roadType: 'ARTERIAL',
      speedLimit: 14,
      width: 3.5,
      waypoints,
      totalLength: 100,
      startNodeId: 'n1',
      endNodeId: 'n2',
      leftAdjacentLaneId: null,
      rightAdjacentLaneId: null,
      outgoingConnections: [],
      trafficLightId: null,
      stopLinePoint: { x: 0, y: 0, z: 100 },
    };

    network.addLane(lane);

    expect(network.getLane('test_lane_1')).toBeDefined();
    expect(network.getAllLanes().length).toBe(1);

    // Test position evaluation along lane
    const pos = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    network.evaluateLanePosition(lane, 50, pos, tangent);
    expect(pos.z).toBeCloseTo(50, 1);
    expect(tangent.z).toBeCloseTo(1, 2);
  });

  it('should accurately index and query spatial elements', () => {
    network.laneSpatialGrid.insert({ id: 'item_a', x: 10, z: 10 });
    network.laneSpatialGrid.insert({ id: 'item_b', x: 200, z: 200 });

    const nearby = network.laneSpatialGrid.queryRadius(12, 12, 15);
    expect(nearby.map(n => n.id)).toContain('item_a');
    expect(nearby.map(n => n.id)).not.toContain('item_b');
  });
});

describe('TrafficLight & TrafficManager', () => {
  it('should cycle through green, yellow, and clearance all-red states', () => {
    const light = new TrafficLight('tl_test', 'int_test', { x: 0, y: 0, z: 0 });
    expect(light.getStateForDirection('NS')).toBe('GREEN');
    expect(light.getStateForDirection('EW')).toBe('RED');

    // Fast-forward 13 seconds (phase 0 duration = 12s)
    light.update(13.0);
    expect(light.getStateForDirection('NS')).toBe('YELLOW');

    // Fast-forward yellow phase
    light.update(3.5);
    expect(light.getStateForDirection('NS')).toBe('RED');
    expect(light.getStateForDirection('EW')).toBe('RED'); // All-red clearance
  });

  it('should record completed trips and compute realistic traffic metrics', () => {
    const tm = new TrafficManager();
    tm.recordCompletedTrip(10, 500);
    tm.recordCompletedTrip(20, 800);

    const metrics = tm.calculateMetrics([
      { velocity: 12.0, state: 'CRUISING' },
      { velocity: 10.0, state: 'FOLLOWING_LEAD' },
      { velocity: 0.0, state: 'WAITING_AT_RED' },
    ]);

    expect(metrics.activeVehicles).toBe(3);
    expect(metrics.averageSpeedKmh).toBeGreaterThan(0);
    expect(metrics.waitingVehicles).toBe(1);
    expect(metrics.collisionCount).toBe(0);
  });
});

describe('SensorSystem Perception Suite', () => {
  const sensors = new SensorSystem();

  it('should detect lead vehicle within sensor cone and calculate TTC', () => {
    const selfPos = { x: 0, z: 0 };
    const selfYaw = 0; // heading +Z
    const selfSpeed = 15; // 15 m/s

    const nearbyVehicles = [
      { id: 'lead_1', x: 0, z: 30, yaw: 0, velocity: 10, currentLaneId: 'lane_1' }, // 30m ahead, 5 m/s slower
      { id: 'other_lane', x: 15, z: 10, yaw: 0, velocity: 12, currentLaneId: 'lane_2' },
    ];

    const lead = sensors.detectLeadVehicle('self', selfPos, selfYaw, selfSpeed, 'lane_1', nearbyVehicles);
    expect(lead).not.toBeNull();
    expect(lead!.vehicleId).toBe('lead_1');
    expect(lead!.distance).toBeCloseTo(30, 1);
    expect(lead!.relativeSpeed).toBeCloseTo(5, 1);
    expect(lead!.timeToCollision).toBeCloseTo(6.0, 1); // 30m / 5m/s = 6.0s
  });

  it('should correctly evaluate adjacent lane gap safety', () => {
    const selfPos = { x: 0, z: 50 };
    const selfYaw = 0;

    const nearbyVehicles = [
      { id: 'far_front', x: 3.5, z: 90, velocity: 14, currentLaneId: 'lane_left' }, // 40m ahead
      { id: 'far_rear', x: 3.5, z: 10, velocity: 14, currentLaneId: 'lane_left' }, // 40m behind
    ];

    const gap = sensors.evaluateAdjacentLaneGap('self', selfPos, selfYaw, 'lane_left', nearbyVehicles);
    expect(gap.isSafe).toBe(true);
    expect(gap.frontGap).toBeGreaterThanOrEqual(10);
    expect(gap.rearGap).toBeGreaterThanOrEqual(12);
  });
});

describe('BehaviorPlanner & IDM Kinematic Model', () => {
  const config = VEHICLE_CONFIGS.SEDAN;
  const planner = new BehaviorPlanner(config);

  const dummyLane: Lane = {
    id: 'l1',
    roadSegmentId: 's1',
    laneIndex: 0,
    roadType: 'ARTERIAL',
    speedLimit: 14,
    width: 3.5,
    waypoints: [],
    totalLength: 200,
    startNodeId: 'n1',
    endNodeId: 'n2',
    leftAdjacentLaneId: null,
    rightAdjacentLaneId: null,
    outgoingConnections: [],
    trafficLightId: null,
    stopLinePoint: null,
  };

  it('should accelerate towards road speed limit on open road', () => {
    const sensorData = {
      leadVehicle: null,
      leftLaneGap: { isSafe: false, frontGap: 0, rearGap: 0, frontVehicleId: null, rearVehicleId: null },
      rightLaneGap: { isSafe: false, frontGap: 0, rearGap: 0, frontVehicleId: null, rearVehicleId: null },
      trafficSignal: null,
      yieldRequired: false,
      lidarPoints: [],
    };

    const plan = planner.plan(0.016, 5.0, dummyLane, sensorData);
    expect(plan.state).toBe('CRUISING');
    expect(plan.targetAcceleration).toBeGreaterThan(0);
    expect(plan.isBraking).toBe(false);
  });

  it('should trigger emergency braking when lead vehicle gap is critically small', () => {
    const criticalSensorData = {
      leadVehicle: { vehicleId: 'car_2', distance: 2.2, relativeSpeed: 6.0, timeToCollision: 0.36 },
      leftLaneGap: { isSafe: false, frontGap: 0, rearGap: 0, frontVehicleId: null, rearVehicleId: null },
      rightLaneGap: { isSafe: false, frontGap: 0, rearGap: 0, frontVehicleId: null, rearVehicleId: null },
      trafficSignal: null,
      yieldRequired: false,
      lidarPoints: [],
    };

    const plan = planner.plan(0.016, 12.0, dummyLane, criticalSensorData);
    expect(plan.state).toBe('EMERGENCY_BRAKE');
    expect(plan.targetAcceleration).toBeLessThan(-config.comfortDeceleration);
    expect(plan.isBraking).toBe(true);
  });
});

describe('AStarPathfinder', () => {
  it('should stitch waypoints and build continuous route', () => {
    const network = new RoadNetwork();
    network.addIntersection('i1', new THREE.Vector3(0, 0, 0), 'SIGNALIZED');
    network.addIntersection('i2', new THREE.Vector3(0, 0, 50), 'SIGNALIZED');
    network.addIntersection('i3', new THREE.Vector3(50, 0, 50), 'SIGNALIZED');

    const wp1: Waypoint[] = [
      { x: 0, y: 0, z: 0, tangentX: 0, tangentZ: 1, cumulativeDist: 0 },
      { x: 0, y: 0, z: 50, tangentX: 0, tangentZ: 1, cumulativeDist: 50 },
    ];
    const wp2: Waypoint[] = [
      { x: 0, y: 0, z: 50, tangentX: 1, tangentZ: 0, cumulativeDist: 0 },
      { x: 50, y: 0, z: 50, tangentX: 1, tangentZ: 0, cumulativeDist: 50 },
    ];

    const l1: Lane = {
      id: 'lane_1',
      roadSegmentId: 's1',
      laneIndex: 0,
      roadType: 'ARTERIAL',
      speedLimit: 14,
      width: 3.5,
      waypoints: wp1,
      totalLength: 50,
      startNodeId: 'i1',
      endNodeId: 'i2',
      leftAdjacentLaneId: null,
      rightAdjacentLaneId: null,
      outgoingConnections: [{ targetLaneId: 'lane_2', type: 'RIGHT_TURN', pathWaypoints: [], length: 5 }],
      trafficLightId: null,
      stopLinePoint: null,
    };

    const l2: Lane = {
      id: 'lane_2',
      roadSegmentId: 's2',
      laneIndex: 0,
      roadType: 'ARTERIAL',
      speedLimit: 14,
      width: 3.5,
      waypoints: wp2,
      totalLength: 50,
      startNodeId: 'i2',
      endNodeId: 'i3',
      leftAdjacentLaneId: null,
      rightAdjacentLaneId: null,
      outgoingConnections: [],
      trafficLightId: null,
      stopLinePoint: null,
    };

    network.addLane(l1);
    network.addLane(l2);

    const pathfinder = new AStarPathfinder(network);
    const route = pathfinder.findRoute('lane_1', 'lane_2');

    expect(route).not.toBeNull();
    expect(route!.laneIds).toContain('lane_1');
    expect(route!.laneIds).toContain('lane_2');
    expect(route!.waypoints.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Accra Fleet Vehicle Profiles', () => {
  it('should define Autonomous Trotro and Ghanaian Taxi configurations', () => {
    expect(VEHICLE_CONFIGS.TROTRO).toBeDefined();
    expect(VEHICLE_CONFIGS.TROTRO.displayName).toContain('Trotro');
    expect(VEHICLE_CONFIGS.TROTRO.isTrotro).toBe(true);

    expect(VEHICLE_CONFIGS.GH_TAXI).toBeDefined();
    expect(VEHICLE_CONFIGS.GH_TAXI.displayName).toContain('Accra');
    expect(VEHICLE_CONFIGS.GH_TAXI.isGhTaxi).toBe(true);
  });
});

describe('AccraAssetManager & 3D Heritage Landmarks', () => {
  let assetManager: AccraAssetManager;

  beforeEach(() => {
    assetManager = AccraAssetManager.getInstance();
  });

  it('should initialize as a singleton with complete landmark registry', () => {
    expect(assetManager).toBeDefined();
    expect(AccraAssetManager.getInstance()).toBe(assetManager);

    const allMeta = assetManager.getAllMetadata();
    expect(allMeta.length).toBeGreaterThanOrEqual(4);

    const ids = allMeta.map(m => m.id);
    expect(ids).toContain('black_star_gate');
    expect(ids).toContain('jamestown_lighthouse');
    expect(ids).toContain('colonial_trading_house_1');
    expect(ids).toContain('colonial_trading_house_2');
    expect(ids).toContain('colonial_customs_house');
  });

  it('should register realistic coordinate origins within the simulation grid', () => {
    const gateMeta = assetManager.getMetadata('black_star_gate')!;
    expect(gateMeta.coordinates).toEqual({ x: 0, y: 0, z: 0 }); // Center of Black Star Square

    const lighthouseMeta = assetManager.getMetadata('jamestown_lighthouse')!;
    expect(lighthouseMeta.coordinates.x).toBe(-60); // Coastal promontory
    expect(lighthouseMeta.coordinates.z).toBe(80);

    const colonial1 = assetManager.getMetadata('colonial_trading_house_1')!;
    expect(colonial1.coordinates.x).toBe(-60); // Ga-Mashie / High Street heritage corridor
    expect(colonial1.coordinates.z).toBe(35);

    const colonial2 = assetManager.getMetadata('colonial_trading_house_2')!;
    expect(colonial2.coordinates.x).toBe(-60);
    expect(colonial2.coordinates.z).toBe(-25);

    const customs = assetManager.getMetadata('colonial_customs_house')!;
    expect(customs.coordinates.x).toBe(-60);
    expect(customs.coordinates.z).toBe(5);
  });

  it('should build high-fidelity Black Star Gate model with shadows and star geometry', () => {
    const model = assetManager.loadLandmark('black_star_gate', { castShadow: true, receiveShadow: true });
    expect(model).toBeInstanceOf(THREE.Group);
    expect(model.position.x).toBe(0);
    expect(model.position.z).toBe(0);

    let meshCount = 0;
    model.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        meshCount++;
        expect(child.castShadow).toBe(true);
        expect(child.receiveShadow).toBe(true);
      }
    });

    expect(meshCount).toBeGreaterThan(5);
  });

  it('should build high-fidelity Jamestown Lighthouse with cylindrical tower and beacon', () => {
    const lighthouse = assetManager.loadLandmark('jamestown_lighthouse');
    expect(lighthouse).toBeInstanceOf(THREE.Group);
    expect(lighthouse.position.x).toBe(-60);
    expect(lighthouse.position.z).toBe(80);

    let hasPointLight = false;
    let cylinderCount = 0;
    lighthouse.traverse(child => {
      if ((child as THREE.PointLight).isPointLight) {
        hasPointLight = true;
      }
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry instanceof THREE.CylinderGeometry) {
        cylinderCount++;
      }
    });

    expect(hasPointLight).toBe(true);
    expect(cylinderCount).toBeGreaterThanOrEqual(6); // 6 alternating bands
  });

  it('should build characteristic Ghanaian colonial-era architecture with verandas & arcades', () => {
    const tradingHouse = assetManager.loadLandmark('colonial_trading_house_1');
    expect(tradingHouse).toBeInstanceOf(THREE.Group);
    expect(tradingHouse.position.x).toBe(-60);
    expect(tradingHouse.position.z).toBe(35);

    const customsHouse = assetManager.loadLandmark('colonial_customs_house');
    expect(customsHouse).toBeInstanceOf(THREE.Group);
    expect(customsHouse.position.x).toBe(-60);
    expect(customsHouse.position.z).toBe(5);

    let colonnadeFound = false;
    customsHouse.traverse(child => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry instanceof THREE.CylinderGeometry) {
        colonnadeFound = true;
      }
    });
    expect(colonnadeFound).toBe(true);
  });
});

describe('Simulation Controls Subsystem Logic', () => {
  it('should support stepOnce and deterministic discrete advancement', () => {
    const tm = new TimeManager(60);
    expect(tm.getSimulatedTime()).toBe(0);
    expect(tm.getTickCount()).toBe(0);

    tm.stepOnce();
    expect(tm.getTickCount()).toBe(1);
    expect(tm.getSimulatedTime()).toBeCloseTo(1 / 60, 4);

    tm.stepOnce();
    expect(tm.getTickCount()).toBe(2);
    expect(tm.getSimulatedTime()).toBeCloseTo(2 / 60, 4);
  });

  it('should constrain speed multiplier bounds within safe operational envelopes', () => {
    const tm = new TimeManager(60);
    tm.setTimeScale(0.1);
    expect(tm.getTimeScale()).toBe(0.1);

    tm.setTimeScale(8.0);
    expect(tm.getTimeScale()).toBe(8.0);

    // Over-limit clamp
    tm.setTimeScale(12.0);
    expect(tm.getTimeScale()).toBe(8.0);

    // Under-limit clamp
    tm.setTimeScale(0.01);
    expect(tm.getTimeScale()).toBe(0.1);
  });

  it('should cleanly reset simulation clock and counters', () => {
    const tm = new TimeManager(60);
    tm.stepOnce();
    tm.stepOnce();
    expect(tm.getTickCount()).toBe(2);

    tm.reset();
    expect(tm.getTickCount()).toBe(0);
    expect(tm.getSimulatedTime()).toBe(0);
  });
});

describe('City Landmark & Layer Visibility Controller', () => {
  it('should generate city with identifiable landmark groups matching ACCRA_LANDMARK_ITEMS', () => {
    const roadNetwork = new RoadNetwork();
    const trafficManager = new TrafficManager();
    const generator = new CityGenerator(roadNetwork, trafficManager);
    const cityData = generator.generate();

    const monumentsGroup = cityData.worldGroup.getObjectByName('AccraBuildingsAndMonuments');
    expect(monumentsGroup).toBeDefined();

    for (const item of ACCRA_LANDMARK_ITEMS) {
      const landmarkObj = cityData.worldGroup.getObjectByName(`landmark_${item.id}`);
      expect(landmarkObj).toBeDefined();
      expect(landmarkObj).toBeInstanceOf(THREE.Group);
      expect(landmarkObj?.visible).toBe(true);
    }
  });

  it('should toggle visibility for Black Star Gate and Jamestown Lighthouse in the 3D scene', () => {
    const roadNetwork = new RoadNetwork();
    const trafficManager = new TrafficManager();
    const generator = new CityGenerator(roadNetwork, trafficManager);
    const cityData = generator.generate();

    const blackStarGate = cityData.worldGroup.getObjectByName('landmark_black_star_gate');
    const jamestownLighthouse = cityData.worldGroup.getObjectByName('landmark_jamestown_lighthouse');

    expect(blackStarGate).toBeDefined();
    expect(jamestownLighthouse).toBeDefined();

    // Toggle Black Star Gate visibility off
    if (blackStarGate) blackStarGate.visible = false;
    expect(blackStarGate?.visible).toBe(false);

    // Toggle Black Star Gate visibility back on
    if (blackStarGate) blackStarGate.visible = true;
    expect(blackStarGate?.visible).toBe(true);

    // Toggle Jamestown Lighthouse visibility off
    if (jamestownLighthouse) jamestownLighthouse.visible = false;
    expect(jamestownLighthouse?.visible).toBe(false);
  });

  it('should generate named urban layer groups matching ACCRA_DISTRICT_LAYERS', () => {
    const roadNetwork = new RoadNetwork();
    const trafficManager = new TrafficManager();
    const generator = new CityGenerator(roadNetwork, trafficManager);
    const cityData = generator.generate();

    for (const layer of ACCRA_DISTRICT_LAYERS) {
      const layerObj = cityData.worldGroup.getObjectByName(`layer_${layer.key}`);
      expect(layerObj).toBeDefined();
      expect(layerObj?.visible).toBe(true);

      // Verify toggle
      if (layerObj) layerObj.visible = false;
      expect(layerObj?.visible).toBe(false);
    }
  });
});



