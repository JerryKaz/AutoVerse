/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export interface LandmarkMetadata {
  id: string;
  name: string;
  locationName: string;
  historicalPeriod: string;
  coordinates: { x: number; y: number; z: number };
  heading: number; // yaw rotation in radians
  scale: number;
  description: string;
}

export interface AssetLoadOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
  wireframe?: boolean;
}

/**
 * AccraAssetManager:
 * High-fidelity 3D procedural asset pipeline and registry for Accra, Ghana landmarks:
 * - Black Star Gate & Independence Arch (Central Square origin)
 * - Jamestown Lighthouse (Coastal Promontory origin)
 * - Ghanaian Colonial-Era Mercantile Trading Houses (Historic High Street / Old Accra origin)
 * - Osu Coastal Heritage Pavilions
 */
export class AccraAssetManager {
  private static instance: AccraAssetManager;
  private assetCache: Map<string, THREE.Group> = new Map();
  private metadataRegistry: Map<string, LandmarkMetadata> = new Map();

  constructor() {
    this.registerLandmarkMetadata();
  }

  public static getInstance(): AccraAssetManager {
    if (!AccraAssetManager.instance) {
      AccraAssetManager.instance = new AccraAssetManager();
    }
    return AccraAssetManager.instance;
  }

  private registerLandmarkMetadata(): void {
    this.metadataRegistry.set('black_star_gate', {
      id: 'black_star_gate',
      name: 'Black Star Gate & Independence Arch',
      locationName: 'Black Star Square, Osu Coastal Strip',
      historicalPeriod: 'Post-Independence Modernist (1961)',
      coordinates: { x: 0, y: 0, z: 0 }, // Center of simulation civic square
      heading: 0,
      scale: 1.0,
      description: 'National monument of Ghana commissioned by Dr. Kwame Nkrumah, crowned by the Black Star of Africa.',
    });

    this.metadataRegistry.set('jamestown_lighthouse', {
      id: 'jamestown_lighthouse',
      name: 'Jamestown Lighthouse',
      locationName: 'Jamestown Harbour Promontory',
      historicalPeriod: 'Colonial Maritime (1930s replacement of 1871 tower)',
      coordinates: { x: -60, y: 0, z: 80 }, // Coastal Atlantic promontory
      heading: -Math.PI / 4,
      scale: 1.0,
      description: '28-metre active navigation beacon with iconic red-and-white horizontal bands overlooking the Gulf of Guinea.',
    });

    this.metadataRegistry.set('colonial_trading_house_1', {
      id: 'colonial_trading_house_1',
      name: 'High Street Mercantile Trading House',
      locationName: 'Old Accra / Ga-Mashie Historic District',
      historicalPeriod: 'Gold Coast Colonial Era (Late 19th Century)',
      coordinates: { x: -60, y: 0, z: 35 },
      heading: 0,
      scale: 1.0,
      description: 'Two-storey Anglo-Danish mercantile mansion featuring ground-floor arched stone arcades, timber veranda colonnades, and pitched terracotta corrugated hip roof.',
    });

    this.metadataRegistry.set('colonial_trading_house_2', {
      id: 'colonial_trading_house_2',
      name: 'Ga-Mashie Heritage Merchant Lodge',
      locationName: 'High Street Historic Quarter',
      historicalPeriod: 'Gold Coast Colonial Era (Early 20th Century)',
      coordinates: { x: -60, y: 0, z: -25 },
      heading: Math.PI,
      scale: 1.0,
      description: 'Colonial administrative lodge with lime-washed ochre stucco, louvered timber shutters, and shaded cantilevered balcony.',
    });

    this.metadataRegistry.set('colonial_customs_house', {
      id: 'colonial_customs_house',
      name: 'High Street Old Customs & Post Office',
      locationName: 'Old Accra Port / Marine Drive Approach',
      historicalPeriod: 'British Gold Coast Colonial Era (c. 1895)',
      coordinates: { x: -60, y: 0, z: 5 },
      heading: -Math.PI / 2,
      scale: 1.0,
      description: 'Neoclassical colonial maritime customs house featuring Doric colonnade portico, rusticated quoins, and octagonal harbor clock tower.',
    });
  }

