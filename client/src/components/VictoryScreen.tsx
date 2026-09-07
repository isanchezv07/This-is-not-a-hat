import type { PublicGameState } from '../types';

interface Props {
  state: PublicGameState;
  playerId: string;
  onPlayAgain: () => void;
  onReturnLobby: () => void;
}

export default function VictoryScreen({ state, playerId, onPlayAgain, onReturnLobby }: Props) {
  const winner = state.winnerId ? state.players[state.winnerId] : null;
  const iWon = winner?.id === playerId;

  return (
    <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-8 text-center animate-card-in">
      <div className="mb-4 text-6xl">{iWon ? '🏆' : '🎭'}</div>
      <h1 className="font-display text-4xl font-black tracking-tight text-accent">
        {(iWon ? 'YOU WIN' : `${winner?.name ?? '…'} WINS`).toUpperCase()}
      </h1>
      <p className="mt-3 text-sm text-slate-400">
        {iWon
          ? 'You were the last one standing.'
          : `${winner?.name ?? '…'} was the last one standing.`}
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <button className="btn-primary w-full" onClick={onPlayAgain}>
          Play again
        </button>
        <button className="btn-ghost w-full" onClick={onReturnLobby}>
          Return to lobby
        </button>
      </div>
    </div>
  );
}