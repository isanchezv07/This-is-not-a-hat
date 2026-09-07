import {
  ARROW_DIRECTIONS,
  CARD_DEFS,
  CARD_DEF_MAP,
  DECK_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  STARTING_CARDS,
  STARTING_LIVES,
} from './cards';
import type {
  GameState,
  LogEntry,
  PendingOffer,
  PlayCard,
  Player,
} from './types';
import { makeRoomCode, randInt, shuffle, uid } from './utils';

export {
  ARROW_DIRECTIONS,
  CARD_DEFS,
  CARD_DEF_MAP,
  DECK_SIZE,
  STARTING_CARDS,
  STARTING_LIVES,
  MIN_PLAYERS,
  MAX_PLAYERS,
} from './cards';

export type GameError = { ok: false; error: string };
export type GameOk<T> = { ok: true; value: T };

export interface BluffResolution {
  claimed: boolean;
  actualDefId: string;
  claimedDefId: string;
  loserId: string;
  winnerId: string;
}

export function ok<T>(value: T): GameOk<T> {
  return { ok: true, value };
}
export function err(error: string): GameError {
  return { ok: false, error };
}

function makeLog(text: string, type: LogEntry['type'] = 'info'): LogEntry {
  return { id: uid(), text, type, at: Date.now() };
}

function randomRotation(): number {
  return randInt(0, ARROW_DIRECTIONS - 1);
}

/** Construye la baraja central (boca abajo), duplicando objetos hasta DECK_SIZE. */
export function buildDeck(size = DECK_SIZE): PlayCard[] {
  const cards: PlayCard[] = [];
  let i = 0;
  while (cards.length < size) {
    const def = CARD_DEFS[i % CARD_DEFS.length];
    cards.push({
      uid: uid(),
      defId: def.id,
      isPublic: false,
      rotation: randomRotation(),
      knownClaimDefId: null,
    });
    i++;
  }
  return shuffle(cards);
}

/** Crea una sala en estado de lobby con el host. */
export function createGame(
  roomCode = makeRoomCode(),
  hostName = 'Player',
  hostId = uid(),
): GameState {
  const host: Player = {
    id: hostId,
    name: hostName,
    isHost: true,
    lives: STARTING_LIVES,
    alive: true,
    cards: [],
    connected: true,
    socketId: null,
  };
  return {
    roomCode,
    status: 'lobby',
    players: { [hostId]: host },
    order: [hostId],
    deck: [],
    currentTurnId: null,
    pendingOffer: null,
    log: [makeLog(`${hostName} created the room.`, 'system')],
    winnerId: null,
    turnNumber: 0,
    pendingFirstDraw: false,
  };
}

export function addPlayer(
  state: GameState,
  playerId: string,
  name: string,
): GameOk<GameState> | GameError {
  if (state.status !== 'lobby') {
    return err('Game already started.');
  }
  if (state.players[playerId]) {
    return err('Player already in room.');
  }
  const count = Object.keys(state.players).length;
  if (count >= MAX_PLAYERS) {
    return err(`Room is full (max ${MAX_PLAYERS} players).`);
  }
  const player: Player = {
    id: playerId,
    name: name.trim() || 'Player',
    isHost: false,
    lives: STARTING_LIVES,
    alive: true,
    cards: [],
    connected: true,
    socketId: null,
  };
  state.players[playerId] = player;
  state.order.push(playerId);
  state.log.push(makeLog(`${player.name} joined the room.`));
  return ok(state);
}

export function setPlayerSocket(
  state: GameState,
  playerId: string,
  socketId: string | null,
  connected: boolean,
): void {
  const p = state.players[playerId];
  if (!p) return;
  p.socketId = socketId;
  p.connected = connected;
}