  public getMetadata(id: string): LandmarkMetadata | undefined {
    return this.metadataRegistry.get(id);
  }

  public getAllMetadata(): LandmarkMetadata[] {
    return Array.from(this.metadataRegistry.values());
  }

  /**
   * Instantiates or clones a high-fidelity landmark model with cached geometries and PBR materials.
   */
  public loadLandmark(id: string, options: AssetLoadOptions = {}): THREE.Group {
    const meta = this.metadataRegistry.get(id);
    if (!meta) {
      throw new Error(`Landmark asset with id "${id}" not found in AccraAssetManager.`);
    }

    let model: THREE.Group;
    switch (id) {
      case 'black_star_gate':
        model = this.buildHighFidelityBlackStarGate();
        break;
      case 'jamestown_lighthouse':
        model = this.buildHighFidelityJamestownLighthouse();
        break;
      case 'colonial_trading_house_1':
        model = this.buildColonialTradingHouse(true);
        break;
      case 'colonial_trading_house_2':
        model = this.buildColonialTradingHouse(false);
        break;
      case 'colonial_customs_house':
        model = this.buildColonialCustomsHouse();
        break;
      default:
        model = new THREE.Group();
    }

    // Set precise coordinate origins and orientation
    model.position.set(meta.coordinates.x, meta.coordinates.y, meta.coordinates.z);
    model.rotation.y = meta.heading;
    model.scale.set(meta.scale, meta.scale, meta.scale);
    model.name = `landmark_${id}`;

    // Apply shadow options
    const cast = options.castShadow ?? true;
    const recv = options.receiveShadow ?? true;
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = cast;
        child.receiveShadow = recv;
      }
    });

    return model;
  }

  /**
   * High-Fidelity Black Star Gate & Independence Arch:
   * Features stepped granite plinth, classical fluted pylons, coffered arch vault,
   * entablature with gold inscription plaque, and the sculpted 5-pointed Black Star of Africa.
   */
  private buildHighFidelityBlackStarGate(): THREE.Group {
    const group = new THREE.Group();

    // 1. Ceremonial Stepped Granite Plinth Base
    const plinthGeo = new THREE.BoxGeometry(42, 0.6, 42);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // dark granite parade ground
      roughness: 0.85,
      metalness: 0.1,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = 0.3;
    group.add(plinth);

    // Inner ceremonial parade steps (3 tiers)
    for (let t = 0; t < 3; t++) {
      const stepW = 32 - t * 2.5;
      const stepD = 22 - t * 2;
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(stepW, 0.25, stepD),
        new THREE.MeshStandardMaterial({ color: 0xd8d4cb, roughness: 0.7 })
      );
      step.position.y = 0.6 + t * 0.25;
      group.add(step);
    }

    // 2. Twin Monumental Limestone Pylons
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0xe8e4dc, // warm Ghanaian limestone / travertine
      roughness: 0.55,
      metalness: 0.08,
    });

    const pylonW = 6.2;
    const pylonH = 17.0;
    const pylonD = 7.5;
    const span = 9.0; // distance from center

    // Left pylon with base pedestal and capital moulding
    const leftPylon = this.createPylon(pylonW, pylonH, pylonD, stoneMat);
    leftPylon.position.set(-span, 1.35 + pylonH * 0.5, 0);
    const rightPylon = this.createPylon(pylonW, pylonH, pylonD, stoneMat);
    rightPylon.position.set(span, 1.35 + pylonH * 0.5, 0);
    group.add(leftPylon, rightPylon);

    // 3. Central Coffered Vault Arch Header
    const archH = 4.8;
    const archHeader = new THREE.Mesh(
      new THREE.BoxGeometry(span * 2 + pylonW, archH, pylonD + 0.6),
      stoneMat
    );
    archHeader.position.set(0, 1.35 + pylonH + archH * 0.5, 0);
    group.add(archHeader);

    // Archway curved barrel soffit
    const archCurveShape = new THREE.Shape();
    archCurveShape.moveTo(-span + pylonW * 0.5, 0);
    archCurveShape.quadraticCurveTo(0, 4.5, span - pylonW * 0.5, 0);
    archCurveShape.lineTo(span - pylonW * 0.5, -0.5);
    archCurveShape.lineTo(-span + pylonW * 0.5, -0.5);
    archCurveShape.closePath();

    const archCurveGeo = new THREE.ExtrudeGeometry(archCurveShape, {
      depth: pylonD,
      bevelEnabled: false,
    });
    const archCurve = new THREE.Mesh(archCurveGeo, stoneMat);
    archCurve.position.set(0, 1.35 + pylonH - 3.8, -pylonD * 0.5);
    group.add(archCurve);

    // 4. Inscription Frieze Plaque ("AD 1957 - FREEDOM AND JUSTICE")
    const plaqueMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Polished Ghanaian Gold Brass
      metalness: 0.85,
      roughness: 0.25,
    });
    const plaqueGeo = new THREE.BoxGeometry(16.0, 1.4, pylonD + 0.7);
    const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
    plaque.position.set(0, 1.35 + pylonH + 2.2, 0);
    group.add(plaque);

    // 5. Crown Attic Pedestal
    const atticGeo = new THREE.BoxGeometry(10.5, 2.4, 6.0);
    const attic = new THREE.Mesh(atticGeo, stoneMat);
    attic.position.set(0, 1.35 + pylonH + archH + 1.2, 0);
    group.add(attic);

    // 6. Sculpted 3D Five-Pointed Black Star of Africa
    const starShape = new THREE.Shape();
    const points = 5;
    const outerR = 3.6;
    const innerR = 1.5;

    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const sx = Math.cos(angle) * r;
      const sy = Math.sin(angle) * r;
      if (i === 0) starShape.moveTo(sx, sy);
      else starShape.lineTo(sx, sy);
    }
    starShape.closePath();

    const starExtrudeSettings = {
      depth: 0.9,
      bevelEnabled: true,
      bevelThickness: 0.35,
      bevelSize: 0.2,
      bevelSegments: 3,
    };
    const starGeo = new THREE.ExtrudeGeometry(starShape, starExtrudeSettings);
    const blackStarMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a, // Deep polished black granite
      metalness: 0.9,
      roughness: 0.15,
    });
    const blackStar = new THREE.Mesh(starGeo, blackStarMat);
    blackStar.position.set(0, 1.35 + pylonH + archH + 2.4 + outerR, -0.45);
    group.add(blackStar);

    // 7. Ceremonial Eternal Flame Brazier Urns flanking arch
    const brazierMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.85, roughness: 0.25 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    const createBrazier = (bx: number, bz: number) => {
      const bGroup = new THREE.Group();
      bGroup.position.set(bx, 1.35, bz);
      const pedestalMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.8, 16), brazierMat);
      pedestalMesh.position.y = 0.9;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.4, 0.7, 16), brazierMat);
      bowl.position.y = 2.1;
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 8), flameMat);
      flame.position.y = 2.8;
      bGroup.add(pedestalMesh, bowl, flame);
      return bGroup;
    };

    group.add(createBrazier(-16, 7));
    group.add(createBrazier(16, 7));
    group.add(createBrazier(-16, -7));
    group.add(createBrazier(16, -7));

    return group;
  }

  private createPylon(w: number, h: number, d: number, mat: THREE.Material): THREE.Group {
    const pGroup = new THREE.Group();

    // Base footing
    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 1.2, d + 0.8), mat);
    base.position.y = -h * 0.5 + 0.6;
    pGroup.add(base);

    // Main column shaft
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(w, h - 2.4, d), mat);
    pGroup.add(shaft);

    // Capital cornice moulding
    const capital = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 1.2, d + 0.8), mat);
    capital.position.y = h * 0.5 - 0.6;
    pGroup.add(capital);

    return pGroup;
  }

  /**
   * High-Fidelity Jamestown Lighthouse (1930s):
   * Features polygonal keeper's bastion, 28-meter tapering cylindrical tower with
   * precision red and white bands, cast-iron gallery with brackets and balustrade,
   * glass Fresnel lantern chamber, and active revolving nautical beacon.
   */
  private buildHighFidelityJamestownLighthouse(): THREE.Group {
    const group = new THREE.Group();

    // 1. Bastion / Keeper's Quarters Base
    const bastionW = 18.0;
    const bastionH = 4.2;
    const bastionD = 18.0;
    const bastionGeo = new THREE.BoxGeometry(bastionW, bastionH, bastionD);
    const bastionMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // whitewashed masonry
      roughness: 0.8,
    });
    const bastion = new THREE.Mesh(bastionGeo, bastionMat);
    bastion.position.y = bastionH * 0.5;
    group.add(bastion);

    // Keeper's Quarters roof parapet & terracotta coping
    const parapetGeo = new THREE.BoxGeometry(bastionW + 0.4, 0.4, bastionD + 0.4);
    const parapetMat = new THREE.MeshStandardMaterial({ color: 0xa85d3b, roughness: 0.7 });
    const parapet = new THREE.Mesh(parapetGeo, parapetMat);
    parapet.position.y = bastionH + 0.2;
    group.add(parapet);

    // Wooden colonial louvered entrance doors & windows
    const woodDoorMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.6 });
    const doorGeo = new THREE.BoxGeometry(2.0, 2.6, 0.2);
    const door = new THREE.Mesh(doorGeo, woodDoorMat);
    door.position.set(0, 1.3, bastionD * 0.5 + 0.1);
    group.add(door);

    // 2. The 28-Metre Tapering Cylindrical Tower with 6 Alternating Red and White Bands
    const towerH = 26.0;
    const bandsCount = 6;
    const bandH = towerH / bandsCount;

    const crimsonMat = new THREE.MeshStandardMaterial({
      color: 0xd9383a, // British Admiralty Red
      roughness: 0.35,
    });
    const whiteBandMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // Pure white lighthouse enamel
      roughness: 0.35,
    });

    for (let b = 0; b < bandsCount; b++) {
      const isCrimson = b % 2 === 0;
      const bottomR = 3.6 - (b / bandsCount) * 1.0;
      const topR = 3.6 - ((b + 1) / bandsCount) * 1.0;

      const segGeo = new THREE.CylinderGeometry(topR, bottomR, bandH, 24);
      const segMesh = new THREE.Mesh(segGeo, isCrimson ? crimsonMat : whiteBandMat);
      segMesh.position.y = bastionH + b * bandH + bandH * 0.5;
      group.add(segMesh);
    }

    // 3. Cantilevered Cast-Iron Gallery & Balustrade
    const galleryY = bastionH + towerH;
    const galleryPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(3.6, 3.2, 0.6, 24),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.85, roughness: 0.2 })
    );
    galleryPlinth.position.y = galleryY + 0.3;
    group.add(galleryPlinth);

    // Cast-iron perimeter railing
    const railMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.9, roughness: 0.2 });
    const railingGeo = new THREE.TorusGeometry(3.5, 0.08, 6, 24);
    railingGeo.rotateX(Math.PI / 2);
    const railTop = new THREE.Mesh(railingGeo, railMat);
    railTop.position.y = galleryY + 1.4;
    group.add(railTop);

    // 4. Glass Fresnel Lantern Chamber
    const lanternR = 2.3;
    const lanternH = 2.8;
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.92,
      roughness: 0.05,
      thickness: 1.2,
      ior: 1.5,
    });
    const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(lanternR, lanternR, lanternH, 20), glassMat);
    lanternGlass.position.y = galleryY + 0.6 + lanternH * 0.5;
    group.add(lanternGlass);

    // Rotating Core Beacon Light Source
    const beaconLight = new THREE.PointLight(0xfef08a, 2.5, 120);
    beaconLight.position.set(0, galleryY + 0.6 + lanternH * 0.5, 0);
    beaconLight.castShadow = true;
    group.add(beaconLight);

    const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), new THREE.MeshBasicMaterial({ color: 0xfffaed }));
    bulbMesh.position.copy(beaconLight.position);
    group.add(bulbMesh);

    // 5. Domed Copper Cupola & Brass Weathervane Finial
    const cupolaGeo = new THREE.SphereGeometry(lanternR + 0.1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const cupola = new THREE.Mesh(cupolaGeo, crimsonMat);
    cupola.position.y = galleryY + 0.6 + lanternH;
    group.add(cupola);

    const finial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.1, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.2 })
    );
    finial.position.y = galleryY + 0.6 + lanternH + lanternR + 1.1;
    group.add(finial);

    return group;
  }

  /**
   * Characteristic Gold Coast Colonial-Era Architecture (Late 19th / Early 20th Century):
   * Modeled after historic trading houses along High Street, Jamestown, and Ga-Mashie:
   * - Ground-floor arched stone merchant arcade.
   * - Shaded timber verandas with perimeter railings and colonnades.
   * - Weathered lime-washed ochre/cream masonry.
   * - Terracotta pitched hip roof with dormers.
   * - Green louvered shutters protecting against the equatorial Atlantic sun.
   */
  private buildColonialTradingHouse(hasUpperVeranda: boolean): THREE.Group {
    const group = new THREE.Group();

    const w = 22.0;
    const h1 = 4.5; // ground floor height
    const h2 = 4.2; // second floor height
    const d = 16.0;

    // 1. Ground Floor Masonry Arcade
    const wallOchreMat = new THREE.MeshStandardMaterial({
      color: 0xdeb887, // warm Ghanaian ochre stucco / lime wash
      roughness: 0.9,
    });
    const stoneArchMat = new THREE.MeshStandardMaterial({
      color: 0xd4a373, // coastal laterite sandstone
      roughness: 0.8,
    });

    const groundFloor = new THREE.Mesh(new THREE.BoxGeometry(w, h1, d), wallOchreMat);
    groundFloor.position.y = h1 * 0.5;
    group.add(groundFloor);

    // Arched arcade bays on the front facade
    const archCount = 4;
    const archSpan = w / archCount;
    for (let a = 0; a < archCount; a++) {
      const ax = -w * 0.5 + (a + 0.5) * archSpan;
      const pier = new THREE.Mesh(new THREE.BoxGeometry(1.0, h1, 0.6), stoneArchMat);
      pier.position.set(ax, h1 * 0.5, d * 0.5 + 0.3);
      group.add(pier);

      const archSpandrel = new THREE.Mesh(new THREE.BoxGeometry(archSpan * 0.85, 0.8, 0.4), stoneArchMat);
      archSpandrel.position.set(ax, h1 - 0.4, d * 0.5 + 0.25);
      group.add(archSpandrel);
    }

    // 2. Second Floor with Louvered Windows & Green Timber Shutters
    const upperFloor = new THREE.Mesh(new THREE.BoxGeometry(w - 0.8, h2, d - 0.8), wallOchreMat);
    upperFloor.position.y = h1 + h2 * 0.5;
    group.add(upperFloor);

    // Green louvered shutters (characteristic Anglo-Danish Gold Coast trading style)
    const shutterMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.6 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2 });

    const winCount = 5;
    for (let i = 0; i < winCount; i++) {
      const wx = -w * 0.4 + i * (w * 0.8 / (winCount - 1));

      // Window glass
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.2), glassMat);
      win.position.set(wx, h1 + 2.2, d * 0.5 + 0.1);

      // Louvers
      const leftShutter = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 0.1), shutterMat);
      leftShutter.position.set(wx - 1.1, h1 + 2.2, d * 0.5 + 0.15);

      const rightShutter = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 0.1), shutterMat);
      rightShutter.position.set(wx + 1.1, h1 + 2.2, d * 0.5 + 0.15);

      group.add(win, leftShutter, rightShutter);
    }

    // 3. Cantilevered Timber Veranda (Balcony) with Colonnade
    if (hasUpperVeranda) {
      const verandaDeck = new THREE.Mesh(
        new THREE.BoxGeometry(w + 1.5, 0.3, 2.8),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
      );
      verandaDeck.position.set(0, h1 + 0.15, d * 0.5 + 1.4);
      group.add(verandaDeck);

      // Colonnade timber posts supporting the veranda roof
      const postMat = new THREE.MeshStandardMaterial({ color: 0x58240c, roughness: 0.8 });
      for (let p = 0; p < 6; p++) {
        const px = -w * 0.45 + p * (w * 0.9 / 5);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, h2, 8), postMat);
        post.position.set(px, h1 + h2 * 0.5, d * 0.5 + 2.7);
        group.add(post);
      }

      // Veranda timber balustrade
      const balustrade = new THREE.Mesh(
        new THREE.BoxGeometry(w + 1.2, 1.0, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x58240c, roughness: 0.8 })
      );
      balustrade.position.set(0, h1 + 0.8, d * 0.5 + 2.7);
      group.add(balustrade);
    }

    // 4. Pitched Terracotta Corrugated Hip Roof with Overhanging Eaves
    const roofH = 4.5;
    const roofGeo = new THREE.ConeGeometry(Math.max(w, d) * 0.85, roofH, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x9a3412, // weathered red terracotta tile / corrugated zinc
      roughness: 0.75,
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, h1 + h2 + roofH * 0.5, 0);
    group.add(roof);

    return group;
  }

  /**
   * High-Fidelity British Gold Coast High Street Post & Customs House (c. 1895):
   * Features raised rusticated plinth, hexastyle Doric portico colonnade, classical pediment
   * with relief crest, multi-pane arched maritime administrative windows, and an octagonal
   * harbour clock tower cupola overlooking the Atlantic approaches.
   */
  private buildColonialCustomsHouse(): THREE.Group {
    const group = new THREE.Group();

    const w = 26.0;
    const h1 = 5.2; // ground portico floor
    const h2 = 4.4; // upper administrative floor
    const d = 18.0;

    const creamMat = new THREE.MeshStandardMaterial({
      color: 0xede8d0, // Gold Coast imperial whitewashed lime/cream
      roughness: 0.75,
      metalness: 0.05,
    });
    const stonePedestalMat = new THREE.MeshStandardMaterial({
      color: 0xa89f91, // weathered Gold Coast sandstone
      roughness: 0.85,
    });
    const slateRoofMat = new THREE.MeshStandardMaterial({
      color: 0x475569, // weathered maritime slate / leaded zinc
      roughness: 0.65,
    });

    // 1. Rusticated Foundation Plinth
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 2.0, 0.8, d + 2.0), stonePedestalMat);
    plinth.position.y = 0.4;
    group.add(plinth);

    // Front approach grand stairs
    for (let s = 0; s < 3; s++) {
      const stair = new THREE.Mesh(
        new THREE.BoxGeometry(14.0 - s * 1.5, 0.25, 4.0 + (2 - s) * 0.8),
        stonePedestalMat
      );
      stair.position.set(0, 0.25 * (s + 1), d * 0.5 + 1.0 + (2 - s) * 0.4);
      group.add(stair);
    }

    // 2. Main Ground Floor Structure
    const groundFloor = new THREE.Mesh(new THREE.BoxGeometry(w, h1, d), creamMat);
    groundFloor.position.y = 0.8 + h1 * 0.5;
    group.add(groundFloor);

    // Doric Portico Colonnade (6 Fluted Columns on front portico)
    const colCount = 6;
    const colSpan = (w * 0.75) / (colCount - 1);
    const colMat = new THREE.MeshStandardMaterial({ color: 0xfaf8f5, roughness: 0.5 });

    for (let c = 0; c < colCount; c++) {
      const cx = -w * 0.375 + c * colSpan;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, h1, 16), colMat);
      col.position.set(cx, 0.8 + h1 * 0.5, d * 0.5 + 2.2);

      // Capital & Base plinths
      const colBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 1.1), colMat);
      colBase.position.set(cx, 0.8 + 0.15, d * 0.5 + 2.2);
      const colCap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 1.1), colMat);
      colCap.position.set(cx, 0.8 + h1 - 0.15, d * 0.5 + 2.2);

      group.add(col, colBase, colCap);
    }

    // Portico Pediment Roof Slab
    const porticoRoof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8 + 1.6, 0.6, 3.2), colMat);
    porticoRoof.position.set(0, 0.8 + h1 + 0.3, d * 0.5 + 2.0);
    group.add(porticoRoof);

    // 3. Second Administrative Storey
    const upperFloor = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, h2, d - 0.6), creamMat);
    upperFloor.position.y = 0.8 + h1 + h2 * 0.5;
    group.add(upperFloor);

    // Arched multi-pane colonial sash windows
    const winMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.6 }); // British colonial deep green
    for (let i = 0; i < 5; i++) {
      const wx = -w * 0.35 + i * (w * 0.7 / 4);
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 0.2), winMat);
      win.position.set(wx, 0.8 + h1 + 2.3, d * 0.5 + 0.1);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.7, 0.15), trimMat);
      frame.position.set(wx, 0.8 + h1 + 2.3, d * 0.5 + 0.05);

      group.add(frame, win);
    }

    // 4. Classical Triangular Pediment Frontispiece
    const pedimentShape = new THREE.Shape();
    pedimentShape.moveTo(-w * 0.42, 0);
    pedimentShape.lineTo(0, 3.6);
    pedimentShape.lineTo(w * 0.42, 0);
    pedimentShape.closePath();

    const pedimentGeo = new THREE.ExtrudeGeometry(pedimentShape, { depth: 1.2, bevelEnabled: false });
    const pediment = new THREE.Mesh(pedimentGeo, colMat);
    pediment.position.set(0, 0.8 + h1 + h2, d * 0.5 - 0.8);
    group.add(pediment);

    // Bronze Heraldic Seal Medallion in center of pediment
    const crest = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 0.25, 20),
      new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.8, roughness: 0.3 })
    );
    crest.rotateX(Math.PI / 2);
    crest.position.set(0, 0.8 + h1 + h2 + 1.2, d * 0.5 + 0.5);
    group.add(crest);

    // 5. Main Mansard / Hip Roof
    const roofH = 4.0;
    const roofGeo = new THREE.ConeGeometry(Math.max(w, d) * 0.82, roofH, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofGeo, slateRoofMat);
    roof.position.set(0, 0.8 + h1 + h2 + roofH * 0.5, 0);
    group.add(roof);

    // 6. Octagonal Maritime Harbour Clock Tower Cupola
    const towerBase = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 2.2, 4.8),
      colMat
    );
    towerBase.position.set(0, 0.8 + h1 + h2 + roofH + 1.1, 0);
    group.add(towerBase);

    // Clock faces on 4 sides
    const clockMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8 });
    const clockOffsets = [
      { x: 0, z: 2.45, rotY: 0 },
      { x: 0, z: -2.45, rotY: Math.PI },
      { x: 2.45, z: 0, rotY: Math.PI / 2 },
      { x: -2.45, z: 0, rotY: -Math.PI / 2 },
    ];
    for (const co of clockOffsets) {
      const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16), clockMat);
      clockFace.rotation.y = co.rotY;
      clockFace.position.set(co.x, 0.8 + h1 + h2 + roofH + 1.1, co.z);

      const clockRim = new THREE.Mesh(new THREE.RingGeometry(0.85, 0.95, 16), rimMat);
      clockRim.rotation.y = co.rotY;
      clockRim.position.copy(clockFace.position);
      clockRim.position.y += 0.001;

      group.add(clockFace, clockRim);
    }

    // Octagonal Open Bell Belfry
    const belfryGeo = new THREE.CylinderGeometry(2.2, 2.4, 2.8, 8);
    const belfry = new THREE.Mesh(belfryGeo, colMat);
    belfry.position.set(0, 0.8 + h1 + h2 + roofH + 3.6, 0);
    group.add(belfry);

    // Verdigris Copper Cupola Dome Roof
    const copperMat = new THREE.MeshStandardMaterial({
      color: 0x34d399, // oxidized verdigris maritime copper
      roughness: 0.45,
      metalness: 0.4,
    });
    const cupola = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 3.2, 8),
      copperMat
    );
    cupola.position.set(0, 0.8 + h1 + h2 + roofH + 6.6, 0);
    group.add(cupola);

    // Weathervane Finial
    const weathervane = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 })
    );
    weathervane.position.set(0, 0.8 + h1 + h2 + roofH + 8.8, 0);
    group.add(weathervane);

    return group;
  }
}

