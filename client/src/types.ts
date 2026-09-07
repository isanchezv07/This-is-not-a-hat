export interface PublicCard {
  uid: string;
  isPublic: boolean;
  rotation: number;
  knownClaimDefId: string | null;
  knownClaimName: string | null;
  knownClaimEmoji: string | null;
  /** Identidad real: solo visible si la carta está boca arriba (pública). */
  defId: string | null;
}

export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  lives: number;
  alive: boolean;
  connected: boolean;
  cards: PublicCard[];
  cardCount: number;
}

export interface PublicPendingOffer {
  fromPlayerId: string;
  toPlayerId: string;
  claimedDefId: string;
  claimedName: string;
  claimedEmoji: string;
  card: { rotation: number; isPublic: boolean };
}

export type LogType = 'info' | 'gain' | 'lost' | 'eliminated' | 'win' | 'bluff' | 'truth' | 'system';

export interface PublicLog {
  text: string;
  type: LogType;
  at: number;
}

export interface PublicGameState {
  roomCode: string;
  status: 'lobby' | 'playing' | 'finished';
  players: Record<string, PublicPlayer>;
  order: string[];
  currentTurnId: string | null;
  pendingOffer: PublicPendingOffer | null;
  log: PublicLog[];
  winnerId: string | null;
  turnNumber: number;
  deckCount: number;
  /** Primer turno: el jugador activo debe robar y revelar. */
  pendingFirstDraw: boolean;
}

export interface CardDef {
  id: string;
  name: string;
  emoji: string;
  rarity: 'common' | 'rare';
}

export interface BluffResolution {
  actualDefId: string;
  claimedDefId: string;
  claimed: boolean;
  loserId: string;
  winnerId: string;
}

export type AppView = 'menu' | 'create' | 'join' | 'room' | 'game';