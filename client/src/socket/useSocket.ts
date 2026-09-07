import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { BluffResolution, PublicGameState } from '../types';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export interface ToastMsg {
  id: number;
  text: string;
  tone: 'error' | 'info' | 'success';
}

export interface RoomJoined {
  roomCode: string;
  playerId: string;
  persistentId: string;
}

export type ConnStatus = 'connecting' | 'connected' | 'reconnecting';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<PublicGameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [bluffResult, setBluffResult] = useState<BluffResolution | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      reconnectionAttempts: Infinity,
      timeout: 15000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setStatus('connected');
    });
    socket.on('disconnect', () => {
      setConnected(false);
      setStatus('reconnecting');
    });
    socket.on('connect_error', () => {
      setConnected(false);
      setStatus('reconnecting');
    });
    socket.on('error', (payload: { message?: string }) => {
      setError(payload?.message ?? 'Unknown error');
    });
    socket.on('game:state', (s: PublicGameState) => {
      setGameState(s);
      if (s.roomCode) setRoomCode(s.roomCode);
    });
    socket.on('room:created', (r: RoomJoined) => {
      setRoomCode(r.roomCode);
      setPlayerId(r.playerId);
      localStorage.setItem('tinh_pid', r.persistentId);
    });
    socket.on('room:joined', (r: RoomJoined) => {
      setRoomCode(r.roomCode);
      setPlayerId(r.playerId);
      localStorage.setItem('tinh_pid', r.persistentId);
    });
    socket.on('room:reconnected', (r: { roomCode: string; playerId: string }) => {
      setRoomCode(r.roomCode);
      setPlayerId(r.playerId);
      showToast('Reconnected!', 'success');
    });
    socket.on('bluff:resolved', (r: BluffResolution) => {
      setBluffResult(r);
      window.setTimeout(() => setBluffResult(null), 4000);
    });
    return socket;
  }, []);

  const showToast = useCallback((text: string, tone: ToastMsg['tone'] = 'info') => {
    setToast({ id: Date.now(), text, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const emit = useCallback(<T,>(event: string, payload?: T) => {
    socketRef.current?.emit(event, payload);
  }, []);

  const identify = useCallback(() => {
    const pid = localStorage.getItem('tinh_pid');
    if (pid) socketRef.current?.emit('identify', { persistentId: pid });
  }, []);

  const reset = useCallback(() => {
    setGameState(null);
    setPlayerId(null);
    setRoomCode(null);
    setError(null);
    localStorage.removeItem('tinh_pid');
  }, []);

  const leave = useCallback(() => {
    socketRef.current?.emit('leaveRoom');
    reset();
  }, [reset]);

  return {
    status,
    connected,
    gameState,
    playerId,
    roomCode,
    error,
    toast,
    bluffResult,
    showToast,
    connect,
    identify,
    emit,
    reset,
    leave,
  };
}