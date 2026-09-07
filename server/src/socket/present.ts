import { CARD_DEF_MAP } from '../game/cards';
import type { GameState, Player } from '../game/types';

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

export interface PublicGameState {
  roomCode: string;
  status: string;
  players: Record<string, PublicPlayer>;
  order: string[];
  currentTurnId: string | null;
  pendingOffer: PublicPendingOffer | null;
  log: { text: string; type: string; at: number }[];
  winnerId: string | null;
  turnNumber: number;
  deckCount: number;
  /** Primer turno: el jugador activo debe robar y revelar. */
  pendingFirstDraw: boolean;
}

function publicCard(c: {
  uid: string;
  isPublic: boolean;
  rotation: number;
  knownClaimDefId: string | null;
  defId: string;
}): PublicCard {
  const known = c.knownClaimDefId ? CARD_DEF_MAP[c.knownClaimDefId] : null;
  return {
    uid: c.uid,
    isPublic: c.isPublic,
    rotation: c.rotation,
    knownClaimDefId: known?.id ?? null,
    knownClaimName: known?.name ?? null,
    knownClaimEmoji: known?.emoji ?? null,
    defId: c.isPublic ? c.defId : null,
  };
}

/**
 * Proyecta el estado del juego para UN jugador.
 * Las cartas boca arriba son visibles para todos; las boca abajo no muestran
 * su identidad real a NADIE (ni a su dueño, que debe fiarse de la memoria,
 * de la última afirmación dicha en voz alta y de la flecha).
 */
export function presentForPlayer(state: GameState, _viewerId: string): PublicGameState {
  const players: Record<string, PublicPlayer> = {};
  for (const p of Object.values(state.players) as Player[]) {
    players[p.id] = {
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      lives: p.lives,
      alive: p.alive,
      connected: p.connected,
      cards: p.cards.map(publicCard),
      cardCount: p.cards.length,
    };
  }

  let pendingOffer: PublicPendingOffer | null = null;
  const offer = state.pendingOffer;
  if (offer) {
    const claimed = CARD_DEF_MAP[offer.claimedDefId];
    const c = offer.card;
    pendingOffer = {
      fromPlayerId: offer.fromPlayerId,
      toPlayerId: offer.toPlayerId,
      claimedDefId: offer.claimedDefId,
      claimedName: claimed?.name ?? 'Unknown',
      claimedEmoji: claimed?.emoji ?? '❓',
      card: { rotation: c.rotation, isPublic: c.isPublic },
    };
  }

  return {
    roomCode: state.roomCode,
    status: state.status,
    players,
    order: state.order,
    currentTurnId: state.currentTurnId,
    pendingOffer,
    log: state.log.map((l) => ({ text: l.text, type: l.type, at: l.at })),
    winnerId: state.winnerId,
    turnNumber: state.turnNumber,
    deckCount: state.deck.length,
    pendingFirstDraw: state.pendingFirstDraw,
  };
}