/** Retira a un jugador de la sala. Transfiere el host si era el host. */
export function removePlayer(
  state: GameState,
  playerId: string,
): GameOk<{ newHostId?: string }> | GameError {
  const p = state.players[playerId];
  if (!p) return err('Player not found.');

  delete state.players[playerId];
  state.order = state.order.filter((id) => id !== playerId);
  state.log.push(makeLog(`${p.name} left the room.`));

  let newHostId: string | undefined;
  if (p.isHost) {
    const next = Object.keys(state.players)[0];
    if (next) {
      state.players[next].isHost = true;
      newHostId = next;
      state.log.push(makeLog(`${state.players[next].name} is now the host.`, 'system'));
    }
  }
  return ok({ newHostId });
}

function playerById(state: GameState, id: string): Player | undefined {
  return state.players[id];
}

/** Destinatarios válidos para una carta con flecha (jugadores vivos, no uno mismo). */
export function getValidTargets(state: GameState, playerId: string): string[] {
  if (state.status !== 'playing') return [];
  return Object.values(state.players)
    .filter((p) => p.alive && p.id !== playerId)
    .map((p) => p.id);
}

/** Cartas que el jugador puede pasar (sus cartas, oferta pendiente excluida). */
export function getPassableCards(
  state: GameState,
  playerId: string,
): PlayCard[] {
  const p = playerById(state, playerId);
  if (!p) return [];
  return p.cards;
}

/** Inicia la partida: reparte 1 carta boca arriba a cada uno + primer robo. */
export function startGame(
  state: GameState,
): GameOk<GameState> | GameError {
  if (state.status !== 'lobby') return err('Game already started.');
  const alive = Object.values(state.players).filter((p) => p.connected && p.alive);
  if (alive.length < MIN_PLAYERS) {
    return err(`Need at least ${MIN_PLAYERS} players to start.`);
  }

  const deck = buildDeck(DECK_SIZE);
  state.deck = deck;
  state.status = 'playing';
  state.pendingOffer = null;
  state.log = [];
  state.turnNumber = 0;
  state.winnerId = null;
  state.pendingFirstDraw = true;

  const order = Object.values(state.players)
    .filter((p) => p.connected)
    .map((p) => p.id);
  state.order = order;

  // Reparto inicial: cada jugador recibe 1 carta boca arriba (todos la ven y la recuerdan).
  for (const id of order) {
    const p = state.players[id];
    const card = state.deck.pop();
    if (!card) break;
    card.isPublic = true;
    card.knownClaimDefId = card.defId;
    p.cards = [card];
    state.log.push(
      makeLog(`${p.name} starts with ${CARD_DEF_MAP[card.defId].name} ${CARD_DEF_MAP[card.defId].emoji}.`, 'system'),
    );
  }

  state.currentTurnId = order[0];
  const first = state.players[order[0]];
  state.log.push(
    makeLog(`${first.name} goes first: draw one card from the center and reveal it.`),
  );
  return ok(state);
}

/** Devuelve el siguiente jugador vivo en el orden cíclico. */
function nextAlive(state: GameState, afterId: string): string | null {
  const order = state.order;
  const idx = order.indexOf(afterId);
  const n = order.length;
  for (let k = 1; k <= n; k++) {
    const candidate = order[(idx + k) % n];
    if (state.players[candidate]?.alive) return candidate;
  }
  return null;
}

/**
 * Robo de emergencia: si a un jugador no le quedan cartas que pasar,
 * roba 1 del mazo boca abajo (no la mira) para poder seguir jugando.
 */
function emergencyDraw(state: GameState, p: Player): boolean {
  if (p.cards.length > 0 || state.deck.length === 0) return false;
  const card = state.deck.pop()!;
  card.isPublic = false;
  card.knownClaimDefId = null;
  p.cards.push(card);
  state.log.push(
    makeLog(`${p.name} has no cards and picks one up from the deck face-down.`, 'info'),
  );
  return true;
}

/** Avanza el turno al siguiente jugador con cartas y sigue el partido. */
function advanceTurn(state: GameState): void {
  if (!state.currentTurnId) return;
  state.turnNumber += 1;

  let next = nextAlive(state, state.currentTurnId);
  let guard = state.order.length;
  while (next && guard > 0) {
    const p = state.players[next];
    emergencyDraw(state, p);
    if (p.cards.length > 0 && p.alive) break;
    next = nextAlive(state, next);
    guard -= 1;
  }

  state.currentTurnId = next;
  if (next) {
    state.log.push(makeLog(`${state.players[next].name}'s turn`, 'info'));
  }
}

