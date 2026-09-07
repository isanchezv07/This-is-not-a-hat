import { addPlayer, createGame, err, ok, removePlayer, setPlayerSocket } from '../game/game';
import type { GameError, GameOk } from '../game/game';
import type { GameState } from '../game/types';
import { makeRoomCode } from '../game/utils';

/**
 * Almacén en memoria de las salas activas.
 * Mapea código de sala -> estado del juego y socketId -> roomCode.
 */
export class Rooms {
  private rooms = new Map<string, GameState>();
  private socketToRoom = new Map<string, string>();
  private playerToSocket = new Map<string, string>();

  get(roomCode: string): GameState | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  /** Crea una sala nueva con el host dado. */
  createRoom(hostSocketId: string, hostName: string): GameState {
    let code = makeRoomCode(5);
    while (this.rooms.has(code)) code = makeRoomCode(5);
    const hostId = makeRoomCode(6).toLowerCase();
    const state = createGame(code, hostName, hostId);
    setPlayerSocket(state, hostId, hostSocketId, true);
    this.rooms.set(code, state);
    this.bound(hostSocketId, code);
    this.playerToSocket.set(hostId, hostSocketId);
    return state;
  }

  /** Intenta unirse a una sala existente. */
  joinRoom(
    socketId: string,
    roomCode: string,
    name: string,
  ): GameState | string {
    const code = roomCode.toUpperCase();
    const state = this.rooms.get(code);
    if (!state) return 'Room not found.';
    if (state.status !== 'lobby') return 'Game already in progress.';

    const res = addPlayer(state, makeRoomCode(6).toLowerCase(), name);
    if (!res.ok) return res.error;

    // bind
    const playerId = res.value.order[res.value.order.length - 1];
    setPlayerSocket(state, playerId, socketId, true);
    this.bound(socketId, code);
    this.playerToSocket.set(playerId, socketId);
    return state;
  }

  /** Reasigna la conexión de un jugador desconectado a un socket nuevo. */
  getRoomForPlayer(persistentPlayerId: string): GameState | undefined {
    const socketId = this.playerToSocket.get(persistentPlayerId);
    if (!socketId) return undefined;
    return this.rooms.get(this.socketToRoom.get(socketId) ?? '');
  }

  /** Maneja la desconexión de un socket. Retorna la sala afectada, si existe. */
  handleDisconnect(socketId: string): GameState | undefined {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return undefined;
    const state = this.rooms.get(roomCode);
    if (!state) return undefined;
    // localiza jugador
    for (const p of Object.values(state.players)) {
      if (p.socketId === socketId) {
        setPlayerSocket(state, p.id, null, false);
        break;
      }
    }
    // No removemos el mapeo socket->room aún para permitir reconexión.
    return state;
  }

  removeSocketBinding(socketId: string): void {
    this.socketToRoom.delete(socketId);
  }

  getStateForSocket(socketId: string): GameState | undefined {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return undefined;
    return this.rooms.get(roomCode);
  }

  /** Une un socket a una sala (para emisión). */
  bound(socketId: string, roomCode: string): void {
    this.socketToRoom.set(socketId, roomCode.toUpperCase());
  }

  /**
   * Elimina por completo a un jugador de su sala.
   * Devuelve el estado y si debe eliminarse la sala (vacía).
   */
  leaveRoom(
    socketId: string,
  ): { state?: GameState; removeRoom: boolean } {
    const roomCode = this.socketToRoom.get(socketId);
    const state = roomCode ? this.rooms.get(roomCode) : undefined;
    if (!state) return { removeRoom: false };
    const code = roomCode as string;

    let toRemove: string | null = null;
    for (const p of Object.values(state.players)) {
      if (p.socketId === socketId) {
        toRemove = p.id;
        break;
      }
    }
    if (toRemove) {
      const res = removePlayer(state, toRemove);
      if (!res.ok) return { state, removeRoom: false };
      this.playerToSocket.delete(toRemove);
    }
    this.socketToRoom.delete(socketId);

    const remaining = Object.keys(state.players).length;
    if (remaining === 0) {
      this.rooms.delete(code.toUpperCase());
      return { removeRoom: true };
    }
    return { state, removeRoom: false };
  }

  /** Elimina la sala una vez todos se fueron. */
  forceRemove(roomCode: string): void {
    this.rooms.delete(roomCode);
  }

  aliveRooms(): number {
    return this.rooms.size;
  }
}
