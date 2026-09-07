import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { createGameServer } from './index';

const PORT = 4099;
const URL = `http://localhost:${PORT}`;

interface Client {
  socket: Socket;
  states: unknown[];
  roomCode: string;
  playerId?: string;
}

function waitConnect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve();
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}

function waitEvent(socket: Socket, event: string): Promise<unknown> {
  return new Promise((resolve) => socket.once(event, resolve));
}

/** Espera un estado que cumpla el predicado (filtra estados antiguos en vuelo). */
function waitState<T = Record<string, unknown>>(
  socket: Socket,
  pred: (s: T) => boolean,
): Promise<T> {
  return new Promise((resolve) => {
    const h = (s: T) => {
      if (pred(s)) {
        socket.off('game:state', h);
        resolve(s);
      }
    };
    socket.on('game:state', h);
  });
}

interface PublicCard {
  uid: string;
  isPublic: boolean;
  defId: string | null;
  knownClaimDefId: string | null;
  knownClaimName: string | null;
}

interface PublicPlayerView {
  cards: PublicCard[];
  cardCount: number;
  alive: boolean;
  lives: number;
}

function makeClient(name: string): Client {
  const socket = io(URL, { transports: ['websocket'] });
  void name;
  return {
    socket,
    states: [],
    roomCode: '',
  };
}

describe('servidor completo (Socket.IO + Express)', () => {
  let gs: ReturnType<typeof createGameServer>;
  let clients: Client[] = [];

  beforeAll(async () => {
    gs = createGameServer();
    await new Promise<void>((resolve) => gs.httpServer.listen(PORT, resolve));
  });

  afterAll(async () => {
    for (const c of clients) c.socket.disconnect();
    await new Promise<void>((resolve) => gs.httpServer.close(() => resolve()));
  });

  async function connect(name: string): Promise<Client> {
    const c = makeClient(name);
    clients.push(c);
    await waitConnect(c.socket);
    return c;
  }

  async function createRoom(name: string): Promise<Client> {
    const c = await connect(name);
    const created = waitEvent(c.socket, 'room:created') as Promise<{ roomCode: string; playerId: string }>;
    c.socket.emit('createRoom', { name });
    const r = await created;
    c.roomCode = r.roomCode;
    c.playerId = r.playerId;
    return c;
  }

  async function joinRoom(c: Client, code: string, name: string): Promise<void> {
    const joined = waitEvent(c.socket, 'room:joined') as Promise<{ roomCode: string; playerId: string }>;
    c.socket.emit('joinRoom', { code, name });
    const r = await joined;
    c.roomCode = r.roomCode;
    c.playerId = r.playerId;
  }

  it('permite crear y unirse a una sala', async () => {
    const host = await createRoom('Alex');
    expect(host.roomCode).toMatch(/^[A-Z0-9]{5}$/);

    const diego = await connect('Diego');
    await joinRoom(diego, host.roomCode, 'Diego');
    expect(diego.roomCode).toBe(host.roomCode);
  });

  it('no permite comenzar con un solo jugador', async () => {
    const host = await createRoom('Solo');
    const err = waitEvent(host.socket, 'error') as Promise<{ message: string }>;
    host.socket.emit('startGame');
    const e = await err;
    expect(e.message).toContain('least');
  });

  it('el host arranca la partida y reparte 1 carta boca arriba a cada uno', async () => {
    const host = await createRoom('Alex');
    const diego = await connect('Diego');
    await joinRoom(diego, host.roomCode, 'Diego');

    const hostState = waitState<{
      status: string;
      players: Record<string, PublicPlayerView>;
      currentTurnId: string | null;
      pendingFirstDraw: boolean;
    }>(host.socket, (s) => s.status === 'playing');

    host.socket.emit('startGame');
    const hs = await hostState;
    expect(hs.status).toBe('playing');
    expect(hs.currentTurnId).toBe(host.playerId);
    expect(hs.pendingFirstDraw).toBe(true);
    // Cada jugador ve su carta inicial Y la del otro (boca arriba): públicas.
    expect(hs.players[host.playerId!].cards.length).toBe(1);
    expect(hs.players[diego.playerId!].cards.length).toBe(1);
    expect(hs.players[host.playerId!].cards[0].isPublic).toBe(true);
    expect(hs.players[host.playerId!].cards[0].defId).toBeTruthy();
  });

it('flujo completo: robar -> pasar -> aceptar -> desafiar (mentira)', async () => {
    const host = await createRoom('Alex');
    const diego = await connect('Diego');
    await joinRoom(diego, host.roomCode, 'Diego');

    const hostPlaying = waitState<{ status: string; pendingFirstDraw: boolean }>(
      host.socket,
      (s) => s.status === 'playing',
    );
    host.socket.emit('startGame');
    await hostPlaying;

    // Host roba la primera carta y la revela
    const hostDrawnW = waitState<{
      pendingFirstDraw: boolean;
      players: Record<string, PublicPlayerView>;
    }>(host.socket, (s) => s.pendingFirstDraw === false);
    host.socket.emit('drawCard');
    const hostDrawn = await hostDrawnW;
    // El estado del robo ya trae las 2 cartas públicas del host
    const card = hostDrawn.players[host.playerId!].cards[0];

    // Host pasa una carta a Diego afirmando 'apple'
    const offerWait = waitState<{ pendingOffer: { toPlayerId: string } | null }>(
      diego.socket,
      (s) => s.pendingOffer?.toPlayerId === diego.playerId,
    );
    host.socket.emit('passCard', {
      cardUid: card.uid,
      targetId: diego.playerId,
      claimedDefId: 'apple',
      rotation: 2,
    });
    const offerState = await offerWait;
    expect(offerState.pendingOffer?.toPlayerId).toBe(diego.playerId);

    // Diego desafía
    const bluff = waitEvent(diego.socket, 'bluff:resolved') as Promise<{ claimed: boolean }>;
    diego.socket.emit('callBluff');
    const r = await bluff;
    expect(typeof r.claimed).toBe('boolean');
  });

  it('host transferido cuando el host abandona', async () => {
    const host = await createRoom('Alex');
    const diego = await connect('Diego');
    await joinRoom(diego, host.roomCode, 'Diego');

    const diegoState = waitEvent(diego.socket, 'game:state') as Promise<{
      players: Record<string, { isHost: boolean }>;
    }>;
    host.socket.emit('leaveRoom');
    const s = await diegoState;
    expect(s.players[diego.playerId!].isHost).toBe(true);
  });

  it('rechaza las jugadas fuera de turno', async () => {
    const host = await createRoom('Alex');
    const diego = await connect('Diego');
    await joinRoom(diego, host.roomCode, 'Diego');

    const hsW = waitState<{ status: string }>(host.socket, (s) => s.status === 'playing');
    host.socket.emit('startGame');
    await hsW;

    // Diego intenta pasar antes de que el host robe/pase (no es su turno)
    const err = waitEvent(diego.socket, 'error') as Promise<{ message: string }>;
    diego.socket.emit('passCard', {
      cardUid: 'fake',
      targetId: host.playerId,
      claimedDefId: 'apple',
    });
    const e = await err;
    expect(e.message).toContain('not your turn');
  });
});