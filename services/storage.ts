import { CustomSprite, GameSaveState } from "../types";

const SPRITES_KEY = 'rpg_custom_sprites';
const GAME_STATE_KEY = 'rpg_game_state';

export const StorageService = {
  // --- Sprite Library ---
  saveSprite: (sprite: CustomSprite): void => {
    const existing = StorageService.getSprites();
    const index = existing.findIndex(s => s.id === sprite.id);
    
    if (index >= 0) {
      existing[index] = sprite;
    } else {
      existing.push(sprite);
    }
    
    localStorage.setItem(SPRITES_KEY, JSON.stringify(existing));
  },

  getSprites: (): CustomSprite[] => {
    try {
      const data = localStorage.getItem(SPRITES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Failed to load sprites", e);
      return [];
    }
  },

  deleteSprite: (id: string): void => {
    const existing = StorageService.getSprites();
    const filtered = existing.filter(s => s.id !== id);
    localStorage.setItem(SPRITES_KEY, JSON.stringify(filtered));
  },

  // --- Game State (World, Player, Stats) ---
  saveGameState: (state: GameSaveState): void => {
    try {
      localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save game state", e);
    }
  },

  loadGameState: (): GameSaveState | null => {
    try {
      const data = localStorage.getItem(GAME_STATE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error("Failed to load game state", e);
      return null;
    }
  }
};
