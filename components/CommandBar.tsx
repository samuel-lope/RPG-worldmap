import React from 'react';
import { InventoryItem } from '../types';

interface CommandBarProps {
  isPlacing: boolean;
  onCancelPlacement: () => void;
  inventory: (InventoryItem | null)[];
  onGather: () => void;
  onOpenInventory: () => void;
}

const CommandBar: React.FC<CommandBarProps> = ({ isPlacing, onCancelPlacement, inventory, onGather, onOpenInventory }) => {
  
  if (isPlacing) {
     return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20">
            <div className="bg-slate-900/90 border-2 border-yellow-500 rounded p-4 shadow-lg text-center animate-pulse">
                <p className="text-yellow-400 font-bold text-xs uppercase mb-2">PLACEMENT MODE</p>
                <p className="text-white text-[10px] font-mono">Use ARROWS to move cursor. ENTER to place. ESC to cancel.</p>
                <button 
                    onClick={onCancelPlacement}
                    className="mt-2 text-red-400 text-[10px] hover:text-red-300 underline"
                >
                    Cancel
                </button>
            </div>
        </div>
     )
  }

  // Helper to generate a color hash from string for the item icon
  const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + "00000".substring(0, 6 - c.length) + c;
  }

  // Only show the first 6 items in the hotbar
  const hotbarSlots = inventory.slice(0, 6);

  return (
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20 flex gap-4 items-end">
        
        {/* Inventory Hotbar Slots */}
        <div className="bg-slate-900/90 backdrop-blur-sm border-2 border-slate-600 rounded-lg p-2 shadow-2xl flex gap-1 flex-1 justify-center relative">
            <div className="absolute -top-3 left-2 text-[8px] bg-slate-700 px-1 rounded text-slate-300 uppercase font-bold">Hotbar</div>
            
            {hotbarSlots.map((slot, index) => (
                <div 
                    key={index}
                    onClick={onOpenInventory}
                    className="w-12 h-12 bg-black/50 border border-slate-700 rounded relative group hover:border-white/50 cursor-pointer transition-colors"
                    title="Click to open full inventory"
                >
                    {slot && (
                        <>
                            <div 
                                className="absolute inset-2 rounded-sm border border-white/20"
                                style={{ backgroundColor: stringToColor(slot.id) }}
                            >
                                <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-white drop-shadow-md text-center break-all leading-tight">
                                    {slot.id.substring(0, 2)}
                                </div>
                            </div>
                            <span className="absolute bottom-0 right-0 text-[10px] font-mono text-white bg-black/80 px-1 rounded-tl">
                                {slot.count}
                            </span>
                        </>
                    )}
                    {!slot && <div className="absolute inset-0 flex items-center justify-center text-slate-700 text-[8px]">{index + 1}</div>}
                </div>
            ))}

            <button 
                onClick={onOpenInventory}
                className="ml-2 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-[10px] text-slate-400"
            >
                ALL<br/>:::
            </button>
        </div>

        {/* Gather Button */}
        <button 
            onClick={onGather}
            className="h-16 w-16 bg-blue-700 hover:bg-blue-600 border-b-4 border-blue-900 active:border-b-0 active:translate-y-1 rounded-full shadow-lg flex flex-col items-center justify-center transition-all group"
        >
            <div className="text-2xl mb-[-4px]">⛏️</div>
            <span className="text-[8px] font-bold uppercase text-white">Gather</span>
        </button>

      </div>
  );
};

export default CommandBar;
