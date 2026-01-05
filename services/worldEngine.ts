import { OBJECT_ART, TERRAIN_ART } from '../constants';
import { CustomSprite, ObjectType, TileType, WorldTile } from '../types';

// Simple pseudo-random number generator class
class PRNG {
  private seed: number;

  constructor(seedStr: string) {
    this.seed = this.hashString(seedStr);
  }

  // DJB2 Hash to turn string key into number
  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash >>> 0;
  }

  // Deterministic random based on coordinate and seed
  // Returns 0-1
  public noise(x: number, y: number, layer: number = 0): number {
    let n = Math.sin(x * 12.9898 + y * 78.233 + this.seed + layer * 131.2) * 43758.5453;
    return n - Math.floor(n);
  }

  // A smoother noise function (Value Noise) for terrain blobs
  public smoothNoise(x: number, y: number): number {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    
    const s = (this.noise(floorX, floorY)); 
    const t = (this.noise(floorX + 1, floorY));
    const u = (this.noise(floorX, floorY + 1));
    const v = (this.noise(floorX + 1, floorY + 1));

    const recX = x - floorX;
    const recY = y - floorY;

    const lerp = (a: number, b: number, t: number) => a + t * (b - a);
    const smooth = (t: number) => t * t * (3 - 2 * t);

    return lerp(
      lerp(s, t, smooth(recX)),
      lerp(u, v, smooth(recX)),
      smooth(recY)
    );
  }
}

export class WorldGenerator {
  private prng: PRNG;
  private placedObjects: Map<string, CustomSprite>;

  constructor(seed: string) {
    this.prng = new PRNG(seed);
    this.placedObjects = new Map();
  }

  public placeObject(x: number, y: number, sprite: CustomSprite) {
    this.placedObjects.set(`${x},${y}`, sprite);
  }

  // --- Serialization for Save/Load ---
  public serializePlacedObjects(): [string, CustomSprite][] {
    return Array.from(this.placedObjects.entries());
  }

  public deserializePlacedObjects(entries: [string, CustomSprite][]) {
    this.placedObjects = new Map(entries);
  }
  // -----------------------------------

  public getTile(x: number, y: number): WorldTile {
    // Scales
    const biomeScale = 0.005; // Large scale for biomes
    const terrainScale = 0.05; // Medium scale for local terrain features
    
    // Noise layers
    const biomeNoise = this.prng.smoothNoise(x * biomeScale, y * biomeScale);
    const elevation = this.prng.smoothNoise(x * terrainScale, y * terrainScale);
    
    let biome = 'Unknown';
    let terrain: TileType = TileType.WATER;
    let object: ObjectType | null = null;
    let customSprite: CustomSprite | undefined = undefined;

    // Check for user placed object first
    if (this.placedObjects.has(`${x},${y}`)) {
      customSprite = this.placedObjects.get(`${x},${y}`);
    }

    // --- Biome Determination ---
    // Mapping 0-1 noise to biomes roughly based on assumed "temperature/moisture" combo in one value
    if (biomeNoise < 0.15) biome = 'DESERT';
    else if (biomeNoise < 0.30) biome = 'SAVANNA';
    else if (biomeNoise < 0.45) biome = 'GRASSLAND';
    else if (biomeNoise < 0.65) biome = 'RAINFOREST';
    else if (biomeNoise < 0.85) biome = 'TAIGA';
    else biome = 'TUNDRA';

    // --- Terrain Determination based on Biome + Elevation ---
    // Base Elevations: <0.3 Deep, <0.4 Water, <0.45 Coast, >0.45 Land, >0.8 High
    
    switch (biome) {
        case 'DESERT':
            if (elevation < 0.3) terrain = TileType.WATER;
            else if (elevation < 0.4) terrain = TileType.SAND; // Coast
            else if (elevation < 0.8) terrain = TileType.SAND; // Land
            else terrain = TileType.STONE; // High
            break;

        case 'SAVANNA':
            if (elevation < 0.35) terrain = TileType.WATER;
            else if (elevation < 0.45) terrain = TileType.SAND;
            else terrain = TileType.GRASS;
            break;

        case 'GRASSLAND':
            if (elevation < 0.35) terrain = TileType.WATER;
            else if (elevation < 0.40) terrain = TileType.SAND;
            else if (elevation < 0.8) terrain = TileType.GRASS;
            else terrain = TileType.DIRT;
            break;

        case 'RAINFOREST':
            if (elevation < 0.30) terrain = TileType.DEEP_WATER;
            else if (elevation < 0.40) terrain = TileType.WATER;
            else if (elevation < 0.45) terrain = TileType.SAND;
            else if (elevation < 0.75) terrain = TileType.FOREST; // Dense forest
            else terrain = TileType.GRASS; // Clearings
            break;

        case 'TAIGA':
            if (elevation < 0.35) terrain = TileType.WATER;
            else if (elevation < 0.45) terrain = TileType.DIRT;
            else if (elevation < 0.75) terrain = TileType.FOREST;
            else terrain = TileType.SNOW; // High Taiga
            break;

        case 'TUNDRA':
            if (elevation < 0.35) terrain = TileType.DEEP_WATER; // Icy water
            else if (elevation < 0.45) terrain = TileType.DIRT; // Gravel/Permafrost
            else if (elevation < 0.80) terrain = TileType.SNOW;
            else terrain = TileType.MOUNTAIN;
            break;

        default:
            terrain = TileType.GRASS;
    }

    // --- Procedural Object Placement ---
    if (!customSprite) {
      const objectHash = this.prng.noise(x, y, 1); 

      // Biome-specific object rules
      if (biome === 'RAINFOREST' && terrain === TileType.FOREST) {
         if (objectHash > 0.90) object = ObjectType.TREE_OAK;
         else if (objectHash > 0.85) object = ObjectType.FLOWER_RED;
      }
      else if (biome === 'GRASSLAND' && terrain === TileType.GRASS) {
          if (objectHash > 0.98) object = ObjectType.TREE_OAK;
          else if (objectHash > 0.95) object = ObjectType.HOUSE_SMALL;
          else if (objectHash > 0.90) object = ObjectType.FLOWER_BLUE;
      }
      else if ((biome === 'DESERT' || biome === 'SAVANNA') && terrain === TileType.SAND) {
          if (objectHash > 0.98) object = ObjectType.ROCK_SMALL;
      }
      else if (biome === 'TAIGA' && terrain === TileType.FOREST) {
          if (objectHash > 0.92) object = ObjectType.TREE_OAK; // Should be pine, using oak placeholder
      }
      else if (terrain === TileType.MOUNTAIN || terrain === TileType.STONE) {
          if (objectHash > 0.95) object = ObjectType.ROCK_SMALL;
      }
    }

    return {
      x,
      y,
      terrain,
      biome,
      object,
      customSprite,
      variant: Math.floor(this.prng.noise(x, y, 2) * 4) 
    };
  }
}
