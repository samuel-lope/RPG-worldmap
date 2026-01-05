import React, { useState } from 'react';
import { InventoryItem } from '../types';

interface InventoryModalProps {
  inventory: (InventoryItem | null)[];
  onClose: () => void;
  onDrop: (index: number) => void;
  onMove: (from: number, to: number) => void;
}

const InventoryModal: React.FC<InventoryModalProps> = ({ inventory, onClose, onDrop, onMove }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Helper to generate a color hash from string for the item icon
  const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + "00000".substring(0, 6 - c.length) + c;
  };

  const handleSlotClick = (index: number) => {
      // Logic for selecting / moving
      if (selectedIndex === null) {
          // Nothing selected yet. Select this slot if it has an item.
          // (Optionally allow selecting empty slots to move TO them later if we wanted a 'pick up empty' cursor, but typically we select Item first)
          if (inventory[index]) {
              setSelectedIndex(index);
          }
      } else {
          // Item already selected.
          if (selectedIndex === index) {
              // Clicked same slot: Deselect
              setSelectedIndex(null);
          } else {
              // Clicked different slot: Move/Swap
              onMove(selectedIndex, index);
              setSelectedIndex(null);
          }
      }
  };

  const selectedItem = selectedIndex !== null ? inventory[selectedIndex] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-slate-900 border-2 border-slate-600 rounded-lg w-full max-w-lg flex flex-col shadow-2xl overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-3 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
            <h3 className="text-white text-sm font-bold uppercase tracking-wider">Inventory (36 Slots)</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-4 flex flex-col gap-4">
            {/* Grid */}
            <div className="grid grid-cols-6 gap-2">
                {inventory.map((slot, index) => {
                    const isSelected = selectedIndex === index;
                    const isTargetCandidate = selectedIndex !== null && !isSelected;
                    
                    return (
                        <div 
                            key={index}
                            onClick={() => handleSlotClick(index)}
                            className={`
                                aspect-square bg-black/40 border-2 rounded relative cursor-pointer transition-colors
                                ${isSelected ? 'border-yellow-400 bg-slate-800 shadow-[0_0_10px_rgba(250,204,21,0.3)]' : 'border-slate-700 hover:bg-slate-800'}
                                ${isTargetCandidate ? 'hover:border-green-500/50' : ''}
                            `}
                        >
                            {slot && (
                                <>
                                    <div 
                                        className="absolute inset-1 rounded-sm border border-white/10 opacity-80"
                                        style={{ backgroundColor: stringToColor(slot.id) }}
                                    >
                                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md text-center break-all leading-tight px-1">
                                            {slot.id.substring(0, 3)}
                                        </div>
                                    </div>
                                    <span className="absolute bottom-0 right-0 text-[10px] font-mono text-white bg-black/80 px-1 rounded-tl shadow-sm z-10">
                                        {slot.count}
                                    </span>
                                </>
                            )}
                            {!slot && <div className="absolute inset-0 flex items-center justify-center text-slate-800 text-[8px] font-mono">{index + 1}</div>}
                        </div>
                    );
                })}
            </div>

            {/* Item Details / Actions */}
            <div className="bg-slate-800 p-3 rounded border border-slate-700 min-h-[80px] flex items-center justify-between">
                {selectedItem ? (
                    <>
                        <div>
                            <div className="text-white font-bold text-sm">{selectedItem.id}</div>
                            <div className="text-slate-400 text-xs">Quantity: {selectedItem.count}</div>
                            <div className="text-green-400 text-[10px] mt-1 italic animate-pulse">Select another slot to move</div>
                        </div>
                        <button 
                            onClick={() => {
                                onDrop(selectedIndex!);
                                setSelectedIndex(null);
                            }}
                            className="bg-red-900/80 hover:bg-red-700 text-red-200 border border-red-700 px-4 py-2 rounded text-xs font-bold uppercase transition-colors"
                        >
                            Drop Item
                        </button>
                    </>
                ) : (
                    <div className="text-slate-500 text-xs italic w-full text-center">Select an item to view or move</div>
                )}
            </div>
        </div>
        
        <div className="p-2 bg-slate-900 text-center text-[10px] text-slate-500 border-t border-slate-800">
            Click item to select &rarr; Click target to move/swap/stack
        </div>
      </div>
    </div>
  );
};

export default InventoryModal;
