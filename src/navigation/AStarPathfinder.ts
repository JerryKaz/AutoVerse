/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RoadNetwork, Lane, Waypoint } from '../world/RoadNetwork.ts';

interface PathNode {
  laneId: string;
  gScore: number;
  fScore: number;
  parent: PathNode | null;
  connectionIndex: number; // which connection was taken
}

export interface PlannedRoute {
  laneIds: string[];
  waypoints: Waypoint[];
  totalLength: number;
}

export class AStarPathfinder {
  private roadNetwork: RoadNetwork;

  constructor(roadNetwork: RoadNetwork) {
    this.roadNetwork = roadNetwork;
  }

  /**
   * Finds a valid driving route from startLaneId to destinationLaneId or random target.
   */
  public findRoute(startLaneId: string, destinationLaneId?: string): PlannedRoute | null {
    const startLane = this.roadNetwork.getLane(startLaneId);
    if (!startLane) return null;

    // If destination not provided, pick a random lane not equal to start
    let targetLaneId = destinationLaneId;
    if (!targetLaneId) {
      const allLanes = this.roadNetwork.getAllLanes();
      const validTargets = allLanes.filter(l => l.id !== startLaneId && l.outgoingConnections.length > 0);
      if (validTargets.length === 0) return null;
      targetLaneId = validTargets[Math.floor(Math.random() * validTargets.length)].id;
    }

    const targetLane = this.roadNetwork.getLane(targetLaneId);
    if (!targetLane) return null;

    const targetEnd = targetLane.waypoints[targetLane.waypoints.length - 1];

    // Priority Queue using Array with binary insert or sorted list (graph has modest number of lanes ~30-100)
    const openSet: PathNode[] = [];
    const closedSet: Set<string> = new Set();
    const gScores: Map<string, number> = new Map();

    const startNode: PathNode = {
      laneId: startLaneId,
      gScore: 0,
      fScore: this.heuristic(startLane, targetEnd),
      parent: null,
      connectionIndex: -1,
    };

    openSet.push(startNode);
    gScores.set(startLaneId, 0);

    let foundTarget: PathNode | null = null;
    let iterations = 0;
    const maxIterations = 200;

    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;

      // Pop node with lowest fScore
      openSet.sort((a, b) => a.fScore - b.fScore);
      const current = openSet.shift()!;

      if (current.laneId === targetLaneId) {
        foundTarget = current;
        break;
      }

      closedSet.add(current.laneId);

      const currentLane = this.roadNetwork.getLane(current.laneId);
      if (!currentLane) continue;

      for (let cIdx = 0; cIdx < currentLane.outgoingConnections.length; cIdx++) {
        const conn = currentLane.outgoingConnections[cIdx];
        const nextLaneId = conn.targetLaneId;

        if (closedSet.has(nextLaneId)) continue;

        const nextLane = this.roadNetwork.getLane(nextLaneId);
        if (!nextLane) continue;

        // Cost = traversal time + turn penalty
        let turnPenalty = 0;
        if (conn.type === 'LEFT_TURN') turnPenalty = 3.0; // Left turns cross opposing traffic
        if (conn.type === 'RIGHT_TURN') turnPenalty = 1.0;

        const traversalTime = (currentLane.totalLength / Math.max(5, currentLane.speedLimit)) + turnPenalty;
        const tentativeG = current.gScore + traversalTime;

        if (!gScores.has(nextLaneId) || tentativeG < gScores.get(nextLaneId)!) {
          gScores.set(nextLaneId, tentativeG);
          const f = tentativeG + this.heuristic(nextLane, targetEnd);

          const neighborNode: PathNode = {
            laneId: nextLaneId,
            gScore: tentativeG,
            fScore: f,
            parent: current,
            connectionIndex: cIdx,
          };

          const existingIdx = openSet.findIndex(n => n.laneId === nextLaneId);
          if (existingIdx !== -1) {
            openSet[existingIdx] = neighborNode;
          } else {
            openSet.push(neighborNode);
          }
        }
      }
    }

    // Reconstruct path
    const laneSequence: string[] = [];
    let curr: PathNode | null = foundTarget || (openSet.length > 0 ? openSet[0] : null);

    // If destination unreachable directly, pick best node explored
    if (!curr) {
      laneSequence.push(startLaneId);
    } else {
      while (curr) {
        laneSequence.unshift(curr.laneId);
        curr = curr.parent;
      }
    }

    // Generate stitched waypoints
    return this.buildStitchedRoute(laneSequence);
  }

  private heuristic(lane: Lane, targetEnd: { x: number; z: number }): number {
    if (lane.waypoints.length === 0) return 0;
    const end = lane.waypoints[lane.waypoints.length - 1];
    const dx = targetEnd.x - end.x;
    const dz = targetEnd.z - end.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    return dist / 25; // max highway speed (25 m/s)
  }

  private buildStitchedRoute(laneIds: string[]): PlannedRoute {
    const routeWaypoints: Waypoint[] = [];
    let cumulative = 0;

    for (let i = 0; i < laneIds.length; i++) {
      const lane = this.roadNetwork.getLane(laneIds[i]);
      if (!lane) continue;

      const waypoints = lane.waypoints;
      for (let j = 0; j < waypoints.length; j++) {
        // Skip duplicate connecting point
        if (routeWaypoints.length > 0 && j === 0) {
          const prev = routeWaypoints[routeWaypoints.length - 1];
          const distToPrev = Math.hypot(waypoints[0].x - prev.x, waypoints[0].z - prev.z);
          if (distToPrev < 0.2) continue;
        }

        if (routeWaypoints.length > 0) {
          const prev = routeWaypoints[routeWaypoints.length - 1];
          cumulative += Math.hypot(waypoints[j].x - prev.x, waypoints[j].z - prev.z);
        }

        routeWaypoints.push({
          x: waypoints[j].x,
          y: waypoints[j].y,
          z: waypoints[j].z,
          tangentX: waypoints[j].tangentX,
          tangentZ: waypoints[j].tangentZ,
          cumulativeDist: cumulative,
        });
      }
    }

    return {
      laneIds,
      waypoints: routeWaypoints,
      totalLength: cumulative,
    };
  }
}
