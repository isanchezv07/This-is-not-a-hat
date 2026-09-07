interface Props {
  onCreate: () => void;
  onJoin: () => void;
}

const SAMPLE_EMOJI = ['🎩', '🦆', '🍕', '🚀', '🍎', '🐸'];

export default function Menu({ onCreate, onJoin }: Props) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex items-center justify-center gap-3 text-5xl">
          {SAMPLE_EMOJI.map((e, i) => (
            <span key={e} className="animate-float inline-block" style={{ animationDelay: `${i * 0.4}s` }}>
              {e}
            </span>
          ))}
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-50">
          THIS IS <span className="text-accent">NOT</span> A HAT
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Memory &amp; bluff. Pass objects, remember what you received, and call out the liars.
        </p>

        <div className="mt-10 flex flex-col gap-3">
          <button className="btn-primary w-full" onClick={onCreate}>
            Create room
          </button>
          <button className="btn-ghost w-full" onClick={onJoin}>
            Join room
          </button>
        </div>

        <p className="mt-8 text-xs text-slate-500">2–8 players • one device each • realtime</p>
      </div>
    </div>
  );
}