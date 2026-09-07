import type { CardDef } from '../types';

/**
 * Catálogo de objetos (público, igual que el del servidor).
 * Se usa para renderizar cartas y mostrar las afirmaciones posibles.
 */
export const CARD_DEFS: CardDef[] = [
  { id: 'apple', name: 'Apple', emoji: '🍎', rarity: 'common' },
  { id: 'sunglasses', name: 'Sunglasses', emoji: '🕶️', rarity: 'common' },
  { id: 'guitar', name: 'Guitar', emoji: '🎸', rarity: 'common' },
  { id: 'frog', name: 'Frog', emoji: '🐸', rarity: 'common' },
  { id: 'hat', name: 'Hat', emoji: '🎩', rarity: 'common' },
  { id: 'duck', name: 'Duck', emoji: '🦆', rarity: 'common' },
  { id: 'pizza', name: 'Pizza', emoji: '🍕', rarity: 'common' },
  { id: 'rocket', name: 'Rocket', emoji: '🚀', rarity: 'common' },
  { id: 'camera', name: 'Camera', emoji: '📷', rarity: 'common' },
  { id: 'teddy', name: 'Teddy Bear', emoji: '🧸', rarity: 'common' },
  { id: 'trophy', name: 'Trophy', emoji: '🏆', rarity: 'rare' },
  { id: 'diamond', name: 'Diamond', emoji: '💎', rarity: 'rare' },
  { id: 'crown', name: 'Crown', emoji: '👑', rarity: 'rare' },
  { id: 'gold', name: 'Gold Bar', emoji: '🪙', rarity: 'rare' },
  { id: 'sparkles', name: 'Sparkles', emoji: '✨', rarity: 'rare' },
];

export const CARD_DEF_MAP: Record<string, CardDef> = Object.fromEntries(
  CARD_DEFS.map((c) => [c.id, c]),
);

export function cardDef(defId: string): CardDef {
  return CARD_DEF_MAP[defId] ?? { id: defId, name: defId, emoji: '❓', rarity: 'common' };
}