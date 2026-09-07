import { useEffect, useState } from 'react';
import GameBoard from './components/GameBoard';
import JoinRoom from './components/JoinRoom';
import CreateRoom from './components/CreateRoom';
import Menu from './components/Menu';
import Lobby from './components/Lobby';
import VictoryScreen from './components/VictoryScreen';
import { useSocket } from './socket/useSocket';
import type { AppView, PublicGameState } from './types';

type Phase = 'menu' | 'create' | 'join' | 'room';

export default function App() {
  const socket = useSocket();
  const [name, setName] = useState<string>(() => localStorage.getItem('tinh_name') ?? '');
  const [phase, setPhase] = useState<Phase>('menu');

  useEffect(() => {
    socket.connect();
    socket.identify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const state: PublicGameState | null = socket.gameState;

  // Al recibir un estado de lobby, pasar a la vista de sala.
  useEffect(() => {
    if (state?.status === 'lobby') setPhase('room');
  }, [state]);

  const onJoin = (code: string, playerName: string) => {
    localStorage.setItem('tinh_name', playerName);
    setName(playerName);
    socket.emit('joinRoom', { code, name: playerName });
  };

  const onCreate = (playerName: string) => {
    localStorage.setItem('tinh_name', playerName);
    setName(playerName);
    socket.emit('createRoom', { name: playerName });
  };

  const onLeave = () => {
    socket.leave();
    setPhase('menu');
  };

  let view: AppView;
  if (state?.status === 'playing' || state?.status === 'finished') view = 'game';
  else if (phase === 'create') view = 'create';
  else if (phase === 'join') view = 'join';
  else if (phase === 'room' || state?.status === 'lobby') view = 'room';
  else view = 'menu';

  return (
    <div className="min-h-full flex flex-col">
      {socket.toast && (
        <div
          className={`fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full border px-4 py-2 text-sm font-medium shadow-lg animate-fade-up ${
            socket.toast.tone === 'error'
              ? 'border-coral/40 bg-coral/10 text-coral'
              : socket.toast.tone === 'success'
                ? 'border-mint/40 bg-mint/10 text-mint'
                : 'border-line bg-surface text-slate-200'
          }`}
        >
          {socket.toast.text}
        </div>
      )}

      {socket.status !== 'connected' && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-panel/90 px-4 py-2 text-xs font-medium text-slate-300 backdrop-blur animate-fade-up">
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          {socket.status === 'connecting'
            ? 'Connecting to server…'
            : 'Reconnecting… if this takes a while, the server may be waking up.'}
        </div>
      )}

      {socket.error && phase !== 'room' && view !== 'game' && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-coral/40 bg-coral/10 px-4 py-2 text-sm font-medium text-coral animate-fade-up">
          {socket.error}
        </div>
      )}

      {view === 'menu' && <Menu onCreate={() => setPhase('create')} onJoin={() => setPhase('join')} />}
      {view === 'create' && (
        <CreateRoom defaultName={name} onCreate={onCreate} onBack={() => setPhase('menu')} />
      )}
      {view === 'join' && (
        <JoinRoom defaultName={name} onJoin={onJoin} onBack={() => setPhase('menu')} />
      )}

      {view === 'room' && state && state.status === 'lobby' && (
        <Lobby
          state={state}
          playerId={socket.playerId ?? ''}
          name={socket.playerId ? state.players[socket.playerId]?.name ?? name : name}
          onStart={() => socket.emit('startGame')}
          onLeave={onLeave}
        />
      )}

      {view === 'game' && state && (
        <>
          <GameBoard
            state={state}
            playerId={socket.playerId ?? ''}
            onDraw={() => socket.emit('drawCard')}
            onPass={(cardUid, targetId, claimedDefId, rotation) =>
              socket.emit('passCard', { cardUid, targetId, claimedDefId, rotation })
            }
            onAccept={() => socket.emit('acceptCard')}
            onCallBluff={() => socket.emit('callBluff')}
            onLeave={onLeave}
            bluffResult={socket.bluffResult}
          />
          {state.status === 'finished' && (
            <Overlay>
              <VictoryScreen
                state={state}
                playerId={socket.playerId ?? ''}
                onPlayAgain={() => socket.emit('playAgain')}
                onReturnLobby={() => socket.emit('returnToLobby')}
              />
            </Overlay>
          )}
        </>
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/80 backdrop-blur-sm p-4">{children}</div>;
}