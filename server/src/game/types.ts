export type CardRarity = 'common' | 'rare';

export interface CardDef {
  id: string;
  name: string;
  emoji: string;
  rarity: CardRarity;
}

/**
 * Carta en juego.
 * - `isPublic`: boca arriba (todo el mundo conoce `defId`).
 * - Cuando se pasa (boca abajo) la identidad real queda oculta hasta revelarse.
 * - `rotation`: dirección de la flecha (0-7) que marca a quién pasarla.
 * - `knownClaimDefId`: última afirmación dicha en voz alta sobre la carta (pública).
 */
export interface PlayCard {
  uid: string;
  defId: string;
  isPublic: boolean;
  rotation: number;
  knownClaimDefId: string | null;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  lives: number;
  alive: boolean;
  cards: PlayCard[];
  connected: boolean;
  socketId: string | null;
}

export type GameStatus = 'lobby' | 'playing' | 'finished';

export interface PendingOffer {
  fromPlayerId: string;
  toPlayerId: string;
  card: PlayCard;
  /** Lo que el remitente afirma en voz alta que es la carta. */
  claimedDefId: string;
}

export interface LogEntry {
  id: string;
  text: string;
  type: 'info' | 'gain' | 'lost' | 'eliminated' | 'win' | 'bluff' | 'truth' | 'system';
  at: number;
}

export interface GameState {
  roomCode: string;
  status: GameStatus;
  players: Record<string, Player>;
  /** Orden de turnos (ids de jugadores). */
  order: string[];
  /** Pila central de cartas boca abajo. */
  deck: PlayCard[];
  currentTurnId: string | null;
  pendingOffer: PendingOffer | null;
  log: LogEntry[];
  winnerId: string | null;
  turnNumber: number;
  /** Cierto solo en el primer turno: el jugador activo debe robar y revelar. */
  pendingFirstDraw: boolean;
}