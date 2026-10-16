/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { RoadNetwork, Lane, Waypoint, LaneConnection, RoadType } from './RoadNetwork.ts';
import { TrafficLight } from '../traffic/TrafficLight.ts';
import { TrafficManager } from '../traffic/TrafficManager.ts';
import { AccraAssetManager } from './AccraAssetManager.ts';

export interface GeneratedCity {
  worldGroup: THREE.Group;
  trafficLightMeshes: Map<string, { redMesh: THREE.Mesh; yellowMesh: THREE.Mesh; greenMesh: THREE.Mesh; direction: 'NS' | 'EW' }[]>;
}

export class CityGenerator {
  private roadNetwork: RoadNetwork;
  private trafficManager: TrafficManager;
  public assetManager: AccraAssetManager;

  constructor(roadNetwork: RoadNetwork, trafficManager: TrafficManager) {
    this.roadNetwork = roadNetwork;
    this.trafficManager = trafficManager;
    this.assetManager = AccraAssetManager.getInstance();
  }

  /**
   * Generates a complete city modeled after Accra, Ghana:
   * - Black Star Square & Independence Arch
   * - Jamestown Red-and-White Lighthouse
   * - Gulf of Guinea / Atlantic coastal shoreline
   * - Alternating yellow-and-black Ghanaian curbstones
   * - Tropical Royal Palm trees along boulevards
   * - Accra corridor signage (Liberation Rd, Independence Ave, Oxford St)
   */
  public generate(): GeneratedCity {
    const worldGroup = new THREE.Group();
    worldGroup.name = 'AccraCityWorld';

    const trafficLightMeshes: Map<string, { redMesh: THREE.Mesh; yellowMesh: THREE.Mesh; greenMesh: THREE.Mesh; direction: 'NS' | 'EW' }[]> = new Map();

    // 1. Terrain, Coastline & Atlantic Ocean (Gulf of Guinea)
    this.createAccraTerrainAndCoast(worldGroup);

    // 2. Road Network Graph & Road Surface Meshes with Ghanaian yellow/black curbstones
    this.buildRoadNetworkAndMeshes(worldGroup, trafficLightMeshes);

    // 3. Generate Accra Urban Fabric: Independence Arch, Jamestown Lighthouse, Airport City towers & Osu kiosks
    this.generateAccraLandmarksAndDistricts(worldGroup);

    // 4. Generate Tropical Royal Palms and Streetlight Fixtures
    this.generateRoyalPalmsAndGreenery(worldGroup);

    // 5. Overhead Road Sign Gantries (Liberation Rd, Independence Ave, Oxford St)
    this.createOverheadAccraSignGantries(worldGroup);

    return {
      worldGroup,
      trafficLightMeshes,
    };
  }

  /**
   * Creates coastal Accra terrain: warm laterite soil, sandy beach, and the Atlantic Ocean.
   */
  private createAccraTerrainAndCoast(parent: THREE.Group): void {
    // 1. Main City Laterite & Tropical Turf Plane
    const groundGeo = new THREE.PlaneGeometry(800, 800, 32, 32);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x223326, // lush equatorial coastal turf with warm undertones
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    parent.add(ground);

    // 2. Gulf of Guinea / Atlantic Ocean along the southern border (z > 145)
    const oceanGeo = new THREE.PlaneGeometry(800, 220);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x075985, // Atlantic Gulf of Guinea deep ocean blue
      roughness: 0.15,
      metalness: 0.45,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.position.set(0, -0.1, 255);
    ocean.receiveShadow = true;
    parent.add(ocean);

    // 3. Sandy Beach Shoreline strip (z: 140 to 155)
    const beachGeo = new THREE.PlaneGeometry(800, 25);
    beachGeo.rotateX(-Math.PI / 2);
    const beachMat = new THREE.MeshStandardMaterial({
      color: 0xd4a373, // golden Atlantic sand
      roughness: 0.9,
    });
    const beach = new THREE.Mesh(beachGeo, beachMat);
    beach.position.set(0, -0.02, 148);
    beach.receiveShadow = true;
    parent.add(beach);
  }

