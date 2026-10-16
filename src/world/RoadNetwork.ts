/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export type RoadType = 'HIGHWAY' | 'ARTERIAL' | 'RESIDENTIAL' | 'ROUNDABOUT' | 'CONNECTOR';

export interface Waypoint {
  x: number;
  y: number;
  z: number;
  tangentX: number;
  tangentZ: number;
  cumulativeDist: number;
}

export interface LaneConnection {
  targetLaneId: string;
  type: 'STRAIGHT' | 'LEFT_TURN' | 'RIGHT_TURN' | 'MERGE';
  pathWaypoints: Waypoint[];
  length: number;
}

export interface Lane {
  id: string;
  roadSegmentId: string;
  laneIndex: number; // 0 = rightmost, 1 = inner, etc.
  roadType: RoadType;
  speedLimit: number; // in m/s (e.g., 13.88 m/s = 50 km/h)
  width: number;
  waypoints: Waypoint[];
  totalLength: number;
  startNodeId: string;
  endNodeId: string;
  leftAdjacentLaneId: string | null;
  rightAdjacentLaneId: string | null;
  outgoingConnections: LaneConnection[];
  trafficLightId: string | null;
  stopLinePoint: { x: number; y: number; z: number } | null;
}

export interface RoadSegment {
  id: string;
  name: string;
  roadType: RoadType;
  startNodeId: string;
  endNodeId: string;
  speedLimit: number;
  lanes: string[]; // lane IDs
  length: number;
}

export interface IntersectionNode {
  id: string;
  position: THREE.Vector3;
  type: 'SIGNALIZED' | 'UNSIGNALIZED' | 'ROUNDABOUT_CENTER' | 'HIGHWAY_JUNCTION';
  incomingLanes: string[];
  outgoingLanes: string[];
  trafficLightId: string | null;
}

/**
 * Spatial hash grid for fast O(1) spatial queries of vehicles and road elements.
 */
export class SpatialGrid<T extends { id: string; x: number; z: number }> {
  private cellSize: number;
  private cells: Map<string, Set<T>> = new Map();
  private entityToCellKey: Map<string, string> = new Map();

  constructor(cellSize: number = 20) {
    this.cellSize = cellSize;
  }

