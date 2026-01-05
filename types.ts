export interface Palette {
  [key: number]: string;
}

export interface PortalConfig {
  targetSeed: string;
  targetX: number;
  targetY: number;
}

export interface PixelArtMatrix {
  width: number;
  height: number;
  palette: Palette; // Map index to hex color
  data: number[]; // Flattened array of indices
  collision?: boolean; // New: Solid object
  portal?: PortalConfig; // New: Teleportation config
}

export interface CustomSprite extends PixelArtMatrix {
  id: string;
  name: string;
  createdAt: number;
}

export enum TileType {
  DEEP_WATER = 'DEEP_WATER',
  WATER = 'WATER',
  SAND = 'SAND',
  GRASS = 'GRASS',
  FOREST = 'FOREST',
  DIRT = 'DIRT',
  STONE = 'STONE',
  MOUNTAIN = 'MOUNTAIN',
  SNOW = 'SNOW',
}

export enum ObjectType {
  NONE = 'NONE',
  TREE_OAK = 'TREE_OAK',
  ROCK_SMALL = 'ROCK_SMALL',
  FLOWER_RED = 'FLOWER_RED',
  FLOWER_BLUE = 'FLOWER_BLUE',
  HOUSE_SMALL = 'HOUSE_SMALL',
}

export enum Direction {
  DOWN = 'DOWN',
  UP = 'UP',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

export interface WorldTile {
  x: number;
  y: number;
  terrain: TileType;
  biome: string; // Added biome name
  object: ObjectType | null;
  customSprite?: CustomSprite; 
  variant: number; 
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface InventoryItem {
  id: string;
  count: number;
}

export interface ExplorationBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface GameSaveState {
  player: {
    x: number;
    y: number;
    direction: Direction;
  };
  stats: {
    totalDistance: number;
    bounds: ExplorationBounds; // Track visited area
  };
  seed: string;
  mapObjects: [string, CustomSprite][]; 
  inventory: (InventoryItem | null)[]; // Array of 36 slots
  lastSavedAt: number;
}