  private buildRoadNetworkAndMeshes(
    parent: THREE.Group,
    trafficLightMeshes: Map<string, { redMesh: THREE.Mesh; yellowMesh: THREE.Mesh; greenMesh: THREE.Mesh; direction: 'NS' | 'EW' }[]>
  ): void {
    const roadGroup = new THREE.Group();
    roadGroup.name = 'AccraRoads';

    // Grid coordinates: 4 Avenues along X (-90, -30, 30, 90) and 4 Streets along Z (-90, -30, 30, 90)
    // Corridors correspond to:
    // X = -30: Independence Avenue
    // X = 30: Liberation Road (Airport Corridor)
    // Z = -30: Ring Road Central
    // Z = 30: Oxford Street (Osu)
    const xs = [-90, -30, 30, 90];
    const zs = [-90, -30, 30, 90];
    const roadWidth = 14.0; // 2 lanes each direction (3.5m per lane)
    const laneWidth = 3.5;

    const trafficLightsLayer = new THREE.Group();
    trafficLightsLayer.name = 'layer_traffic_lights';
    roadGroup.add(trafficLightsLayer);

    // A. Intersections
    for (let r = 0; r < xs.length; r++) {
      for (let c = 0; c < zs.length; c++) {
        const x = xs[r];
        const z = zs[c];
        const intersectionId = `int_${r}_${c}`;
        const isSignalized = true;

        const lightId = isSignalized ? `tl_${r}_${c}` : null;
        this.roadNetwork.addIntersection(intersectionId, new THREE.Vector3(x, 0, z), 'SIGNALIZED', lightId);

        if (lightId) {
          const tLight = new TrafficLight(lightId, intersectionId, { x, y: 0, z });
          tLight.timeInCurrentPhase = ((r + c) * 3.5) % 12;
          this.trafficManager.registerTrafficLight(tLight);

          const meshes = this.createTrafficLightPoles(trafficLightsLayer, x, z, roadWidth * 0.55);
          trafficLightMeshes.set(lightId, meshes);
        }

        // Intersection asphalt junction
        const juncGeo = new THREE.PlaneGeometry(roadWidth, roadWidth);
        juncGeo.rotateX(-Math.PI / 2);
        const juncMat = new THREE.MeshStandardMaterial({ color: 0x1f242d, roughness: 0.85 });
        const juncMesh = new THREE.Mesh(juncGeo, juncMat);
        juncMesh.position.set(x, 0.01, z);
        juncMesh.receiveShadow = true;
        roadGroup.add(juncMesh);

        // Crosswalk stripes
        this.createCrosswalk(roadGroup, x, z, roadWidth);
      }
    }

    // B. North-South Road Segments (along Z)
    for (let r = 0; r < xs.length; r++) {
      for (let c = 0; c < zs.length - 1; c++) {
        const x = xs[r];
        const z1 = zs[c];
        const z2 = zs[c + 1];
        const len = z2 - z1 - roadWidth;
        const midZ = (z1 + z2) / 2;

        const roadGeo = new THREE.PlaneGeometry(roadWidth, len);
        roadGeo.rotateX(-Math.PI / 2);
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x1f242d, roughness: 0.85 });
        const roadMesh = new THREE.Mesh(roadGeo, roadMat);
        roadMesh.position.set(x, 0.01, midZ);
        roadMesh.receiveShadow = true;
        roadGroup.add(roadMesh);

        this.createRoadMarkings(roadGroup, x, midZ, len, true, roadWidth);
        this.createAccraCurbSidewalks(roadGroup, x, midZ, len, true, roadWidth);

        const intStart = `int_${r}_${c}`;
        const intEnd = `int_${r}_${c + 1}`;

        this.createStraightLane(`lane_NS_${r}_${c}_0`, x + laneWidth * 0.5, z1 + roadWidth * 0.5, z2 - roadWidth * 0.5, intStart, intEnd, 0, `lane_NS_${r}_${c}_1`, null, `tl_${r}_${c + 1}`);
        this.createStraightLane(`lane_NS_${r}_${c}_1`, x + laneWidth * 1.5, z1 + roadWidth * 0.5, z2 - roadWidth * 0.5, intStart, intEnd, 1, null, `lane_NS_${r}_${c}_0`, `tl_${r}_${c + 1}`);

        this.createStraightLane(`lane_SN_${r}_${c + 1}_0`, x - laneWidth * 0.5, z2 - roadWidth * 0.5, z1 + roadWidth * 0.5, intEnd, intStart, 0, `lane_SN_${r}_${c + 1}_1`, null, `tl_${r}_${c}`);
        this.createStraightLane(`lane_SN_${r}_${c + 1}_1`, x - laneWidth * 1.5, z2 - roadWidth * 0.5, z1 + roadWidth * 0.5, intEnd, intStart, 1, null, `lane_SN_${r}_${c + 1}_0`, `tl_${r}_${c}`);
      }
    }

    // C. East-West Road Segments (along X)
    for (let c = 0; c < zs.length; c++) {
      for (let r = 0; r < xs.length - 1; r++) {
        const z = zs[c];
        const x1 = xs[r];
        const x2 = xs[r + 1];
        const len = x2 - x1 - roadWidth;
        const midX = (x1 + x2) / 2;

        const roadGeo = new THREE.PlaneGeometry(len, roadWidth);
        roadGeo.rotateX(-Math.PI / 2);
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x1f242d, roughness: 0.85 });
        const roadMesh = new THREE.Mesh(roadGeo, roadMat);
        roadMesh.position.set(midX, 0.01, z);
        roadMesh.receiveShadow = true;
        roadGroup.add(roadMesh);

        this.createRoadMarkings(roadGroup, midX, z, len, false, roadWidth);
        this.createAccraCurbSidewalks(roadGroup, midX, z, len, false, roadWidth);

        const intStart = `int_${r}_${c}`;
        const intEnd = `int_${r + 1}_${c}`;

        this.createStraightLaneAlongX(`lane_WE_${r}_${c}_0`, x1 + roadWidth * 0.5, x2 - roadWidth * 0.5, z - laneWidth * 0.5, intStart, intEnd, 0, `lane_WE_${r}_${c}_1`, null, `tl_${r + 1}_${c}`);
        this.createStraightLaneAlongX(`lane_WE_${r}_${c}_1`, x1 + roadWidth * 0.5, x2 - roadWidth * 0.5, z - laneWidth * 1.5, intStart, intEnd, 1, null, `lane_WE_${r}_${c}_0`, `tl_${r + 1}_${c}`);

        this.createStraightLaneAlongX(`lane_EW_${r + 1}_${c}_0`, x2 - roadWidth * 0.5, x1 + roadWidth * 0.5, z + laneWidth * 0.5, intEnd, intStart, 0, `lane_EW_${r + 1}_${c}_1`, null, `tl_${r}_${c}`);
        this.createStraightLaneAlongX(`lane_EW_${r + 1}_${c}_1`, x2 - roadWidth * 0.5, x1 + roadWidth * 0.5, z + laneWidth * 1.5, intEnd, intStart, 1, null, `lane_EW_${r + 1}_${c}_0`, `tl_${r}_${c}`);
      }
    }

    // D. Outer Coastal Ring Road / Expressway Loop
    this.createExpresswayLoop(roadGroup);

    // E. Wire Intersections with turn connectors
    this.wireIntersectionConnections();

    parent.add(roadGroup);
  }

  private createStraightLane(
    id: string,
    x: number,
    zStart: number,
    zEnd: number,
    startNodeId: string,
    endNodeId: string,
    laneIndex: number,
    leftAdj: string | null,
    rightAdj: string | null,
    trafficLightId: string | null
  ): void {
    const waypoints: Waypoint[] = [];
    const len = Math.abs(zEnd - zStart);
    const dirZ = Math.sign(zEnd - zStart);
    const step = 4.0;
    const numPoints = Math.max(3, Math.ceil(len / step));

    for (let i = 0; i < numPoints; i++) {
      const frac = i / (numPoints - 1);
      const z = zStart + (zEnd - zStart) * frac;
      waypoints.push({
        x,
        y: 0.1,
        z,
        tangentX: 0,
        tangentZ: dirZ,
        cumulativeDist: frac * len,
      });
    }

    const lane: Lane = {
      id,
      roadSegmentId: `seg_${startNodeId}_${endNodeId}`,
      laneIndex,
      roadType: 'ARTERIAL',
      speedLimit: 14.0, // ~50 km/h
      width: 3.5,
      waypoints,
      totalLength: len,
      startNodeId,
      endNodeId,
      leftAdjacentLaneId: leftAdj,
      rightAdjacentLaneId: rightAdj,
      outgoingConnections: [],
      trafficLightId,
      stopLinePoint: { x, y: 0.1, z: zEnd },
    };

    this.roadNetwork.addLane(lane);
  }

  private createStraightLaneAlongX(
    id: string,
    xStart: number,
    xEnd: number,
    z: number,
    startNodeId: string,
    endNodeId: string,
    laneIndex: number,
    leftAdj: string | null,
    rightAdj: string | null,
    trafficLightId: string | null
  ): void {
    const waypoints: Waypoint[] = [];
    const len = Math.abs(xEnd - xStart);
    const dirX = Math.sign(xEnd - xStart);
    const step = 4.0;
    const numPoints = Math.max(3, Math.ceil(len / step));

    for (let i = 0; i < numPoints; i++) {
      const frac = i / (numPoints - 1);
      const x = xStart + (xEnd - xStart) * frac;
      waypoints.push({
        x,
        y: 0.1,
        z,
        tangentX: dirX,
        tangentZ: 0,
        cumulativeDist: frac * len,
      });
    }

    const lane: Lane = {
      id,
      roadSegmentId: `seg_${startNodeId}_${endNodeId}`,
      laneIndex,
      roadType: 'ARTERIAL',
      speedLimit: 14.0,
      width: 3.5,
      waypoints,
      totalLength: len,
      startNodeId,
      endNodeId,
      leftAdjacentLaneId: leftAdj,
      rightAdjacentLaneId: rightAdj,
      outgoingConnections: [],
      trafficLightId,
      stopLinePoint: { x: xEnd, y: 0.1, z },
    };

    this.roadNetwork.addLane(lane);
  }

  private createExpresswayLoop(parent: THREE.Group): void {
    const radius = 145;
    const segments = 32;
    const highwayWidth = 10.0;

    const ringGeo = new THREE.RingGeometry(radius - highwayWidth * 0.5, radius + highwayWidth * 0.5, segments);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.8 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.015;
    ringMesh.receiveShadow = true;
    parent.add(ringMesh);

    const railMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.8, roughness: 0.3 });
    const outerRailGeo = new THREE.TorusGeometry(radius + highwayWidth * 0.5, 0.15, 6, segments);
    outerRailGeo.rotateX(Math.PI / 2);
    const outerRail = new THREE.Mesh(outerRailGeo, railMat);
    outerRail.position.y = 0.5;
    parent.add(outerRail);

    const cwWaypoints: Waypoint[] = [];
    const ccwWaypoints: Waypoint[] = [];
    let cwDist = 0;
    let ccwDist = 0;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const xOuter = Math.cos(angle) * (radius + 2.5);
      const zOuter = Math.sin(angle) * (radius + 2.5);

      const xInner = Math.cos(-angle) * (radius - 2.5);
      const zInner = Math.sin(-angle) * (radius - 2.5);

      if (i > 0) {
        const prevOuter = cwWaypoints[i - 1];
        cwDist += Math.hypot(xOuter - prevOuter.x, zOuter - prevOuter.z);

        const prevInner = ccwWaypoints[i - 1];
        ccwDist += Math.hypot(xInner - prevInner.x, zInner - prevInner.z);
      }

      cwWaypoints.push({
        x: xOuter,
        y: 0.1,
        z: zOuter,
        tangentX: -Math.sin(angle),
        tangentZ: Math.cos(angle),
        cumulativeDist: cwDist,
      });

      ccwWaypoints.push({
        x: xInner,
        y: 0.1,
        z: zInner,
        tangentX: Math.sin(-angle),
        tangentZ: -Math.cos(-angle),
        cumulativeDist: ccwDist,
      });
    }

    const highwayCW: Lane = {
      id: 'highway_cw',
      roadSegmentId: 'seg_highway_cw',
      laneIndex: 0,
      roadType: 'HIGHWAY',
      speedLimit: 25.0,
      width: 4.5,
      waypoints: cwWaypoints,
      totalLength: cwDist,
      startNodeId: 'hw_node_start',
      endNodeId: 'hw_node_start',
      leftAdjacentLaneId: null,
      rightAdjacentLaneId: null,
      outgoingConnections: [],
      trafficLightId: null,
      stopLinePoint: null,
    };

    const highwayCCW: Lane = {
      id: 'highway_ccw',
      roadSegmentId: 'seg_highway_ccw',
      laneIndex: 0,
      roadType: 'HIGHWAY',
      speedLimit: 25.0,
      width: 4.5,
      waypoints: ccwWaypoints,
      totalLength: ccwDist,
      startNodeId: 'hw_node_inner',
      endNodeId: 'hw_node_inner',
      leftAdjacentLaneId: null,
      rightAdjacentLaneId: null,
      outgoingConnections: [],
      trafficLightId: null,
      stopLinePoint: null,
    };

    highwayCW.outgoingConnections.push({ targetLaneId: 'highway_cw', type: 'STRAIGHT', pathWaypoints: [], length: cwDist });
    highwayCCW.outgoingConnections.push({ targetLaneId: 'highway_ccw', type: 'STRAIGHT', pathWaypoints: [], length: ccwDist });

    this.roadNetwork.addLane(highwayCW);
    this.roadNetwork.addLane(highwayCCW);
  }

  private wireIntersectionConnections(): void {
    const allLanes = this.roadNetwork.getAllLanes();

    for (const lane of allLanes) {
      if (lane.roadType === 'HIGHWAY') continue;

      const endNode = this.roadNetwork.getIntersection(lane.endNodeId);
      if (!endNode) continue;

      for (const outLaneId of endNode.outgoingLanes) {
        const outLane = this.roadNetwork.getLane(outLaneId);
        if (!outLane) continue;

        if (outLane.endNodeId === lane.startNodeId) continue;

        const endWp = lane.waypoints[lane.waypoints.length - 1];
        const outStartWp = outLane.waypoints[0];

        const dot = endWp.tangentX * outStartWp.tangentX + endWp.tangentZ * outStartWp.tangentZ;
        const cross = endWp.tangentX * outStartWp.tangentZ - endWp.tangentZ * outStartWp.tangentX;

        let type: LaneConnection['type'] = 'STRAIGHT';
        if (dot < 0.3) {
          type = cross > 0 ? 'LEFT_TURN' : 'RIGHT_TURN';
        }

        lane.outgoingConnections.push({
          targetLaneId: outLane.id,
          type,
          pathWaypoints: [],
          length: Math.hypot(outStartWp.x - endWp.x, outStartWp.z - endWp.z),
        });
      }

      if (lane.outgoingConnections.length === 0) {
        const highway = this.roadNetwork.getLane('highway_cw');
        if (highway) {
          lane.outgoingConnections.push({
            targetLaneId: highway.id,
            type: 'MERGE',
            pathWaypoints: [],
            length: 15.0,
          });
        }
      }
    }
  }

  private createRoadMarkings(parent: THREE.Group, x: number, z: number, len: number, isVertical: boolean, roadWidth: number): void {
    const markMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const centerGeo = isVertical
      ? new THREE.PlaneGeometry(0.3, len)
      : new THREE.PlaneGeometry(len, 0.3);
    centerGeo.rotateX(-Math.PI / 2);

    const centerMesh = new THREE.Mesh(centerGeo, markMat);
    centerMesh.position.set(x, 0.02, z);
    parent.add(centerMesh);

    const dashCount = Math.floor(len / 4.0);
    for (let i = 0; i < dashCount; i++) {
      if (i % 2 === 0) continue;
      const offset = -len * 0.5 + (i / dashCount) * len;

      const dashGeo = isVertical
        ? new THREE.PlaneGeometry(0.2, 1.8)
        : new THREE.PlaneGeometry(1.8, 0.2);
      dashGeo.rotateX(-Math.PI / 2);

      const d1 = new THREE.Mesh(dashGeo, whiteMat);
      const d2 = new THREE.Mesh(dashGeo, whiteMat);

      if (isVertical) {
        d1.position.set(x + roadWidth * 0.25, 0.02, z + offset);
        d2.position.set(x - roadWidth * 0.25, 0.02, z + offset);
      } else {
        d1.position.set(x + offset, 0.02, z + roadWidth * 0.25);
        d2.position.set(x + offset, 0.02, z - roadWidth * 0.25);
      }

      parent.add(d1, d2);
    }
  }

  /**
   * Builds Ghanaian sidewalks with iconic alternating YELLOW and BLACK curbstones.
   */
  private createAccraCurbSidewalks(parent: THREE.Group, x: number, z: number, len: number, isVertical: boolean, roadWidth: number): void {
    const swWidth = 3.5;
    const swHeight = 0.2;
    // Sandstone paved pedestrian walkway
    const swMat = new THREE.MeshStandardMaterial({ color: 0xc8bba8, roughness: 0.9 });

    const swGeo = isVertical
      ? new THREE.BoxGeometry(swWidth, swHeight, len)
      : new THREE.BoxGeometry(len, swHeight, swWidth);

    const sw1 = new THREE.Mesh(swGeo, swMat);
    const sw2 = new THREE.Mesh(swGeo, swMat);

    if (isVertical) {
      sw1.position.set(x + (roadWidth * 0.5 + swWidth * 0.5), swHeight * 0.5, z);
      sw2.position.set(x - (roadWidth * 0.5 + swWidth * 0.5), swHeight * 0.5, z);
    } else {
      sw1.position.set(x, swHeight * 0.5, z + (roadWidth * 0.5 + swWidth * 0.5));
      sw2.position.set(x, swHeight * 0.5, z - (roadWidth * 0.5 + swWidth * 0.5));
    }

    sw1.receiveShadow = true;
    sw2.receiveShadow = true;
    parent.add(sw1, sw2);

    // Iconic Ghanaian Yellow and Black alternating curbstones!
    const curbHeight = 0.24;
    const curbWidth = 0.25;
    const curbSegLen = 2.0; // 2 meters per stripe
    const numCurbSegs = Math.floor(len / curbSegLen);

    const yellowCurbMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 });
    const blackCurbMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });

    for (let i = 0; i < numCurbSegs; i++) {
      const isYellow = i % 2 === 0;
      const mat = isYellow ? yellowCurbMat : blackCurbMat;
      const segOffset = -len * 0.5 + (i + 0.5) * curbSegLen;

      const curbGeo = isVertical
        ? new THREE.BoxGeometry(curbWidth, curbHeight, curbSegLen)
        : new THREE.BoxGeometry(curbSegLen, curbHeight, curbWidth);

      const c1 = new THREE.Mesh(curbGeo, mat);
      const c2 = new THREE.Mesh(curbGeo, mat);

      if (isVertical) {
        c1.position.set(x + roadWidth * 0.5 + curbWidth * 0.5, curbHeight * 0.5, z + segOffset);
        c2.position.set(x - roadWidth * 0.5 - curbWidth * 0.5, curbHeight * 0.5, z + segOffset);
      } else {
        c1.position.set(x + segOffset, curbHeight * 0.5, z + roadWidth * 0.5 + curbWidth * 0.5);
        c2.position.set(x + segOffset, curbHeight * 0.5, z - roadWidth * 0.5 - curbWidth * 0.5);
      }

      parent.add(c1, c2);
    }
  }

  private createCrosswalk(parent: THREE.Group, x: number, z: number, roadWidth: number): void {
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const stripeCount = 6;
    const stripeW = 0.5;
    const stripeL = 3.0;

    const offsets = [
      { dx: 0, dz: roadWidth * 0.48, rot: 0 },
      { dx: 0, dz: -roadWidth * 0.48, rot: 0 },
      { dx: roadWidth * 0.48, dz: 0, rot: Math.PI / 2 },
      { dx: -roadWidth * 0.48, dz: 0, rot: Math.PI / 2 },
    ];

    for (const off of offsets) {
      for (let s = 0; s < stripeCount; s++) {
        const span = (s - (stripeCount - 1) * 0.5) * 1.6;
        const stripeGeo = new THREE.PlaneGeometry(stripeW, stripeL);
        stripeGeo.rotateX(-Math.PI / 2);
        if (off.rot !== 0) stripeGeo.rotateY(off.rot);

        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        if (off.rot === 0) {
          stripe.position.set(x + span, 0.025, z + off.dz);
        } else {
          stripe.position.set(x + off.dx, 0.025, z + span);
        }
        parent.add(stripe);
      }
    }
  }

  private createTrafficLightPoles(
    parent: THREE.Group,
    x: number,
    z: number,
    offset: number
  ): { redMesh: THREE.Mesh; yellowMesh: THREE.Mesh; greenMesh: THREE.Mesh; direction: 'NS' | 'EW' }[] {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.7, roughness: 0.3 });
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });

    const meshes: { redMesh: THREE.Mesh; yellowMesh: THREE.Mesh; greenMesh: THREE.Mesh; direction: 'NS' | 'EW' }[] = [];

    const poleConfigs = [
      { px: x + offset, pz: z + offset, rotY: 0, dir: 'NS' as const },
      { px: x - offset, pz: z - offset, rotY: Math.PI, dir: 'NS' as const },
      { px: x + offset, pz: z - offset, rotY: Math.PI / 2, dir: 'EW' as const },
      { px: x - offset, pz: z + offset, rotY: -Math.PI / 2, dir: 'EW' as const },
    ];

    for (const cfg of poleConfigs) {
      const poleGroup = new THREE.Group();
      poleGroup.position.set(cfg.px, 0, cfg.pz);
      poleGroup.rotation.y = cfg.rotY;

      const mastGeo = new THREE.CylinderGeometry(0.12, 0.16, 5.5, 8);
      const mast = new THREE.Mesh(mastGeo, poleMat);
      mast.position.y = 2.75;
      mast.castShadow = true;
      poleGroup.add(mast);

      const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.5, 8);
      armGeo.rotateZ(Math.PI / 2);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(-1.75, 5.2, 0);
      poleGroup.add(arm);

      const houseGeo = new THREE.BoxGeometry(0.4, 1.2, 0.3);
      const housing = new THREE.Mesh(houseGeo, housingMat);
      housing.position.set(-2.5, 4.8, 0);
      poleGroup.add(housing);

      const lampGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const redMat = new THREE.MeshBasicMaterial({ color: 0x220505 });
      const yellowMat = new THREE.MeshBasicMaterial({ color: 0x241a02 });
      const greenMat = new THREE.MeshBasicMaterial({ color: 0x052e16 });

      const redMesh = new THREE.Mesh(lampGeo, redMat);
      redMesh.position.set(-2.5, 5.15, 0.16);

      const yellowMesh = new THREE.Mesh(lampGeo, yellowMat);
      yellowMesh.position.set(-2.5, 4.8, 0.16);

      const greenMesh = new THREE.Mesh(lampGeo, greenMat);
      greenMesh.position.set(-2.5, 4.45, 0.16);

      poleGroup.add(redMesh, yellowMesh, greenMesh);
      parent.add(poleGroup);

      meshes.push({ redMesh, yellowMesh, greenMesh, direction: cfg.dir });
    }

    return meshes;
  }

  /**
   * Generates Accra landmarks (Black Star Gate & Jamestown Lighthouse) and authentic districts.
   */
  private generateAccraLandmarksAndDistricts(parent: THREE.Group): void {
    const buildingGroup = new THREE.Group();
    buildingGroup.name = 'AccraBuildingsAndMonuments';

    // 1. High-Fidelity Black Star Gate & Independence Arch (Central Civic Square: 0, 0, 0)
    const blackStarGate = this.assetManager.loadLandmark('black_star_gate');
    buildingGroup.add(blackStarGate);

    // 2. High-Fidelity Jamestown Lighthouse (Coastal Promontory: -60, 0, 80)
    const jamestownLighthouse = this.assetManager.loadLandmark('jamestown_lighthouse');
    buildingGroup.add(jamestownLighthouse);

    // 3. Characteristic Ghanaian Colonial-Era Architecture (Ga-Mashie / High Street: -60, 0, 35; -60, 0, 5; -60, 0, -25)
    const colonialHouse1 = this.assetManager.loadLandmark('colonial_trading_house_1');
    const colonialHouse2 = this.assetManager.loadLandmark('colonial_trading_house_2');
    const colonialCustoms = this.assetManager.loadLandmark('colonial_customs_house');
    buildingGroup.add(colonialHouse1, colonialHouse2, colonialCustoms);

    // 4. Urban Districts: Airport City, Ridge Ministries, Osu Oxford Street, and Makola Kiosks
    const blockCenters = [
      { x: -60, z: -60, type: 'AIRPORT_CITY' },
      { x: 0, z: -60, type: 'RIDGE_MINISTRIES' },
      { x: 60, z: -60, type: 'AIRPORT_CITY' },
      // (-60, 0) is Ga-Mashie colonial heritage corridor (loaded via asset manager)
      { x: 60, z: 0, type: 'AIRPORT_CITY' },
      // (-60, 60) is Jamestown Lighthouse promontory (loaded via asset manager)
      { x: 0, z: 60, type: 'MAKOLA_MARKET' },
      { x: 60, z: 60, type: 'OSU_OXFORD' },
    ];

    const modernTowersGroup = new THREE.Group();
    modernTowersGroup.name = 'layer_modern_towers';

    const makolaMarketGroup = new THREE.Group();
    makolaMarketGroup.name = 'layer_makola_market';

    const windowTexture = this.generateAccraWindowTexture();

    for (const blk of blockCenters) {
      if (blk.type === 'MAKOLA_MARKET') {
        this.createMakolaMarketStalls(makolaMarketGroup, blk.x, blk.z);
        continue;
      }

      const subOffsets = [
        { dx: -11, dz: -11 },
        { dx: 11, dz: -11 },
        { dx: -11, dz: 11 },
        { dx: 11, dz: 11 },
      ];

      for (let i = 0; i < subOffsets.length; i++) {
        const off = subOffsets[i];
        const bx = blk.x + off.dx;
        const bz = blk.z + off.dz;

        const isModernAirportCity = blk.type === 'AIRPORT_CITY';
        const height = isModernAirportCity ? 28 + Math.random() * 26 : 14 + Math.random() * 16;
        const width = 14 + Math.random() * 3;
        const depth = 14 + Math.random() * 3;

        const towerGroup = new THREE.Group();
        towerGroup.position.set(bx, 0, bz);

        // Warm sandstone & terracotta architectural materials typical of Accra
        const podiumMat = new THREE.MeshStandardMaterial({
          color: isModernAirportCity ? 0xd4a373 : 0xc27039,
          roughness: 0.8,
          metalness: 0.1,
        });
        const podiumGeo = new THREE.BoxGeometry(width + 2, 3.5, depth + 2);
        const podium = new THREE.Mesh(podiumGeo, podiumMat);
        podium.position.y = 1.75;
        podium.castShadow = true;
        podium.receiveShadow = true;
        towerGroup.add(podium);

        // Main building shaft
        const shaftMat = new THREE.MeshStandardMaterial({
          color: isModernAirportCity ? 0x334155 : 0x78350f,
          roughness: 0.35,
          metalness: isModernAirportCity ? 0.6 : 0.1,
          map: windowTexture,
        });
        const shaftGeo = new THREE.BoxGeometry(width, height, depth);
        const shaft = new THREE.Mesh(shaftGeo, shaftMat);
        shaft.position.y = height * 0.5 + 3.5;
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        towerGroup.add(shaft);

        // Rooftop water tank or terrace canopy
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
        const tankGeo = new THREE.CylinderGeometry(1.2, 1.2, 2.0, 12);
        const tank = new THREE.Mesh(tankGeo, roofMat);
        tank.position.set(width * 0.2, height + 4.5, depth * 0.2);
        towerGroup.add(tank);

        modernTowersGroup.add(towerGroup);
      }
    }

    buildingGroup.add(modernTowersGroup, makolaMarketGroup);
    parent.add(buildingGroup);
  }

  /**
   * Makola Market style colorful street merchant stalls and canvas awnings.
   */
  private createMakolaMarketStalls(parent: THREE.Group, x: number, z: number): void {
    const marketGroup = new THREE.Group();
    marketGroup.position.set(x, 0, z);

    // Market terrace
    const terrace = new THREE.Mesh(new THREE.BoxGeometry(36, 0.2, 36), new THREE.MeshStandardMaterial({ color: 0xa85d3b, roughness: 0.9 }));
    terrace.position.y = 0.1;
    marketGroup.add(terrace);

    const colors = [0xd9383a, 0xf59e0b, 0x2563eb, 0x16a34a, 0xe11d48];

    // Array of 3x3 vibrant market stalls
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const stallGroup = new THREE.Group();
        stallGroup.position.set(i * 10, 0, j * 10);

        // Wooden table
        const table = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.2, 3.5), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 }));
        table.position.y = 0.6;
        stallGroup.add(table);

        // Canopy posts
        const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.2);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
        const p1 = new THREE.Mesh(postGeo, postMat);
        p1.position.set(-2.0, 1.6, -1.5);
        const p2 = new THREE.Mesh(postGeo, postMat);
        p2.position.set(2.0, 1.6, -1.5);
        stallGroup.add(p1, p2);

        // Colorful striped canvas awning
        const awningColor = colors[Math.abs(i * 3 + j) % colors.length];
        const awningGeo = new THREE.ConeGeometry(3.6, 1.4, 4);
        awningGeo.rotateY(Math.PI / 4);
        const awning = new THREE.Mesh(awningGeo, new THREE.MeshStandardMaterial({ color: awningColor, roughness: 0.6 }));
        awning.position.y = 3.6;
        stallGroup.add(awning);

        marketGroup.add(stallGroup);
      }
    }

    parent.add(marketGroup);
  }

  /**
   * Generates tall tropical Royal Palm trees (the hallmark of coastal Accra boulevards).
   */
  private generateRoyalPalmsAndGreenery(parent: THREE.Group): void {
    const palmCount = 75;

    // Slender curved trunk
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.45, 9.0, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78533b, roughness: 0.9 });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
    trunkInst.castShadow = true;

    // Palm Canopy (tropical radiating fronds)
    const frondGeo = new THREE.ConeGeometry(3.8, 2.8, 8);
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 });
    const frondInst = new THREE.InstancedMesh(frondGeo, frondMat, palmCount);
    frondInst.castShadow = true;

    const dummy = new THREE.Object3D();
    const palmColors = [new THREE.Color(0x166534), new THREE.Color(0x15803d), new THREE.Color(0x14532d)];

    let pIdx = 0;
    for (let i = 0; i < palmCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 22 + Math.random() * 115;
      const px = Math.cos(angle) * dist;
      const pz = Math.sin(angle) * dist;

      // Keep roads and square clear
      if (Math.abs(px % 60) < 12 || Math.abs(pz % 60) < 12) continue;
      if (Math.abs(px) < 25 && Math.abs(pz) < 25) continue; // Keep Black Star Square open

      const scale = 0.9 + Math.random() * 0.35;

      // Trunk
      dummy.position.set(px, 4.5 * scale, pz);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(pIdx, dummy.matrix);

      // Fronds
      dummy.position.set(px, 9.0 * scale, pz);
      dummy.updateMatrix();
      frondInst.setMatrixAt(pIdx, dummy.matrix);
      frondInst.setColorAt(pIdx, palmColors[pIdx % palmColors.length]);

      pIdx++;
      if (pIdx >= palmCount) break;
    }

    trunkInst.count = pIdx;
    frondInst.count = pIdx;
    trunkInst.instanceMatrix.needsUpdate = true;
    frondInst.instanceMatrix.needsUpdate = true;
    if (frondInst.instanceColor) frondInst.instanceColor.needsUpdate = true;

    const palmsLayer = new THREE.Group();
    palmsLayer.name = 'layer_royal_palms';
    palmsLayer.add(trunkInst, frondInst);
    parent.add(palmsLayer);
  }

  /**
   * Creates authentic overhead road sign gantries with real Accra corridors.
   */
  private createOverheadAccraSignGantries(parent: THREE.Group): void {
    const signs = [
      { x: 30, z: -55, rot: 0, text: 'LIBERATION RD | AIRPORT CITY' },
      { x: -30, z: -55, rot: 0, text: 'INDEPENDENCE AVE | RIDGE' },
      { x: -55, z: 30, rot: Math.PI / 2, text: 'OXFORD ST | OSU DISTRICT' },
      { x: -55, z: -30, rot: Math.PI / 2, text: 'RING ROAD CENTRAL' },
    ];

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x14532d }); // Ghanaian motorway green

    const signsLayer = new THREE.Group();
    signsLayer.name = 'layer_road_signs';

    for (const s of signs) {
      const gantryGroup = new THREE.Group();
      gantryGroup.position.set(s.x, 0, s.z);
      gantryGroup.rotation.y = s.rot;

      // Overhead truss
      const truss = new THREE.Mesh(new THREE.BoxGeometry(15, 0.4, 0.4), frameMat);
      truss.position.y = 6.8;
      const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6.8), frameMat);
      leg1.position.set(-7.5, 3.4, 0);
      const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6.8), frameMat);
      leg2.position.set(7.5, 3.4, 0);

      // Signboard
      const board = new THREE.Mesh(new THREE.BoxGeometry(9.0, 1.8, 0.1), boardMat);
      board.position.set(0, 6.8, 0.2);

      gantryGroup.add(truss, leg1, leg2, board);
      signsLayer.add(gantryGroup);
    }
    parent.add(signsLayer);
  }

  private generateAccraWindowTexture(): THREE.Texture {
    if (typeof document === 'undefined') {
      return new THREE.Texture();
    }
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 128, 128);

    const cols = 8;
    const rows = 12;
    const w = 128 / cols;
    const h = 128 / rows;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const isLit = Math.random() > 0.45;
        ctx.fillStyle = isLit ? '#fef08a' : '#0f172a';
        ctx.fillRect(c * w + 3, r * h + 3, w - 6, h - 6);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 8);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