  private getKey(x: number, z: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx},${cz}`;
  }

  public insert(entity: T): void {
    const key = this.getKey(entity.x, entity.z);
    if (!this.cells.has(key)) {
      this.cells.set(key, new Set());
    }
    this.cells.get(key)!.add(entity);
    this.entityToCellKey.set(entity.id, key);
  }

  public update(entity: T): void {
    const oldKey = this.entityToCellKey.get(entity.id);
    const newKey = this.getKey(entity.x, entity.z);

    if (oldKey === newKey) return;

    if (oldKey && this.cells.has(oldKey)) {
      this.cells.get(oldKey)!.delete(entity);
    }
    if (!this.cells.has(newKey)) {
      this.cells.set(newKey, new Set());
    }
    this.cells.get(newKey)!.add(entity);
    this.entityToCellKey.set(entity.id, newKey);
  }

  public remove(entity: T): void {
    const key = this.entityToCellKey.get(entity.id);
    if (key && this.cells.has(key)) {
      this.cells.get(key)!.delete(entity);
    }
    this.entityToCellKey.delete(entity.id);
  }

  public queryRadius(x: number, z: number, radius: number): T[] {
    const results: T[] = [];
    const minCellX = Math.floor((x - radius) / this.cellSize);
    const maxCellX = Math.floor((x + radius) / this.cellSize);
    const minCellZ = Math.floor((z - radius) / this.cellSize);
    const maxCellZ = Math.floor((z + radius) / this.cellSize);

    const radiusSq = radius * radius;

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const key = `${cx},${cz}`;
        const set = this.cells.get(key);
        if (set) {
          for (const item of set) {
            const dx = item.x - x;
            const dz = item.z - z;
            if (dx * dx + dz * dz <= radiusSq) {
              results.push(item);
            }
          }
        }
      }
    }
    return results;
  }

  public clear(): void {
    this.cells.clear();
    this.entityToCellKey.clear();
  }
}

/**
 * RoadNetwork manages graph topology, lane paths, intersection geometries,
 * and spatial indexing.
 */
export class RoadNetwork {
  public lanes: Map<string, Lane> = new Map();
  public roadSegments: Map<string, RoadSegment> = new Map();
  public intersections: Map<string, IntersectionNode> = new Map();

  // Spatial search structures
  public laneSpatialGrid: SpatialGrid<{ id: string; x: number; z: number }> = new SpatialGrid(30);

  public addIntersection(id: string, position: THREE.Vector3, type: IntersectionNode['type'], trafficLightId: string | null = null): IntersectionNode {
    const node: IntersectionNode = {
      id,
      position: position.clone(),
      type,
      incomingLanes: [],
      outgoingLanes: [],
      trafficLightId,
    };
    this.intersections.set(id, node);
    return node;
  }

  public addLane(lane: Lane): void {
    this.lanes.set(lane.id, lane);

    // Index middle waypoint for spatial lookups
    if (lane.waypoints.length > 0) {
      const midWp = lane.waypoints[Math.floor(lane.waypoints.length / 2)];
      this.laneSpatialGrid.insert({ id: lane.id, x: midWp.x, z: midWp.z });
    }

    // Connect to intersection nodes
    const startNode = this.intersections.get(lane.startNodeId);
    if (startNode && !startNode.outgoingLanes.includes(lane.id)) {
      startNode.outgoingLanes.push(lane.id);
    }

    const endNode = this.intersections.get(lane.endNodeId);
    if (endNode && !endNode.incomingLanes.includes(lane.id)) {
      endNode.incomingLanes.push(lane.id);
    }
  }

  public getLane(id: string): Lane | undefined {
    return this.lanes.get(id);
  }

  public getAllLanes(): Lane[] {
    return Array.from(this.lanes.values());
  }

  public getIntersection(id: string): IntersectionNode | undefined {
    return this.intersections.get(id);
  }

  public getAllIntersections(): IntersectionNode[] {
    return Array.from(this.intersections.values());
  }

  /**
   * Evaluates position along a lane given a longitudinal distance (s).
   */
  public evaluateLanePosition(lane: Lane, distance: number, outPos: THREE.Vector3, outTangent: THREE.Vector3): void {
    const clampedDist = Math.max(0, Math.min(distance, lane.totalLength));
    const waypoints = lane.waypoints;

    if (waypoints.length === 0) {
      outPos.set(0, 0, 0);
      outTangent.set(0, 0, 1);
      return;
    }
    if (waypoints.length === 1 || clampedDist <= 0) {
      outPos.set(waypoints[0].x, waypoints[0].y, waypoints[0].z);
      outTangent.set(waypoints[0].tangentX, 0, waypoints[0].tangentZ);
      return;
    }
    if (clampedDist >= lane.totalLength) {
      const last = waypoints[waypoints.length - 1];
      outPos.set(last.x, last.y, last.z);
      outTangent.set(last.tangentX, 0, last.tangentZ);
      return;
    }

    // Binary search for surrounding waypoints
    let low = 0;
    let high = waypoints.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (waypoints[mid].cumulativeDist <= clampedDist) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const i0 = Math.max(0, high);
    const i1 = Math.min(waypoints.length - 1, i0 + 1);

    const wp0 = waypoints[i0];
    const wp1 = waypoints[i1];
    const segLen = wp1.cumulativeDist - wp0.cumulativeDist;
    const t = segLen > 0.0001 ? (clampedDist - wp0.cumulativeDist) / segLen : 0;

    outPos.x = wp0.x + (wp1.x - wp0.x) * t;
    outPos.y = wp0.y + (wp1.y - wp0.y) * t;
    outPos.z = wp0.z + (wp1.z - wp0.z) * t;

    outTangent.x = wp0.tangentX + (wp1.tangentX - wp0.tangentX) * t;
    outTangent.y = 0;
    outTangent.z = wp0.tangentZ + (wp1.tangentZ - wp0.tangentZ) * t;
    outTangent.normalize();
  }

  /**
   * Finds the closest lane and distance along that lane for an arbitrary (x, z) point.
   */
  public findClosestLane(x: number, z: number): { lane: Lane; distanceAlong: number; lateralOffset: number } | null {
    let closestLane: Lane | null = null;
    let minDistanceSq = Infinity;
    let bestDistAlong = 0;
    let bestLateralOffset = 0;

    for (const lane of this.lanes.values()) {
      const waypoints = lane.waypoints;
      for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i];
        const p2 = waypoints[i + 1];

        const vx = p2.x - p1.x;
        const vz = p2.z - p1.z;
        const segLenSq = vx * vx + vz * vz;
        if (segLenSq < 0.0001) continue;

        const u = Math.max(0, Math.min(1, ((x - p1.x) * vx + (z - p1.z) * vz) / segLenSq));
        const projX = p1.x + u * vx;
        const projZ = p1.z + u * vz;

        const dSq = (x - projX) * (x - projX) + (z - projZ) * (z - projZ);
        if (dSq < minDistanceSq) {
          minDistanceSq = dSq;
          closestLane = lane;
          bestDistAlong = p1.cumulativeDist + u * Math.sqrt(segLenSq);

          // Calculate lateral offset (positive = right, negative = left)
          const normalX = -vz / Math.sqrt(segLenSq);
          const normalZ = vx / Math.sqrt(segLenSq);
          bestLateralOffset = (x - projX) * normalX + (z - projZ) * normalZ;
        }
      }
    }

    if (!closestLane) return null;
    return { lane: closestLane, distanceAlong: bestDistAlong, lateralOffset: bestLateralOffset };
  }
}
