import cors from 'cors';
import express from 'express';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import type { Socket } from 'socket.io';
import { Server } from 'socket.io';
import {
  acceptCard,
  callBluff,
  drawCard,
  passCard,
  resetGame,
  returnToLobby,
  skipTurn,
  startGame,
} from './game/game';
import { setPlayerSocket } from './game/game';
import type { GameState } from './game/types';
import { Rooms } from './rooms/rooms';
import { presentForPlayer } from './socket/present';

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

export interface GameServer {
  httpServer: http.Server;
  io: Server;
  rooms: Rooms;
}

function lobbyState(state: GameState) {
  return {
    roomCode: state.roomCode,
    status: state.status,
    players: Object.values(state.players).map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      connected: p.connected,
    })),
  };
}

function emitError(socket: Socket, message: string): void {
  socket.emit('error', { message });
}

function joinSocketToRoom(socket: Socket, roomCode: string): void {
  socket.join(roomCode);
  socket.data.roomCode = roomCode;
}

/** Crea el servidor HTTP + Socket.IO y registra los handlers del juego. */
export function createGameServer(): GameServer {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
  });
  const rooms = new Rooms();

  /** Emite el estado filtrado a cada jugador de la sala. */
  function broadcastRoomState(roomCode: string): void {
    const state = rooms.get(roomCode);
    if (!state) return;
    const socketIds = io.sockets.adapter.rooms.get(roomCode) ?? new Set();
    for (const sid of socketIds) {
      const socket = io.sockets.sockets.get(sid);
      if (!socket) continue;
      socket.emit('game:state', presentForPlayer(state, socket.data.playerId ?? ''));
      socket.emit('room:state', lobbyState(state));
    }
  }

  io.on('connection', (socket) => {
    console.log(`[connect] ${socket.id}`);

    // Reconexión: el cliente envía su id persistente tras conectar.
    socket.on('identify', (payload: { persistentId?: string }) => {
      const pid = payload?.persistentId;
      if (!pid) return;
      const state = rooms.getRoomForPlayer(pid);
      if (!state) return;
      const player = state.players[pid];
      if (!player) return;
      setPlayerSocket(state, pid, socket.id, true);
      rooms.bound(socket.id, state.roomCode);
      socket.data.playerId = pid;
      socket.data.roomCode = state.roomCode;
      socket.data.persistentId = pid;
      joinSocketToRoom(socket, state.roomCode);
      broadcastRoomState(state.roomCode);
      socket.emit('room:reconnected', { roomCode: state.roomCode, playerId: pid });
      console.log(`[reconnect] ${socket.id} -> ${pid}`);
    });

    socket.on('createRoom', (payload: { name?: string }, ack?: (r: unknown) => void) => {
      const name = (payload?.name ?? '').trim() || 'Player';
      const state = rooms.createRoom(socket.id, name);
      const playerId = state.order[0];
      socket.data.playerId = playerId;
      socket.data.persistentId = playerId;
      joinSocketToRoom(socket, state.roomCode);
      socket.emit('room:created', {
        roomCode: state.roomCode,
        playerId,
        persistentId: playerId,
      });
      broadcastRoomState(state.roomCode);
      if (ack) ack({ ok: true, roomCode: state.roomCode, playerId });
    });

    socket.on(
      'joinRoom',
      (payload: { code?: string; name?: string }, ack?: (r: unknown) => void) => {
        const name = (payload?.name ?? '').trim() || 'Player';
        const code = (payload?.code ?? '').trim();
        const result = rooms.joinRoom(socket.id, code, name);
        if (typeof result === 'string') {
          emitError(socket, result);
          if (ack) ack({ ok: false, message: result });
          return;
        }
        const playerId = Object.values(result.players).find(
          (p) => p.socketId === socket.id,
        )?.id;
        if (!playerId) {
          emitError(socket, 'Could not join room.');
          if (ack) ack({ ok: false, message: 'Could not join room.' });
          return;
        }
        socket.data.playerId = playerId;
        socket.data.persistentId = playerId;
        joinSocketToRoom(socket, result.roomCode);
        socket.emit('room:joined', {
          roomCode: result.roomCode,
          playerId,
          persistentId: playerId,
        });
        broadcastRoomState(result.roomCode);
        if (ack) ack({ ok: true, roomCode: result.roomCode, playerId });
      },
    );

    socket.on('leaveRoom', () => {
      const roomCode = socket.data.roomCode as string | undefined;
      const result = rooms.leaveRoom(socket.id);
      if (!result.removeRoom && result.state && roomCode) {
        broadcastRoomState(roomCode);
      }
      socket.leave(roomCode ?? '');
    });

    socket.on('startGame', () => {
      const state = rooms.getStateForSocket(socket.id);
      if (!state) return;
      const player = state.players[socket.data.playerId as string];
      if (!player?.isHost) {
        emitError(socket, 'Only the host can start the game.');
        return;
      }
      const res = startGame(state);
      if (!res.ok) {
        emitError(socket, res.error);
        return;
      }
      broadcastRoomState(state.roomCode);
    });

    socket.on(
      'drawCard',
      () => {
        const state = rooms.getStateForSocket(socket.id);
        if (!state) return;
        const playerId = socket.data.playerId as string;
        const res = drawCard(state, playerId);
        if (!res.ok) {
          emitError(socket, res.error);
          return;
        }
        broadcastRoomState(state.roomCode);
      },
    );

    socket.on(
      'passCard',
      (payload: {
        cardUid?: string;
        targetId?: string;
        claimedDefId?: string;
        rotation?: number;
      }) => {
        const state = rooms.getStateForSocket(socket.id);
        if (!state) return;
        const playerId = socket.data.playerId as string;
        const res = passCard(
          state,
          playerId,
          payload?.cardUid ?? '',
          payload?.targetId ?? '',
          payload?.claimedDefId ?? '',
          payload?.rotation,
        );
        if (!res.ok) {
          emitError(socket, res.error);
          return;
        }
        broadcastRoomState(state.roomCode);
      },
    );

    socket.on('acceptCard', () => {
      const state = rooms.getStateForSocket(socket.id);
      if (!state) return;
      const playerId = socket.data.playerId as string;
      const res = acceptCard(state, playerId);
      if (!res.ok) {
        emitError(socket, res.error);
        return;
      }
      broadcastRoomState(state.roomCode);
    });

    socket.on('callBluff', () => {
      const state = rooms.getStateForSocket(socket.id);
      if (!state) return;
      const playerId = socket.data.playerId as string;
      const res = callBluff(state, playerId);
      if (!res.ok) {
        emitError(socket, res.error);
        return;
      }
      broadcastRoomState(state.roomCode);
      const socketIds = io.sockets.adapter.rooms.get(state.roomCode) ?? new Set();
      for (const sid of socketIds) {
        const s = io.sockets.sockets.get(sid);
        if (s) {
          s.emit('bluff:resolved', {
            actualDefId: res.value.resolution.actualDefId,
            claimedDefId: res.value.resolution.claimedDefId,
            claimed: res.value.resolution.claimed,
            loserId: res.value.resolution.loserId,
            winnerId: res.value.resolution.winnerId,
          });
        }
      }
    });

    socket.on('playAgain', () => {
      const state = rooms.getStateForSocket(socket.id);
      if (!state) return;
      const player = state.players[socket.data.playerId as string];
      if (!player?.isHost) {
        emitError(socket, 'Only the host can start a new game.');
        return;
      }
      if (state.status !== 'finished') {
        emitError(socket, 'Game is not over.');
        return;
      }
      const res = resetGame(state);
      if (!res.ok) {
        emitError(socket, res.error);
        return;
      }
      broadcastRoomState(state.roomCode);
    });

    socket.on('returnToLobby', () => {
      const state = rooms.getStateForSocket(socket.id);
      if (!state) return;
      const player = state.players[socket.data.playerId as string];
      if (!player?.isHost) {
        emitError(socket, 'Only the host can return to lobby.');
        return;
      }
      if (state.status !== 'finished') {
        emitError(socket, 'Game is not over.');
        return;
      }
      returnToLobby(state);
      broadcastRoomState(state.roomCode);
    });

    socket.on('disconnect', () => {
      console.log(`[disconnect] ${socket.id}`);
      const state = rooms.handleDisconnect(socket.id);
      if (!state) return;
      const playerId = socket.data.playerId as string | undefined;
      const inGame = state.status !== 'lobby';
      if (playerId && !inGame) {
        const result = rooms.leaveRoom(socket.id);
        if (result.state) broadcastRoomState(result.state.roomCode);
      } else if (state.status === 'playing') {
        // Si el desconectado era el jugador activo, avanzar el turno para no bloquear.
        if (state.currentTurnId === playerId && !state.pendingOffer) {
          skipTurn(state, playerId);
        }
        broadcastRoomState(state.roomCode);
      } else if (state.status === 'lobby') {
        broadcastRoomState(state.roomCode);
      }
    });
  });

  return { httpServer: server, io, rooms };
}

// Arranca solo cuando se ejecuta directamente (no al ser importado en tests).
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const gs = createGameServer();
  gs.httpServer.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
}