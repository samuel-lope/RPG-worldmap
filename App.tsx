import React, { useState, useEffect } from 'react';
import WorldRenderer from './components/WorldRenderer';
import PixelEditor from './components/PixelEditor';
import { CustomSprite } from './types';
import { StorageService } from './services/storage';

function App() {
  // Default 128-bit style key (32 hex chars)
  const generateRandomKey = () => Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  
  const [seed, setSeed] = useState<string>("8f2a4b9c1d3e5f7a0b2c4d6e8f1a3b5c");
  const [tempSeed, setTempSeed] = useState(seed);
  const [showEditor, setShowEditor] = useState(false);
  const [showSpriteSelector, setShowSpriteSelector] = useState(false);
  const [savedSprites, setSavedSprites] = useState<CustomSprite[]>([]);
  
  // Placement State
  const [placingSprite, setPlacingSprite] = useState<CustomSprite | null>(null);
  
  // Player Spawn Override (for portals)
  const [spawnPos, setSpawnPos] = useState<{x: number, y: number} | null>(null);

  const handleRandomize = () => {
    const newKey = generateRandomKey();
    setSeed(newKey);
    setTempSeed(newKey);
    setSpawnPos(null); // Reset spawn
  };

  const handleApply = () => {
    setSeed(tempSeed);
    setSpawnPos(null); // Reset spawn
  };

  const handleOpenSpriteSelector = () => {
      setSavedSprites(StorageService.getSprites());
      setShowSpriteSelector(true);
  };

  const handleSpriteSelect = (sprite: CustomSprite) => {
      setPlacingSprite(sprite);
      setShowSpriteSelector(false);
  };

  const handleTeleport = (newSeed: string, x: number, y: number) => {
      console.log(`Teleporting to ${newSeed} at ${x},${y}`);
      setSeed(newSeed);
      setTempSeed(newSeed);
      setSpawnPos({ x, y });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white">
      {/* Rendering Layer */}
      <div className="absolute inset-0 z-0">
        <WorldRenderer 
            seed={seed} 
            initialPos={spawnPos}
            placingSprite={placingSprite}
            onPlaceComplete={() => setPlacingSprite(null)}
            onTeleport={handleTeleport}
        />
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <PixelEditor onClose={() => setShowEditor(false)} />
      )}

      {/* Sprite Selector Modal */}
      {showSpriteSelector && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowSpriteSelector(false)}>
            <div className="bg-slate-900 border-2 border-slate-600 rounded-lg w-full max-w-md max-h-[60vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-3 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
                    <h3 className="text-white text-xs font-bold uppercase">Select Sprite to Place</h3>
                    <button onClick={() => setShowSpriteSelector(false)} className="text-slate-400 hover:text-white">×</button>
                </div>
                <div className="overflow-y-auto p-2">
                    {savedSprites.length === 0 ? (
                        <div className="text-center p-8 text-slate-500 text-xs">
                            No sprites found. Use the Sprite Editor to create one!
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2">
                            {savedSprites.map(sprite => (
                                <button 
                                    key={sprite.id}
                                    onClick={() => handleSpriteSelect(sprite)}
                                    className="flex items-center gap-3 p-2 hover:bg-slate-700 rounded text-left group"
                                >
                                    <div className="w-8 h-8 bg-black border border-slate-600 relative flex items-center justify-center text-[8px] text-slate-500">
                                        {sprite.width}
                                    </div>
                                    <div>
                                        <div className="text-green-400 text-xs font-bold group-hover:text-green-300">{sprite.name}</div>
                                        <div className="text-slate-500 text-[10px]">{sprite.width}x{sprite.height}</div>
                                        {sprite.collision && <span className="text-red-400 text-[9px] mr-1">[SOLID]</span>}
                                        {sprite.portal && <span className="text-purple-400 text-[9px] mr-1">[PORTAL]</span>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* UI Overlay - World Info */}
      <div className="absolute top-4 left-4 z-10 max-w-sm w-full">
        <div className="bg-slate-900/90 backdrop-blur-sm border-2 border-slate-600 rounded-lg p-4 shadow-xl shadow-black/50">
          <h1 className="text-xl text-yellow-400 mb-4 tracking-wider" style={{ textShadow: '2px 2px 0 #000' }}>
            GEN-RPG <span className="text-xs text-slate-400">v1.1</span>
          </h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase text-slate-400 mb-1">World Seed (128-bit Key)</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={tempSeed}
                  onChange={(e) => setTempSeed(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 px-2 py-2 text-xs font-mono text-green-400 focus:outline-none focus:border-green-500 rounded"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleApply}
                className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-xs py-2 px-4 rounded border-b-4 border-blue-900 active:border-b-0 active:translate-y-1 transition-all"
              >
                LOAD WORLD
              </button>
              <button 
                onClick={handleRandomize}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white text-xs py-2 px-4 rounded border-b-4 border-red-900 active:border-b-0 active:translate-y-1 transition-all"
              >
                RANDOMIZE
              </button>
            </div>

            <div className="flex gap-2">
                <button 
                    onClick={() => setShowEditor(true)}
                    className="flex-1 bg-purple-700 hover:bg-purple-600 text-white text-xs py-2 px-4 rounded border-b-4 border-purple-900 active:border-b-0 active:translate-y-1 transition-all uppercase font-bold"
                >
                    Sprite Editor
                </button>
                <button 
                    onClick={handleOpenSpriteSelector}
                    className="flex-1 bg-green-700 hover:bg-green-600 text-white text-xs py-2 px-4 rounded border-b-4 border-green-900 active:border-b-0 active:translate-y-1 transition-all uppercase font-bold"
                >
                    + Add Sprite
                </button>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}

export default App;