function playerName(state: GameState, id: string): string {
  return state.players[id]?.name ?? 'Someone';
}

/**
 * Primer robo: el jugador que empieza roba 1 carta del centro SIN verla y
 * la muestra boca arriba a todos para que todos la vean y la recuerden.
 */
export function drawCard(
  state: GameState,
  playerId: string,
): GameError | GameOk<GameState> {
  if (state.status !== 'playing') return err('Game is not in progress.');
  if (!state.pendingFirstDraw) return err('The first draw is already done.');
  if (state.currentTurnId !== playerId) return err('It is not your turn.');
  if (state.deck.length === 0) return err('The deck is empty.');

  const player = playerById(state, playerId);
  if (!player) return err('Player not found.');

  const card = state.deck.pop()!;
  card.isPublic = true;
  card.knownClaimDefId = card.defId;
  player.cards.push(card);
  state.pendingFirstDraw = false;

  const def = CARD_DEF_MAP[card.defId];
  state.log.push(
    makeLog(`${player.name} draws and reveals: ${def.name} ${def.emoji}!`, 'gain'),
  );
  return ok(state);
}

/** El jugador activo pasa una carta (siguiendo la flecha) con una afirmación. */
export function passCard(
  state: GameState,
  playerId: string,
  cardUid: string,
  targetId: string,
  claimedDefId: string,
  rotation?: number,
): GameError | GameOk<GameState> {
  if (state.status !== 'playing') return err('Game is not in progress.');
  if (state.pendingOffer) return err('There is already a pending offer.');
  if (state.currentTurnId !== playerId) return err('It is not your turn.');
  if (!CARD_DEF_MAP[claimedDefId]) return err('Invalid claim.');

  const giver = playerById(state, playerId);
  const target = playerById(state, targetId);
  if (!giver || !target) return err('Player not found.');
  if (!giver.alive || !target.alive) return err('Player is eliminated.');
  if (targetId === playerId) return err('You cannot pass a card to yourself.');

  const cardIdx = giver.cards.findIndex((c) => c.uid === cardUid);
  if (cardIdx === -1) return err('You do not own that card.');

  const [card] = giver.cards.splice(cardIdx, 1);
  if (rotation !== undefined) {
    card.rotation = Math.round(rotation) % ARROW_DIRECTIONS;
  }

  state.pendingOffer = {
    fromPlayerId: playerId,
    toPlayerId: targetId,
    card,
    claimedDefId,
  };

  state.log.push(
    makeLog(`${giver.name} passes a card to ${target.name}, saying: "${CARD_DEF_MAP[claimedDefId].name}".`),
  );

  return ok(state);
}

/** El receptor ACEPTA la carta: se la guarda boca abajo sin mirarla. */
export function acceptCard(state: GameState, playerId: string): GameError | GameOk<GameState> {
  if (state.status !== 'playing') return err('Game is not in progress.');
  const offer = state.pendingOffer;
  if (!offer) return err('No pending offer.');
  if (offer.toPlayerId !== playerId) return err('It is not your offer to accept.');

  const receiver = playerById(state, playerId);
  if (!receiver) return err('Player not found.');

  offer.card.isPublic = false;
  offer.card.knownClaimDefId = offer.claimedDefId;
  receiver.cards.push(offer.card);
  state.pendingOffer = null;
  state.log.push(
    makeLog(`${receiver.name} accepts the card (face-down).`, 'gain'),
  );

  advanceTurn(state);
  return ok(state);
}

