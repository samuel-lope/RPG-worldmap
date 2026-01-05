import React, { useState, useRef, useEffect } from 'react';
import { CustomSprite } from '../types';
import { EDITOR_PALETTE } from '../constants';
import { StorageService } from '../services/storage.ts';

interface PixelEditorProps {
  onClose: () => void;
}

const PixelEditor: React.FC<PixelEditorProps> = ({ onClose }) => {
  const [sprites, setSprites] = useState<CustomSprite[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [name, setName] = useState('My Sprite');
  const [size, setSize] = useState<16 | 32>(16);
  const [gridData, setGridData] = useState<number[]>(new Array(16 * 16).fill(0));
  const [selectedColor, setSelectedColor] = useState<number>(1);
  const [tool, setTool] = useState<'pencil' | 'eraser'>('pencil');
  
  // Object Properties
  const [collision, setCollision] = useState(false);
  const [isPortal, setIsPortal] = useState(false);
  const [portalSeed, setPortalSeed] = useState('');
  const [portalX, setPortalX] = useState(0);
  const [portalY, setPortalY] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  // Load list on mount
  useEffect(() => {
    setSprites(StorageService.getSprites());
  }, []);

  // Update grid size when size selection changes, preserving data if possible or clearing
  useEffect(() => {
    if (!currentId) {
        // Only reset if we are creating new, otherwise load logic handles it
        setGridData(new Array(size * size).fill(0));
    }
  }, [size, currentId]);

  // Render the grid to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Visual scale for the editor
    const scale = 16; 
    canvas.width = size * scale;
    canvas.height = size * scale;

    // Draw Checkerboard Background
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            ctx.fillStyle = (i + j) % 2 === 0 ? '#1e1e1e' : '#252525';
            ctx.fillRect(i * scale, j * scale, scale, scale);
        }
    }

    // Draw Pixels
    for (let i = 0; i < gridData.length; i++) {
      const colorIndex = gridData[i];
      if (colorIndex !== 0) {
        const x = (i % size) * scale;
        const y = Math.floor(i / size) * scale;
        ctx.fillStyle = EDITOR_PALETTE[colorIndex];
        ctx.fillRect(x, y, scale, scale);
      }
    }

    // Draw Grid Lines
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i <= size; i++) {
      ctx.moveTo(i * scale, 0);
      ctx.lineTo(i * scale, size * scale);
      ctx.moveTo(0, i * scale);
      ctx.lineTo(size * scale, i * scale);
    }
    ctx.stroke();

  }, [gridData, size]);

  const handleCanvasInteraction = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const scale = canvas.width / size; // Should be 16
    const gridX = Math.floor(x / scale);
    const gridY = Math.floor(y / scale);

    if (gridX >= 0 && gridX < size && gridY >= 0 && gridY < size) {
      const index = gridY * size + gridX;
      const newData = [...gridData];
      newData[index] = tool === 'eraser' ? 0 : selectedColor;
      setGridData(newData);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDrawing.current = true;
    handleCanvasInteraction(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDrawing.current) {
      handleCanvasInteraction(e);
    }
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const handleSave = () => {
    const newSprite: CustomSprite = {
      id: currentId || crypto.randomUUID(),
      name,
      width: size,
      height: size,
      palette: EDITOR_PALETTE,
      data: gridData,
      createdAt: Date.now(),
      collision,
      portal: isPortal ? { targetSeed: portalSeed, targetX: portalX, targetY: portalY } : undefined
    };
    
    StorageService.saveSprite(newSprite);
    setSprites(StorageService.getSprites());
    setCurrentId(newSprite.id);
    alert('Sprite Saved!');
  };

  const loadSprite = (sprite: CustomSprite) => {
    setCurrentId(sprite.id);
    setName(sprite.name);
    setSize((sprite.width === 16 || sprite.width === 32) ? sprite.width : 16);
    setGridData(sprite.data);
    setCollision(!!sprite.collision);
    if (sprite.portal) {
        setIsPortal(true);
        setPortalSeed(sprite.portal.targetSeed);
        setPortalX(sprite.portal.targetX);
        setPortalY(sprite.portal.targetY);
    } else {
        setIsPortal(false);
        setPortalSeed('');
        setPortalX(0);
        setPortalY(0);
    }
  };

  const createNew = () => {
    setCurrentId(null);
    setName('New Sprite');
    setGridData(new Array(size * size).fill(0));
    setCollision(false);
    setIsPortal(false);
    setPortalSeed('');
    setPortalX(0);
    setPortalY(0);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm('Are you sure?')) {
        StorageService.deleteSprite(id);
        setSprites(StorageService.getSprites());
        if(currentId === id) createNew();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 backdrop-blur-md">
      <div className="bg-slate-900 border-2 border-slate-600 rounded-lg flex flex-row w-full max-w-5xl h-[90vh] shadow-2xl overflow-hidden">
        
        {/* Sidebar: Library */}
        <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-white text-xs font-bold uppercase tracking-wider mb-2">Library</h2>
            <button 
                onClick={createNew}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[10px] py-2 rounded font-bold uppercase transition-colors"
            >
                + New Sprite
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {sprites.map(s => (
                <div 
                    key={s.id} 
                    onClick={() => loadSprite(s)}
                    className={`p-2 rounded cursor-pointer flex justify-between items-center group ${currentId === s.id ? 'bg-slate-600' : 'hover:bg-slate-700'}`}
                >
                    <span className="text-xs text-slate-300 truncate">{s.name}</span>
                    <button 
                        onClick={(e) => handleDelete(s.id, e)}
                        className="text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 font-bold px-2"
                    >
                        ×
                    </button>
                </div>
            ))}
            {sprites.length === 0 && <p className="text-[10px] text-slate-500 text-center mt-4">No saved sprites</p>}
          </div>
        </div>

        {/* Main Area: Canvas */}
        <div className="flex-1 flex flex-col items-center justify-center bg-[#111] relative p-4">
            <div className="mb-4 flex items-center gap-4">
                <input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-transparent border-b border-slate-600 text-white text-center font-mono focus:outline-none focus:border-blue-500 px-2 py-1"
                />
                <select 
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value) as 16 | 32)}
                    className="bg-slate-800 text-white text-xs border border-slate-600 rounded px-2 py-1"
                >
                    <option value={16}>16x16</option>
                    <option value={32}>32x32</option>
                </select>
            </div>
            
            <div className="border border-slate-700 shadow-xl bg-black/50">
                <canvas 
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className="cursor-crosshair block"
                />
            </div>

            <div className="mt-6 flex gap-4">
                <button 
                    onClick={() => setTool('pencil')}
                    className={`px-4 py-2 rounded text-xs font-bold uppercase ${tool === 'pencil' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                >
                    Pencil
                </button>
                <button 
                    onClick={() => setTool('eraser')}
                    className={`px-4 py-2 rounded text-xs font-bold uppercase ${tool === 'eraser' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                >
                    Eraser
                </button>
                <button 
                    onClick={() => setGridData(new Array(size * size).fill(0))}
                    className="px-4 py-2 rounded text-xs font-bold uppercase bg-slate-700 text-slate-300 hover:bg-slate-600"
                >
                    Clear All
                </button>
            </div>
        </div>

        {/* Right Bar: Palette & Actions */}
        <div className="w-56 bg-slate-800 border-l border-slate-700 flex flex-col overflow-y-auto">
            <div className="p-4 border-b border-slate-700">
                <h3 className="text-white text-[10px] uppercase font-bold mb-2">Palette</h3>
                <div className="grid grid-cols-4 gap-1">
                    {Object.entries(EDITOR_PALETTE).map(([idxStr, color]) => {
                        const idx = Number(idxStr);
                        if(idx === 0) return null; // Skip transparent for picker
                        return (
                            <button
                                key={idx}
                                onClick={() => setSelectedColor(idx)}
                                className={`w-8 h-8 rounded-sm border-2 ${selectedColor === idx ? 'border-white' : 'border-transparent'}`}
                                style={{ backgroundColor: color }}
                                title={`Color ${idx}`}
                            />
                        );
                    })}
                </div>
            </div>

            <div className="p-4 border-b border-slate-700 flex-1">
                <h3 className="text-white text-[10px] uppercase font-bold mb-2">Properties</h3>
                
                {/* Collision Toggle */}
                <div className="mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={collision} 
                            onChange={e => setCollision(e.target.checked)}
                            className="w-4 h-4 rounded bg-slate-700 border-slate-500 text-green-500 focus:ring-0"
                        />
                        <span className="text-xs text-slate-300">Solid Object (Collision)</span>
                    </label>
                </div>

                {/* Portal Toggle */}
                <div className="mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={isPortal} 
                            onChange={e => setIsPortal(e.target.checked)}
                            className="w-4 h-4 rounded bg-slate-700 border-slate-500 text-purple-500 focus:ring-0"
                        />
                        <span className="text-xs text-slate-300">Is Portal (Teleport)</span>
                    </label>
                </div>

                {/* Portal Config */}
                {isPortal && (
                    <div className="bg-slate-900/50 p-2 rounded border border-slate-700 space-y-2">
                        <div>
                            <label className="block text-[9px] text-slate-500 uppercase mb-1">Target Seed</label>
                            <input 
                                type="text"
                                value={portalSeed}
                                onChange={e => setPortalSeed(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 text-white text-xs px-1 py-1 rounded"
                                placeholder="Seed..."
                            />
                        </div>
                        <div className="flex gap-2">
                            <div>
                                <label className="block text-[9px] text-slate-500 uppercase mb-1">Target X</label>
                                <input 
                                    type="number"
                                    value={portalX}
                                    onChange={e => setPortalX(Number(e.target.value))}
                                    className="w-full bg-slate-800 border border-slate-600 text-white text-xs px-1 py-1 rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] text-slate-500 uppercase mb-1">Target Y</label>
                                <input 
                                    type="number"
                                    value={portalY}
                                    onChange={e => setPortalY(Number(e.target.value))}
                                    className="w-full bg-slate-800 border border-slate-600 text-white text-xs px-1 py-1 rounded"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 flex flex-col gap-2">
                <button 
                    onClick={handleSave}
                    className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded font-bold uppercase text-xs"
                >
                    Save Sprite
                </button>
                <button 
                    onClick={onClose}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded font-bold uppercase text-xs"
                >
                    Close
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default PixelEditor;
