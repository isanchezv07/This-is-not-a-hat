import type { FormEvent, FocusEvent } from 'react';

interface Props {
  defaultName: string;
  onCreate: (name: string) => void;
  onBack: () => void;
}

export default function CreateRoom({ defaultName, onCreate, onBack }: Props) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    onCreate(name);
  };

  const onFocusSelect = (e: FocusEvent<HTMLInputElement>) => e.target.select();

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 animate-fade-up">
        <h2 className="font-display text-2xl font-bold">Create a room</h2>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-400">Your name</span>
          <input
            name="name"
            className="input"
            defaultValue={defaultName}
            placeholder="Alex"
            autoFocus
            onFocus={onFocusSelect}
            maxLength={20}
            required
          />
        </label>
        <div className="flex gap-3">
          <button type="button" className="btn-ghost flex-1" onClick={onBack}>
            Back
          </button>
          <button type="submit" className="btn-primary flex-1">
            Create
          </button>
        </div>
      </form>
    </div>
  );
}