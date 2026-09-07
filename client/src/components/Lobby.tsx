import type { PublicGameState } from '../types';

interface Props {
  state: PublicGameState;
  playerId: string;
  name: string;
  onStart: () => void;
  onLeave: () => void;
}

export default function Lobby({ state, playerId, onStart, onLeave }: Props) {
  const me = state.players[playerId];
  const canStart = me?.isHost ?? false;
  const enough = Object.keys(state.players).length >= 2;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(state.roomCode);
    } catch {
      /* clipboard no disponible */
    }
  };

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 animate-fade-up">
        <div className="text-center space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Room</h2>
          <button
            onClick={copyCode}
            className="font-display text-5xl font-bold tracking-[0.25em] text-accent hover:text-accent/90 transition"
            title="Copy code"
          >
            {state.roomCode}
          </button>
          <p className="text-xs text-slate-500">Tap to copy • share with friends</p>
        </div>

        <div className="panel">
          <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 mb-3">
            Players · {Object.keys(state.players).length}/8
          </h3>
          <ul className="space-y-2">
            {Object.values(state.players).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-surface px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${p.connected ? 'bg-mint' : 'bg-slate-500'}`} />
                  <span className="font-medium">{p.name}</span>
                  {!p.connected && <span className="text-xs text-slate-500">(disconnected)</span>}
                </div>
                {p.isHost && (
                  <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent">
                    HOST
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {canStart ? (
          <button className="btn-primary w-full" onClick={onStart} disabled={!enough}>
            {enough ? 'Start game' : 'Waiting for at least 2 players…'}
          </button>
        ) : (
          <div className="rounded-xl border border-line bg-panel px-4 py-3 text-center text-sm text-slate-400 animate-pulse">
            Waiting for host to start…
          </div>
        )}

        <button className="btn-ghost w-full" onClick={onLeave}>
          Leave room
        </button>
      </div>
    </div>
  );
}