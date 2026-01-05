import React, { useRef, useEffect, useState } from 'react';
import { WorldGenerator } from '../services/worldEngine';
import { StorageService } from '../services/storage';
import CommandBar from './CommandBar';
import InventoryModal from './InventoryModal';
import { OBJECT_ART, TERRAIN_ART, PLAYER_SPRITES, TERRAIN_RESOURCES } from '../constants';
import { ObjectType, PixelArtMatrix, TileType, Direction, CustomSprite, InventoryItem, ExplorationBounds } from '../types';

interface WorldRendererProps {
  seed: string;
  initialPos?: { x: number, y: number } | null; // For portal teleportation override
  placingSprite: CustomSprite | null;
  onPlaceComplete: () => void;
  onTeleport: (seed: string, x: number, y: number) => void;
}

// Helper to pre-render pixel art
const preRenderTile = (art: PixelArtMatrix): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = art.width;
  canvas.height = art.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, art.width, art.height);
  for (let i = 0; i < art.data.length; i++) {
    const colorIndex = art.data[i];
    if (colorIndex !== 0) { 
      const color = art.palette[colorIndex];
      const x = i % art.width;
      const y = Math.floor(i / art.width);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
};

const TILE_SIZE = 16;
const SCALE = 3;
const FINAL_TILE_SIZE = TILE_SIZE * SCALE;
const INVENTORY_SIZE = 36;
const MAX_STACK = 32;

const WorldRenderer: React.FC<WorldRendererProps> = ({ seed, initialPos, placingSprite, onPlaceComplete, onTeleport }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State
  const [world, setWorld] = useState<WorldGenerator>(new WorldGenerator(seed));
  // Inventory State (Array of 36 slots)
  const [inventory, setInventory] = useState<(InventoryItem | null)[]>(new Array(INVENTORY_SIZE).fill(null));
  const [showInventory, setShowInventory] = useState(false);
  
  // UI State
  const [uiStats, setUiStats] = useState({ 
      x: 0, y: 0, dist: 0, spawnRadius: 0, biome: 'Unknown', exploredArea: 0 
  });
  const [nearbyResources, setNearbyResources] = useState<string[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  
  // Cache
  const terrainCache = useRef<Record<string, HTMLCanvasElement>>({});
  const objectCache = useRef<Record<string, HTMLCanvasElement>>({});
  const playerCache = useRef<Record<string, HTMLCanvasElement>>({});
  const customSpriteCache = useRef<Map<string, HTMLCanvasElement>>(new Map());
  
  // Inputs & Refs
  const keysPressed = useRef<Record<string, boolean>>({});
  const posRef = useRef({ x: 0, y: 0 }); 
  const totalDistanceRef = useRef(0);
  const explorationBoundsRef = useRef<ExplorationBounds>({ minX: 0, maxX: 0, minY: 0, maxY: 0 });

  const cursorRef = useRef({ x: 0, y: 0 }); 
  const currentTileRef = useRef<TileType>(TileType.WATER); // Track current tile for resource logic
  
  const directionRef = useRef<Direction>(Direction.DOWN);
  const isMovingRef = useRef<boolean>(false);
  const loadedRef = useRef(false);

  // --- Load Game State ---
  useEffect(() => {
    // If initialPos is provided (via Teleport), it overrides save state
    if (initialPos) {
        posRef.current = { x: initialPos.x, y: initialPos.y };
        setWorld(new WorldGenerator(seed));
        // Reset distance or keep? Usually new world means new exploration, but maybe keep total stats.
        // For now, let's keep totalDistance if same seed, reset if diff? 
        // Actually, let's just use what's passed or reset if new world.
        
        // We still check save state for inventory, but override pos
        const savedState = StorageService.loadGameState();
        if (savedState && savedState.seed === seed) {
             world.deserializePlacedObjects(savedState.mapObjects);
             setInventory(savedState.inventory);
        } else {
             setInventory(new Array(INVENTORY_SIZE).fill(null));
        }
        explorationBoundsRef.current = { minX: initialPos.x, maxX: initialPos.x, minY: initialPos.y, maxY: initialPos.y };
        loadedRef.current = true;
        return;
    }

    const savedState = StorageService.loadGameState();
    
    if (savedState && savedState.seed === seed) {
        posRef.current = { x: savedState.player.x, y: savedState.player.y };
        directionRef.current = savedState.player.direction;
        totalDistanceRef.current = savedState.stats.totalDistance;
        
        // Load exploration bounds or default to current pos if missing
        if (savedState.stats.bounds) {
            explorationBoundsRef.current = savedState.stats.bounds;
        } else {
            explorationBoundsRef.current = { 
                minX: posRef.current.x, maxX: posRef.current.x, 
                minY: posRef.current.y, maxY: posRef.current.y 
            };
        }

        world.deserializePlacedObjects(savedState.mapObjects);
        if (savedState.inventory) {
            // Ensure inventory size matches constant
            const loadedInv = savedState.inventory;
            if (loadedInv.length < INVENTORY_SIZE) {
                const diff = INVENTORY_SIZE - loadedInv.length;
                setInventory([...loadedInv, ...new Array(diff).fill(null)]);
            } else {
                setInventory(loadedInv);
            }
        }
        console.log("Game state loaded.");
    } else {
        posRef.current = { x: 0, y: 0 };
        totalDistanceRef.current = 0;
        explorationBoundsRef.current = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        setInventory(new Array(INVENTORY_SIZE).fill(null));
    }
    loadedRef.current = true;
  }, [seed, initialPos, world]);

  // --- Auto-Save ---
  useEffect(() => {
    const saveInterval = setInterval(() => {
        if (!loadedRef.current) return;
        StorageService.saveGameState({
            player: {
                x: posRef.current.x,
                y: posRef.current.y,
                direction: directionRef.current
            },
            stats: { 
                totalDistance: totalDistanceRef.current,
                bounds: explorationBoundsRef.current
            },
            seed: seed,
            mapObjects: world.serializePlacedObjects(),
            inventory: inventory, // Save inventory
            lastSavedAt: Date.now()
        });
    }, 2000);
    return () => clearInterval(saveInterval);
  }, [seed, world, inventory]);

  // --- Stats & Resource Updater ---
  useEffect(() => {
    const uiInterval = setInterval(() => {
        const x = Math.round(posRef.current.x);
        const y = Math.round(posRef.current.y);
        
        // Get tile data specifically for UI
        const tile = world.getTile(x, y);
        currentTileRef.current = tile.terrain;

        // Calculate Area
        const width = explorationBoundsRef.current.maxX - explorationBoundsRef.current.minX;
        const height = explorationBoundsRef.current.maxY - explorationBoundsRef.current.minY;
        const area = Math.round(width * height);
        
        // Calculate Spawn Radius
        const spawnRadius = Math.round(Math.hypot(posRef.current.x, posRef.current.y));

        setUiStats({
            x, y,
            dist: Math.round(totalDistanceRef.current),
            spawnRadius,
            biome: tile.biome,
            exploredArea: area
        });

        // Determine Resources
        const resData = TERRAIN_RESOURCES[tile.terrain];
        if (resData) {
            const allRes = [
                ...resData.animais,
                ...resData.minerais,
                ...resData.vegetacao,
                ...resData.pedras_raras
            ];
            setNearbyResources(allRes.slice(0, 5)); // Show top 5
        } else {
            setNearbyResources([]);
        }

    }, 500);
    return () => clearInterval(uiInterval);
  }, [world]);
  
  // --- Inventory Actions ---
  const handleDropItem = (index: number) => {
      setInventory(prev => {
          const newInv = [...prev];
          const item = newInv[index];
          if (item) {
              newInv[index] = null;
              showFeedback(`Dropped ${item.id}`);
          }
          return newInv;
      });
  };

  const handleMoveItem = (fromIndex: number, toIndex: number) => {
      setInventory(prev => {
          const newInv = [...prev];
          const source = newInv[fromIndex];
          const target = newInv[toIndex];

          if (!source) return prev;
          if (fromIndex === toIndex) return prev;

          // Target empty? Move.
          if (!target) {
              newInv[toIndex] = source;
              newInv[fromIndex] = null;
              return newInv;
          }

          // Same Item? Stack.
          if (source.id === target.id) {
              const total = source.count + target.count;
              if (total <= MAX_STACK) {
                  newInv[toIndex] = { ...target, count: total };
                  newInv[fromIndex] = null;
              } else {
                  newInv[toIndex] = { ...target, count: MAX_STACK };
                  newInv[fromIndex] = { ...source, count: total - MAX_STACK };
              }
              return newInv;
          }

          // Different Item? Swap.
          newInv[toIndex] = source;
          newInv[fromIndex] = target;

          return newInv;
      });
  };

  // --- Gathering Logic ---
  const handleGather = () => {
      const terrain = currentTileRef.current;
      const resData = TERRAIN_RESOURCES[terrain];
      
      if (!resData) {
          showFeedback("Nothing to gather here.");
          return;
      }

      const possibleItems = [
          ...resData.minerais,
          ...resData.vegetacao,
          ...(Math.random() > 0.8 ? resData.animais : []), 
          ...(Math.random() > 0.95 ? resData.pedras_raras : []) 
      ];

      if (possibleItems.length === 0) {
          showFeedback("Empty terrain.");
          return;
      }

      const foundItemName = possibleItems[Math.floor(Math.random() * possibleItems.length)];
      
      setInventory(prev => {
          const newInv = [...prev];
          const existingIdx = newInv.findIndex(slot => slot && slot.id === foundItemName && slot.count < MAX_STACK);
          
          if (existingIdx >= 0) {
              const item = newInv[existingIdx]!;
              newInv[existingIdx] = { ...item, count: item.count + 1 };
              showFeedback(`+1 ${foundItemName}`);
              return newInv;
          }

          const emptyIdx = newInv.findIndex(slot => slot === null);
          if (emptyIdx >= 0) {
              newInv[emptyIdx] = { id: foundItemName, count: 1 };
              showFeedback(`+1 ${foundItemName}`);
              return newInv;
          }

          showFeedback("Inventory Full!");
          return prev;
      });
  };

  const showFeedback = (msg: string) => {
      setFeedbackMsg(msg);
      setTimeout(() => setFeedbackMsg(null), 2000);
  };

  // --- Placement & Asset Pre-loading logic ---
  useEffect(() => {
    if (placingSprite) {
        cursorRef.current = { x: Math.round(posRef.current.x), y: Math.round(posRef.current.y) };
        if (!customSpriteCache.current.has(placingSprite.id)) {
            customSpriteCache.current.set(placingSprite.id, preRenderTile(placingSprite));
        }
    }
  }, [placingSprite]);

  useEffect(() => {
    setWorld(new WorldGenerator(seed));
    customSpriteCache.current.clear();
  }, [seed]);

  useEffect(() => {
    Object.entries(TERRAIN_ART).forEach(([key, art]) => { terrainCache.current[key] = preRenderTile(art); });
    Object.entries(OBJECT_ART).forEach(([key, art]) => { objectCache.current[key] = preRenderTile(art); });
    Object.entries(PLAYER_SPRITES).forEach(([key, art]) => { playerCache.current[key] = preRenderTile(art as PixelArtMatrix); });
  }, []);

  // --- Input Handling ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
        keysPressed.current[e.key] = true; 
        
        if (placingSprite) {
            if (e.key === 'Enter') {
                world.placeObject(cursorRef.current.x, cursorRef.current.y, placingSprite);
                StorageService.saveGameState({
                    player: { x: posRef.current.x, y: posRef.current.y, direction: directionRef.current },
                    stats: { totalDistance: totalDistanceRef.current, bounds: explorationBoundsRef.current },
                    seed: seed,
                    mapObjects: world.serializePlacedObjects(),
                    inventory: inventory,
                    lastSavedAt: Date.now()
                });
                onPlaceComplete();
            }
            if (e.key === 'Escape') onPlaceComplete(); 
        } else {
             if (e.key.toLowerCase() === 'e') {
                 handleGather();
             }
             if (e.key.toLowerCase() === 'i') {
                 setShowInventory(prev => !prev);
             }
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [placingSprite, world, onPlaceComplete, seed, inventory]); 

  // --- Game Loop ---
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) ctx.imageSmoothingEnabled = false;

    let lastMoveTime = 0;
    const moveDelay = 100;

    const loop = (timestamp: number) => {
      if (!canvas || !ctx) return;

      if (placingSprite) {
          // Cursor Movement
          if (timestamp - lastMoveTime > moveDelay) {
              if (keysPressed.current['ArrowUp'] || keysPressed.current['w']) { cursorRef.current.y -= 1; lastMoveTime = timestamp; }
              if (keysPressed.current['ArrowDown'] || keysPressed.current['s']) { cursorRef.current.y += 1; lastMoveTime = timestamp; }
              if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) { cursorRef.current.x -= 1; lastMoveTime = timestamp; }
              if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) { cursorRef.current.x += 1; lastMoveTime = timestamp; }
          }
          isMovingRef.current = false; 
      } else {
          // Player Movement
          if (!showInventory) {
              const speed = 0.15; 
              let dx = 0;
              let dy = 0;
              if (keysPressed.current['ArrowUp'] || keysPressed.current['w']) dy -= speed;
              if (keysPressed.current['ArrowDown'] || keysPressed.current['s']) dy += speed;
              if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) dx -= speed;
              if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) dx += speed;

              // --- Collision & Portal Logic ---
              if (dx !== 0 || dy !== 0) {
                  // Predict next position
                  const nextX = posRef.current.x + dx;
                  const nextY = posRef.current.y + dy;
                  
                  // Check the tile we are moving INTO (Center point of player)
                  const targetTileX = Math.round(nextX);
                  const targetTileY = Math.round(nextY);
                  
                  const targetTile = world.getTile(targetTileX, targetTileY);
                  let hasCollision = false;

                  // 1. Check Standard Object Collision
                  if (targetTile.object && targetTile.object !== ObjectType.NONE) {
                       const objDef = OBJECT_ART[targetTile.object];
                       if (objDef && objDef.collision) {
                           hasCollision = true;
                       }
                  }

                  // 2. Check Custom Sprite Collision & Portal
                  if (targetTile.customSprite) {
                      if (targetTile.customSprite.collision) {
                          hasCollision = true;
                      }
                      
                      // Check for Portal Trigger
                      if (targetTile.customSprite.portal) {
                          // Simple "bump" trigger or "walk on" trigger
                          // If collision is true, we bump it. If false, we walk on it.
                          // Let's trigger teleport.
                          const p = targetTile.customSprite.portal;
                          // Debounce or just trigger?
                          // We should probably stop movement and trigger
                          onTeleport(p.targetSeed, p.targetX, p.targetY);
                          return; // Stop loop for this frame to prevent jitter
                      }
                  }

                  if (!hasCollision) {
                      posRef.current.x = nextX;
                      posRef.current.y = nextY;
                  } else {
                      // Simple collision response: slide? Or Stop.
                      // Stop for now.
                      // Try sliding? (Move X only, then Y only)
                      // Keep it simple: Stop.
                  }
              }

              // Update Exploration Bounds
              const cx = posRef.current.x;
              const cy = posRef.current.y;
              if (cx < explorationBoundsRef.current.minX) explorationBoundsRef.current.minX = cx;
              if (cx > explorationBoundsRef.current.maxX) explorationBoundsRef.current.maxX = cx;
              if (cy < explorationBoundsRef.current.minY) explorationBoundsRef.current.minY = cy;
              if (cy > explorationBoundsRef.current.maxY) explorationBoundsRef.current.maxY = cy;

              if (Math.hypot(dx, dy) > 0 && !isMovingRef.current) {
                  // Just started moving
              }
              if ((dx !== 0 || dy !== 0)) {
                  totalDistanceRef.current += Math.hypot(dx, dy);
              }
              isMovingRef.current = dx !== 0 || dy !== 0;

              if (dy < 0) directionRef.current = Direction.UP;
              else if (dy > 0) directionRef.current = Direction.DOWN;
              else if (dx < 0) directionRef.current = Direction.LEFT;
              else if (dx > 0) directionRef.current = Direction.RIGHT;
          } else {
              isMovingRef.current = false;
          }
      }

      // Render
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const visibleTilesX = canvas.width / FINAL_TILE_SIZE;
      const visibleTilesY = canvas.height / FINAL_TILE_SIZE;
      const viewportLeftX = posRef.current.x - (visibleTilesX / 2);
      const viewportTopY = posRef.current.y - (visibleTilesY / 2);
      const startTileX = Math.floor(viewportLeftX);
      const startTileY = Math.floor(viewportTopY);
      const offsetX = (viewportLeftX - startTileX) * FINAL_TILE_SIZE;
      const offsetY = (viewportTopY - startTileY) * FINAL_TILE_SIZE;
      const cols = Math.ceil(visibleTilesX) + 2;
      const rows = Math.ceil(visibleTilesY) + 2;

      for (let y = -1; y < rows; y++) {
        for (let x = -1; x < cols; x++) {
          const worldX = startTileX + x;
          const worldY = startTileY + y;
          const tile = world.getTile(worldX, worldY);
          
          const screenX = Math.floor((x * FINAL_TILE_SIZE) - offsetX);
          const screenY = Math.floor((y * FINAL_TILE_SIZE) - offsetY);

          // Terrain
          const terrainImg = terrainCache.current[tile.terrain];
          if (terrainImg) ctx.drawImage(terrainImg, screenX, screenY, FINAL_TILE_SIZE, FINAL_TILE_SIZE);

          // Objects
          if (tile.customSprite) {
             let cImg = customSpriteCache.current.get(tile.customSprite.id);
             if (!cImg) {
                 cImg = preRenderTile(tile.customSprite);
                 customSpriteCache.current.set(tile.customSprite.id, cImg);
             }
             if (cImg) {
                const cWidth = cImg.width * SCALE;
                const cHeight = cImg.height * SCALE;
                
                // Visual effect for portals
                if (tile.customSprite.portal) {
                     ctx.shadowColor = '#d946ef'; // Purple glow
                     ctx.shadowBlur = 10 + Math.sin(timestamp / 200) * 5;
                }

                ctx.drawImage(cImg, screenX + (FINAL_TILE_SIZE/2) - (cWidth/2), screenY + FINAL_TILE_SIZE - cHeight, cWidth, cHeight);
                
                ctx.shadowBlur = 0; // Reset
             }
          } 
          else if (tile.object && tile.object !== ObjectType.NONE) {
            const objImg = objectCache.current[tile.object];
            if (objImg) {
              const objWidth = objImg.width * SCALE;
              const objHeight = objImg.height * SCALE;
              ctx.drawImage(objImg, screenX + (FINAL_TILE_SIZE/2) - (objWidth/2), screenY + FINAL_TILE_SIZE - objHeight, objWidth, objHeight);
            }
          }
        }
      }

      // Cursor
      if (placingSprite) {
         const cursorScreenX = ((cursorRef.current.x - startTileX) * FINAL_TILE_SIZE) - offsetX;
         const cursorScreenY = ((cursorRef.current.y - startTileY) * FINAL_TILE_SIZE) - offsetY;
         if (cursorScreenX > -FINAL_TILE_SIZE && cursorScreenX < canvas.width && cursorScreenY > -FINAL_TILE_SIZE && cursorScreenY < canvas.height) {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(cursorScreenX, cursorScreenY, FINAL_TILE_SIZE, FINAL_TILE_SIZE);
            const ghostImg = customSpriteCache.current.get(placingSprite.id);
            if (ghostImg) {
                ctx.save();
                ctx.globalAlpha = 0.5;
                const gWidth = ghostImg.width * SCALE;
                const gHeight = ghostImg.height * SCALE;
                ctx.drawImage(ghostImg, cursorScreenX + (FINAL_TILE_SIZE/2) - (gWidth/2), cursorScreenY + FINAL_TILE_SIZE - gHeight, gWidth, gHeight);
                ctx.restore();
            }
         }
      }

      // Player
      const playerScreenX = (canvas.width / 2) - (FINAL_TILE_SIZE / 2);
      const playerScreenY = (canvas.height / 2) - (FINAL_TILE_SIZE / 2);
      const frameSpeed = 150; 
      const frameIndex = isMovingRef.current ? Math.floor(Date.now() / frameSpeed) % 2 : 0;
      let spriteKey = '';
      let flip = false;
      switch(directionRef.current) {
        case Direction.UP: spriteKey = `UP_${frameIndex}`; break;
        case Direction.DOWN: spriteKey = `DOWN_${frameIndex}`; break;
        case Direction.RIGHT: spriteKey = `SIDE_${frameIndex}`; break;
        case Direction.LEFT: spriteKey = `SIDE_${frameIndex}`; flip = true; break;
      }
      const playerImg = playerCache.current[spriteKey];
      if (playerImg) {
        if (flip) {
          ctx.save();
          ctx.translate(playerScreenX + FINAL_TILE_SIZE/2, playerScreenY + FINAL_TILE_SIZE/2);
          ctx.scale(-1, 1);
          ctx.drawImage(playerImg, -FINAL_TILE_SIZE/2, -FINAL_TILE_SIZE/2, FINAL_TILE_SIZE, FINAL_TILE_SIZE);
          ctx.restore();
        } else {
          ctx.drawImage(playerImg, playerScreenX, playerScreenY, FINAL_TILE_SIZE, FINAL_TILE_SIZE);
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [world, placingSprite, showInventory, onTeleport]); 

  // Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
    <canvas 
      ref={canvasRef} 
      className="block w-full h-full bg-[#111]"
    />
    
    {/* Feedback Toast */}
    {feedbackMsg && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-20 text-yellow-400 font-bold text-sm bg-black/80 px-4 py-2 rounded animate-bounce z-50">
            {feedbackMsg}
        </div>
    )}
    
    {/* HUD: Stats & Resources */}
    <div className="absolute top-4 right-4 z-10 max-w-[200px] w-full flex flex-col gap-2">
        <div className="bg-slate-900/90 backdrop-blur-sm border-2 border-slate-600 rounded-lg p-3 shadow-xl">
            <h3 className="text-yellow-400 text-[10px] font-bold uppercase mb-2 border-b border-slate-700 pb-1">Explorer Data</h3>
            <div className="space-y-1 font-mono text-[10px]">
                <div className="flex justify-between text-slate-300">
                    <span>POS:</span><span className="text-green-400">{uiStats.x}, {uiStats.y}</span>
                </div>
                 <div className="flex justify-between text-slate-300">
                    <span>BIOME:</span><span className="text-orange-400">{uiStats.biome}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                    <span>SPAWN R:</span><span className="text-purple-400">{uiStats.spawnRadius}m</span>
                </div>
                <div className="flex justify-between text-slate-300">
                    <span>TRAVEL:</span><span className="text-blue-400">{uiStats.dist}m</span>
                </div>
                <div className="flex justify-between text-slate-300">
                    <span>AREA:</span><span className="text-yellow-400">{uiStats.exploredArea}m²</span>
                </div>
            </div>
        </div>
        
        {/* Available Resources List */}
        <div className="bg-slate-900/90 backdrop-blur-sm border-2 border-slate-600 rounded-lg p-3 shadow-xl">
             <h3 className="text-blue-300 text-[10px] font-bold uppercase mb-2 border-b border-slate-700 pb-1">Available Here</h3>
             {nearbyResources.length > 0 ? (
                 <ul className="text-[9px] text-slate-400 space-y-1">
                     {nearbyResources.map((res, i) => (
                         <li key={i} className="flex items-center gap-1">
                             <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
                             {res}
                         </li>
                     ))}
                 </ul>
             ) : (
                 <p className="text-[9px] text-slate-600 italic">No resources nearby</p>
             )}
        </div>
    </div>
    
    {/* Inventory Modal */}
    {showInventory && (
        <InventoryModal 
            inventory={inventory}
            onClose={() => setShowInventory(false)}
            onDrop={handleDropItem}
            onMove={handleMoveItem}
        />
    )}

    {/* Inventory Bar */}
    <CommandBar 
        isPlacing={!!placingSprite}
        onCancelPlacement={onPlaceComplete}
        inventory={inventory}
        onGather={handleGather}
        onOpenInventory={() => setShowInventory(true)}
    />
    
    <div className="absolute bottom-4 right-4 bg-black/70 text-white p-2 rounded font-mono text-xs pointer-events-none border border-white/20">
       WASD to Move • 'E' Gather • 'I' Inventory
    </div>
    </>
  );
};

export default WorldRenderer;