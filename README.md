# AutoVerse - 3D Autonomous Driving Simulation (Accra, Ghana)
<img width="1919" height="889" alt="image" src="https://github.com/user-attachments/assets/6345e0d9-71e4-4863-9f70-17d2830f1e42" />



A production-grade, real-time 3D autonomous driving and urban traffic simulation set in **Accra, Ghana**, built with TypeScript, Three.js, and React.

Vehicles including autonomous Trotros (minibuses), iconic yellow-fender Accra taxis, electric robotaxis, and logistics couriers navigate corridors modeled after Accra's major avenues (Liberation Road, Independence Avenue, Oxford Street, and Ring Road Central) past landmarks like the **Black Star Gate & Independence Arch**, the **Jamestown Lighthouse**, and the **Atlantic coastline (Gulf of Guinea)**.

---

## Architecture Overview

The system is organized into modular, testable subsystems:

```
src/
├── core/
│   ├── EventBus.ts          # Typed event bus for decoupled simulation communication
│   ├── TimeManager.ts       # Fixed-timestep physics engine (60Hz) with sub-stepping
│   └── SimulationEngine.ts  # Master simulation loop and spatial collision resolution
├── world/
│   ├── RoadNetwork.ts       # Directed graph of lanes, intersections, and spatial grid index
│   ├── CityGenerator.ts     # Procedural 3D urban environment, roads, buildings & greenery
│   └── Environment.ts       # Day/Sunset/Night lighting, atmospheric fog, and precipitation
├── traffic/
│   ├── TrafficLight.ts      # Multi-phase signal state machine with all-red clearance
│   └── TrafficManager.ts    # Intersection coordination, congestion tracking & telemetry
├── navigation/
│   └── AStarPathfinder.ts   # A* routing over directed lane graph with waypoint stitching
├── vehicles/
│   ├── VehicleTypes.ts      # Vehicle specs (Sedan, EV SUV, Sports Coupe, Van, Shuttle)
│   ├── SensorSystem.ts      # Forward LiDAR/radar ray array, side sensors & signal detection
│   ├── BehaviorPlanner.ts   # IDM car-following, MOBIL lane changes & emergency braking
│   ├── VehicleController.ts # Bicycle kinematic model with Pure Pursuit lateral tracking
│   └── Vehicle.ts           # 3-12 part procedural 3D model, lighting, and animation
├── rendering/
│   ├── SceneManager.ts      # Three.js PBR renderer, dynamic shadows & debug overlays
│   └── CameraController.ts  # Orbit, Aerial, Chase Follow, Hood View & Free Roam
├── ui/
│   ├── Dashboard.tsx        # Unified layout & canvas lifecycle
│   ├── SimulationStats.tsx  # Live top telemetry bar
│   ├── VehicleInspector.tsx # Real-time vehicle inspector & manual intervention
│   └── ControlsDock.tsx     # Collapsible bottom dock with zero viewport occlusion
└── tests/
    └── simulation.test.ts   # Comprehensive unit & integration tests
```

---

## Key Engineering Features

### 1. Hierarchical Autonomous Controller
- **Perception (`SensorSystem`)**: 65-meter forward ray array, closing velocity ($\Delta v$), Time-To-Collision (TTC) calculations, and adjacent lane gap acceptance.
- **Behavior Planning (`BehaviorPlanner`)**: Finite-state machine implementing:
  - *Intelligent Driver Model (IDM)*: Smooth longitudinal acceleration and safe dynamic headway.
  - *MOBIL Lane Changing*: Incentive criterion based on lead vehicle velocity + safety constraint ensuring trailing vehicles are not forced into emergency braking.
  - *Traffic Signal Compliance*: Stopping smoothly before stop lines and resolving yellow light dilemma zones.
- **Motion Control (`VehicleController`)**: Bicycle kinematic model with Pure Pursuit lateral path tracking and steering rate inertia.

### 2. Smart Road Network & Traffic Signals
- Directed graph with multi-lane arterial avenues, signalized 4-way intersections, and an outer high-speed expressway loop.
- Non-conflicting 4-phase traffic lights with yellow intervals and all-red safety clearances.
- Spatial hash grid (`SpatialGrid`) providing $O(1)$ vehicle proximity queries, eliminating $O(N^2)$ checks for 100+ simulated cars.

### 3. Visuals & Rendering (Three.js Studio Standards)
- Composite 3–12 part procedural vehicle models: chassis, tinted reflective glass cabin, alloy wheels with tire rotation, functional headlights, braking indicators, blinking amber turn signals, and a rotating roof LiDAR puck.
- Studio environment reflections (`RoomEnvironment` + `PMREMGenerator`) on vehicle paint and glass.
- Atmospheric lighting: Daylight, Golden Sunset, and Night Drive with animated precipitation and horizon fog.

### 4. Interactive Telemetry & Camera System
- **Camera Views**:
  - `Orbit City`: Smooth mouse orbit with exponential damping.
  - `Aerial View`: High top-down perspective for traffic flow monitoring.
  - `Chase Follow`: Third-person vehicle chase cam with dynamic lookahead.
  - `Hood / Cockpit`: Immersive driver view through the front windshield.
  - `Intersection Cam`: Fixed view overlooking signal phases.
  - `Free Roam`: WASD + mouse camera fly-through.
- **Vehicle Inspector**: Click any vehicle in the 3D viewport to inspect real-time speed, controller state, LiDAR gap readouts, and trigger manual emergency braking or camera lock.

---

## Getting Started

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Run Tests
```bash
npm run test
```

### GitHub Pages Deployment

This repository is configured for GitHub Pages with two deployment methods:

#### Method 1: Automatic Deployment via GitHub Actions (Recommended)
1. In your GitHub repository, navigate to **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, choose **GitHub Actions**.
3. Push to `main` or `master` branch. The included `.github/workflows/deploy.yml` workflow will automatically test, build, and deploy your simulation.

#### Method 2: Manual Deployment via CLI
Run the deploy script to build and push to the `gh-pages` branch:
```bash
npm run deploy
```

---

## Keyboard Shortcuts
- `Space`: Pause / Resume simulation
- `1`: 1.0x Real-time simulation speed
- `2`: 2.0x Fast-forward simulation speed
- `3`: 4.0x High-speed simulation speed
- `W/A/S/D`: Camera fly-through in Free Roam mode
