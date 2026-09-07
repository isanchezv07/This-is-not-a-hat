import type { FormEvent, FocusEvent } from 'react';
import { useState } from 'react';

interface Props {
  defaultName: string;
  onJoin: (code: string, name: string) => void;
  onBack: () => void;
}

export default function JoinRoom({ defaultName, onJoin, onBack }: Props) {
  const [code, setCode] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (code.trim().length < 4) return;
    const data = new FormData(e.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    onJoin(code.trim(), name);
  };

  const onFocusSelect = (e: FocusEvent<HTMLInputElement>) => e.target.select();

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 animate-fade-up">
        <h2 className="font-display text-2xl font-bold">Join a room</h2>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-400">Your name</span>
          <input
            name="name"
            className="input"
            defaultValue={defaultName}
            placeholder="Alex"
            onFocus={onFocusSelect}
            maxLength={20}
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-400">Room code</span>
          <input
            className="input font-display !text-2xl !tracking-[0.35em] uppercase text-center"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="X7K92"
            autoFocus
            maxLength={6}
            required
          />
        </label>
        <div className="flex gap-3">
          <button type="button" className="btn-ghost flex-1" onClick={onBack}>
            Back
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={code.trim().length < 4}>
            Join
          </button>
        </div>
      </form>
    </div>
  );
}