/** Resuelve un desafío: revela la carta y penaliza a quien se equivocó. */
export function callBluff(
  state: GameState,
  playerId: string,
): GameError | GameOk<{ state: GameState; resolution: BluffResolution }> {
  if (state.status !== 'playing') return err('Game is not in progress.');
  const offer = state.pendingOffer;
  if (!offer) return err('No pending offer.');
  if (offer.toPlayerId !== playerId) return err('It is not your offer to call.');

  const receiver = playerById(state, playerId);
  const giver = playerById(state, offer.fromPlayerId);
  if (!receiver || !giver) return err('Player not found.');

  const wasTruth = offer.card.defId === offer.claimedDefId;
  const loser = wasTruth ? receiver : giver;
  const winner = wasTruth ? giver : receiver;

  const resolution: BluffResolution = {
    claimed: wasTruth,
    actualDefId: offer.card.defId,
    claimedDefId: offer.claimedDefId,
    loserId: loser.id,
    winnerId: winner.id,
  };

  loser.lives -= 1;
  const actualDef = CARD_DEF_MAP[offer.card.defId];

  // La carta se revela a todos y queda boca arriba para el receptor.
  offer.card.isPublic = true;
  offer.card.knownClaimDefId = offer.card.defId;
  receiver.cards.push(offer.card);
  state.pendingOffer = null;

  state.log.push(
    makeLog(
      wasTruth
        ? `${receiver.name} called bluff but it was the truth: ${actualDef.name} ${actualDef.emoji}.`
        : `${giver.name} lied! It was ${actualDef.name} ${actualDef.emoji}, not ${CARD_DEF_MAP[offer.claimedDefId].name}.`,
      wasTruth ? 'truth' : 'bluff',
    ),
  );
  state.log.push(
    makeLog(`${loser.name} loses a life.`, 'lost'),
  );

  if (loser.lives <= 0) {
    loser.lives = 0;
    loser.alive = false;
    state.log.push(makeLog(`${loser.name} has been eliminated.`, 'eliminated'));
  }

  const winnerId = checkWinner(state);
  if (winnerId) {
    state.winnerId = winnerId;
    state.status = 'finished';
    state.log.push(makeLog(`${state.players[winnerId].name} wins the game!`, 'win'));
  } else {
    advanceTurn(state);
  }

  return ok({ state, resolution });
}

/** Devuelve el ganador, o null si aún hay 2+ jugadores vivos. */
export function checkWinner(state: GameState): string | null {
  if (state.status !== 'playing') {
    return state.winnerId;
  }
  const alive = Object.values(state.players).filter((p) => p.alive && p.lives > 0);
  if (alive.length === 1) return alive[0].id;
  return null;
}

/**
 * Salta el turno de un jugador (p. ej. por desconexión).
 * Solo aplica si no hay una oferta pendiente de ese jugador.
 */
export function skipTurn(state: GameState, playerId: string): void {
  if (state.status !== 'playing') return;
  if (state.pendingOffer && state.pendingOffer.fromPlayerId === playerId) return;
  if (state.currentTurnId === playerId) {
    state.log.push(makeLog(`${playerName(state, playerId)} skipped (disconnected).`));
    advanceTurn(state);
  }
}

/** Reinicia la sala al lobby (para "Volver al lobby" tras una partida). */
export function returnToLobby(state: GameState): GameOk<GameState> {
  for (const p of Object.values(state.players)) {
    p.lives = STARTING_LIVES;
    p.alive = true;
    p.cards = [];
  }
  state.status = 'lobby';
  state.deck = [];
  state.currentTurnId = null;
  state.pendingOffer = null;
  state.winnerId = null;
  state.turnNumber = 0;
  state.pendingFirstDraw = false;
  state.log = [makeLog('Back to the lobby.', 'system')];
  return ok(state);
}

/** Reinicia la partida manteniendo a los jugadores (para "Jugar de nuevo"). */
export function resetGame(state: GameState): GameError | GameOk<GameState> {
  for (const p of Object.values(state.players)) {
    p.lives = STARTING_LIVES;
    p.alive = true;
    p.cards = [];
  }
  state.pendingOffer = null;
  state.winnerId = null;
  state.turnNumber = 0;
  state.pendingFirstDraw = false;
  state.status = 'lobby';
  return startGame(state);
}