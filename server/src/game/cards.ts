import type { CardDef } from './types';

/**
 * Catálogo de objetos del juego.
 * Para añadir nuevos objetos, basta con agregar una entrada aquí.
 * Cada carta se identifica por `id` y se muestra con su `emoji` y `name`.
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

export const STARTING_LIVES = 3;
export const STARTING_CARDS = 1;
export const DECK_SIZE = 40;
/** Direcciones de la flecha de las cartas (0-7 = brújula). */
export const ARROW_DIRECTIONS = 8;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

export function getCardDef(defId: string): CardDef | undefined {
  return CARD_DEF_MAP[defId];
}
