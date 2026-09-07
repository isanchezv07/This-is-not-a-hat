import { useEffect, useMemo, useState } from 'react';
import { cardDef, CARD_DEFS } from '../game/cards';
import type { BluffResolution, PublicGameState } from '../types';
import type { PublicCard, PublicPlayer } from '../types';

interface Props {
  state: PublicGameState;
  playerId: string;
  onDraw: () => void;
  onPass: (cardUid: string, targetId: string, claimedDefId: string, rotation: number) => void;
  onAccept: () => void;
  onCallBluff: () => void;
  onLeave: () => void;
  bluffResult: BluffResolution | null;
}

interface SeatPos {
  left: number;
  top: number;
}

const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

/** Calcula las posiciones de los asientos alrededor de la mesa (yo abajo). */
function calcSeats(order: string[], myId: string): Record<string, SeatPos> {
  const n = order.length;
  const ring = n >= 7 ? 33 : 36;
  const seats: Record<string, SeatPos> = {};
  const others = order.filter((id) => id !== myId);
  const meIdx = order.indexOf(myId);

  if (n <= 5) {
    seats[myId] = { left: 50, top: +(50 + ring).toFixed(2) };
    const m = others.length;
    const spacing = Math.PI / (m + 1);
    others.forEach((id, j) => {
      const angle = -Math.PI / 2 + (j + 1 - (m + 1) / 2) * spacing;
      seats[id] = {
        left: +(50 + ring * Math.cos(angle)).toFixed(2),
        top: +(50 + ring * Math.sin(angle)).toFixed(2),
      };
    });
  } else {
    order.forEach((id, i) => {
      const angle = -Math.PI / 2 + ((i - meIdx) * 2 * Math.PI) / n;
      seats[id] = {
        left: +(50 + ring * Math.cos(angle)).toFixed(2),
        top: +(50 + ring * Math.sin(angle)).toFixed(2),
      };
    });
  }
  return seats;
}

/** Rotación (0-7) que apunta del asiento A al asiento B en la brújula de la mesa. */
function rotationTowards(from: SeatPos, to: SeatPos): number {
  const deg = (Math.atan2(to.top - from.top, to.left - from.left) * 180) / Math.PI;
  return (((Math.round((deg + 90) / 45) % 8) + 8) % 8);
}

/** Jugador más cercano a la dirección de la flecha (rotación) desde mi asiento. */
function targetForRotation(
  rotation: number,
  myId: string,
  order: string[],
  seats: Record<string, SeatPos>,
): string | null {
  let best: string | null = null;
  let bestDist = 99;
  for (const id of order) {
    if (id === myId) continue;
    const rt = rotationTowards(seats[myId], seats[id]);
    let d = Math.abs(rt - rotation);
    if (d > 4) d = 8 - d;
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}

export default function GameBoard({
  state,
  playerId,
  onDraw,
  onPass,
  onAccept,
  onCallBluff,
  onLeave,
  bluffResult,
}: Props) {
  const me = state.players[playerId];

  const seats = useMemo(() => calcSeats(state.order, playerId), [state.order, playerId]);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selRotation, setSelRotation] = useState<number>(0);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const [flight, setFlight] = useState<(SeatPos & { mounted: boolean }) | null>(null);

  useEffect(() => {
    setSelectedCardId(null);
    setSelectedTarget(null);
    setClaimOpen(false);
    setSelectedClaim(null);
  }, [state.currentTurnId, state.pendingOffer, state.pendingFirstDraw]);

  useEffect(() => {
    if (!flight) return;
    const t = window.setTimeout(() => setFlight(null), 800);
    return () => window.clearTimeout(t);
  }, [flight]);

  const isMyTurn = state.currentTurnId === playerId;
  const offerToMe = state.pendingOffer?.toPlayerId === playerId ? state.pendingOffer : null;
  const offerFromMe = state.pendingOffer?.fromPlayerId === playerId ? state.pendingOffer : null;
  const mustDraw = !!state.pendingFirstDraw && isMyTurn;
  const canAct =
    !!me?.alive && isMyTurn && !state.pendingOffer && !state.pendingFirstDraw && me.cards.length > 0;

  const selected: PublicCard | null = useMemo(
    () => me?.cards.find((c) => c.uid === selectedCardId) ?? null,
    [me, selectedCardId],
  );

  const startFlight = (targetId: string) => {
    const target = seats[targetId];
    const start: SeatPos = { left: 50, top: 94 };
    setFlight({ ...start, mounted: false });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setFlight({ ...target, mounted: true })),
    );
  };

  const pickCard = (id: string) => {
    if (!canAct) return;
    const card = me?.cards.find((c) => c.uid === id);
    if (!card) return;
    setSelectedCardId(id);
    setSelRotation(card.rotation);
    setSelectedTarget(targetForRotation(card.rotation, playerId, state.order, seats));
    setSelectedClaim(card.knownClaimDefId);
  };

  const rotate = (dir: 1 | -1) => {
    if (!selected) return;
    const next = (selRotation + dir + 8) % 8;
    setSelRotation(next);
    setSelectedTarget(targetForRotation(next, playerId, state.order, seats));
  };

  const pickTarget = (id: string) => {
    if (!selected) return;
    const rot = rotationTowards(seats[playerId], seats[id]);
    setSelRotation(rot);
    setSelectedTarget(id);
  };

  const confirmPass = (claim: string | null) => {
    if (!selectedCardId || !selectedTarget || !claim) return;
    startFlight(selectedTarget);
    onPass(selectedCardId, selectedTarget, claim, selRotation);
    setSelectedCardId(null);
    setSelectedTarget(null);
    setSelectedClaim(null);
    setClaimOpen(false);
  };

  const current = state.currentTurnId ? state.players[state.currentTurnId] : null;

  return (
    <div
      className="min-h-full w-full flex flex-col gap-3 px-3 pb-6 pt-3"
      style={{ maxWidth: 880, margin: '0 auto' }}
    >
      {/* Cabecera */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-bold tracking-widest text-accent">{state.roomCode}</span>
          <span className="text-xs text-slate-500">Turn {state.turnNumber}</span>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-slate-400">
            Deck · {state.deckCount}
          </span>
        </div>
        <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={onLeave}>
          Leave
        </button>
      </header>

      {/* Mesa circular */}
      <main className="relative mx-auto aspect-square w-full max-w-[560px]">
        <div className="table-disc absolute inset-0 rounded-full border border-line/60" />

        {/* Centro de la mesa */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center">
          <CenterPile
            state={state}
            current={current}
            isMyTurn={isMyTurn}
            mustDraw={mustDraw}
            onDraw={onDraw}
          />
        </div>

        {/* Asientos */}
        {state.order.map((id) => {
          const p = state.players[id];
          const pos = seats[id];
          const clickable = !!selected && p.alive && id !== playerId;
          const highlighted = selectedTarget === id;
          return (
            <div
              key={id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
            >
              <Seat
                player={p}
                pos={pos}
                isMe={id === playerId}
                isTurn={state.currentTurnId === id}
                clickable={clickable}
                highlighted={highlighted}
                onClickTarget={() => pickTarget(id)}
                hasOffer={state.pendingOffer?.toPlayerId === id}
              />
            </div>
          );
        })}

        {/* Carta volando hacia el destino (siempre boca abajo) */}
        {flight && (
          <div
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${flight.left}%`,
              top: `${flight.top}%`,
              transition: flight.mounted ? 'left .7s ease, top .7s ease' : 'none',
            }}
          >
            <MiniCard />
          </div>
        )}
      </main>

      {/* Mis cartas */}
      <section className="relative z-10 rounded-2xl border border-line bg-panel/80 p-3 backdrop-blur">
        <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
          Your cards · {me?.cardCount ?? 0}
          {mustDraw && <span className="ml-2 text-accent">draw first!</span>}
        </div>
        {me && me.cards.length > 0 ? (
          <div className="flex flex-wrap items-end justify-center gap-2 sm:gap-2.5">
            {me.cards.map((c) => {
              const isSelected = selectedCardId === c.uid;
              return (
                <button
                  key={c.uid}
                  onClick={() => pickCard(c.uid)}
                  disabled={!canAct}
                  className={`relative transition-all duration-200 ${
                    isSelected ? '-translate-y-3 z-10' : canAct ? 'cursor-pointer hover:-translate-y-2' : ''
                  }`}
                >
                  <CardView card={c} faceUp={c.isPublic} selected={!!isSelected} big />
                  {isSelected && (
                    <span className="pointer-events-none absolute -bottom-2.5 left-1/2 -translate-x-1/2 text-lg font-bold text-accent">
                      {ARROWS[selRotation]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">
            {mustDraw ? 'Draw a card from the center to start!' : 'No cards — the deck will refill you.'}
          </p>
        )}

        {/* Control de flecha y destino */}
        {selected && canAct && (
          <div className="mx-auto mt-3 flex max-w-sm flex-wrap items-center justify-center gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2 text-sm">
            <button className="btn-ghost !px-2 !py-1" onClick={() => rotate(-1)} title="Rotate left">
              ↺
            </button>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              arrow <span className="text-lg text-accent">{ARROWS[selRotation]}</span>
            </span>
            <button className="btn-ghost !px-2 !py-1" onClick={() => rotate(1)} title="Rotate right">
              ↻
            </button>
            <button
              className="btn-primary !py-1.5 text-xs"
              disabled={!selectedTarget}
              onClick={() => setClaimOpen(true)}
            >
              Pass to {selectedTarget ? state.players[selectedTarget]?.name : '…'} →
            </button>
          </div>
        )}
      </section>

      {/* Pista de acción */}
      <div className="text-center text-sm text-slate-400">
        {offerFromMe ? (
          <span className="animate-fade-up">
            Waiting for {state.players[offerFromMe.toPlayerId]?.name ?? '…'} to respond…
          </span>
        ) : mustDraw ? (
          <span className="animate-pulse font-semibold text-accent">
            Tap the deck in the center to draw &amp; reveal a card.
          </span>
        ) : canAct && !selected ? (
          <span>
            Tap a card, aim the <span className="text-accent">arrow</span> (↺ ↻ or tap a person), then claim it out loud.
          </span>
        ) : canAct && selected && !claimOpen ? (
          <span>
            Aiming at{' '}
            <span className="text-accent">
              {selectedTarget ? state.players[selectedTarget]?.name : '…'}
            </span>{' '}
            — press “Pass to …” to claim.
          </span>
        ) : (
          <span>
            {state.pendingFirstDraw ? (
              <>
                Waiting for <span className="text-accent">{current?.name ?? '…'}</span> to draw first…
              </>
            ) : (
              <>
                Waiting for <span className="text-accent">{current?.name ?? '…'}</span>'s turn…
              </>
            )}
          </span>
        )}
      </div>

      <GameLog state={state} />

      {/* Modales */}
      {offerToMe && <OfferModal state={state} offer={offerToMe} onAccept={onAccept} onCallBluff={onCallBluff} />}
      {bluffResult && <BluffResult r={bluffResult} state={state} />}
      {claimOpen && selected && selectedTarget && (
        <ClaimChooser
          state={state}
          selectedCard={selected}
          selectedTarget={selectedTarget}
          selectedClaim={selectedClaim}
          onSelectClaim={setSelectedClaim}
          onConfirm={() => confirmPass(selectedClaim)}
          onCancel={() => setClaimOpen(false)}
          onTruth={() => selected.defId && setSelectedClaim(selected.defId)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CenterPile({
  state,
  current,
  isMyTurn,
  mustDraw,
  onDraw,
}: {
  state: PublicGameState;
  current: PublicGameState['players'][string] | null;
  isMyTurn: boolean;
  mustDraw: boolean;
  onDraw: () => void;
}) {
  if (state.pendingOffer) {
    const from = state.players[state.pendingOffer.fromPlayerId];
    const to = state.players[state.pendingOffer.toPlayerId];
    return (
      <div className="flex flex-col items-center gap-1.5 animate-fade-up">
        <MiniCard />
        <div className="rounded-full bg-ink/70 px-3 py-1 text-[11px] font-medium text-slate-300">
          <span className="text-accent">{from?.name}</span> claims it's a{' '}
          <span className="font-bold text-slate-100">
            {state.pendingOffer.claimedName} {state.pendingOffer.claimedEmoji}
          </span>{' '}
          → <span className="text-accent">{to?.name}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-4">
      <button
        disabled={!mustDraw}
        onClick={onDraw}
        className={`card-back relative flex h-16 w-12 flex-col items-center justify-center rounded-lg border border-line bg-gradient-to-br from-surface to-panel shadow-lg sm:h-20 sm:w-14 ${
          mustDraw ? 'cursor-pointer ring-2 ring-accent hover:scale-105' : ''
        }`}
        title={mustDraw ? 'Draw and reveal a card' : `Deck · ${state.deckCount} cards`}
      >
        <span className="text-xl sm:text-2xl">🎴</span>
        <span className="absolute -right-2 -top-2 rounded-full bg-accent px-1.5 text-[10px] font-bold text-ink">
          {state.deckCount}
        </span>
      </button>

      <div className="mt-1.5">
        {mustDraw ? (
          <p className="font-display text-sm font-bold text-accent animate-pulse">
            Your turn — tap the deck to draw
          </p>
        ) : isMyTurn ? (
          <p className="font-display text-lg font-bold text-accent animate-pulse">Your turn</p>
        ) : (
          <p className="font-display text-sm font-bold text-slate-300">
            {current?.name ?? '…'}
            <span className="block text-[10px] font-normal text-slate-500">
              {state.pendingFirstDraw ? 'must draw first' : state.pendingOffer ? 'has passed a card' : 'is passing a card'}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

/** Carta individual (cara pública o dorso). El dorso muestra la afirmación conocida. */
function CardView({
  card,
  faceUp,
  selected,
  big,
}: {
  card: PublicCard;
  faceUp: boolean;
  selected: boolean;
  big?: boolean;
}) {
  const def = faceUp && card.defId ? cardDef(card.defId) : null;
  const known = card.knownClaimDefId ? cardDef(card.knownClaimDefId) : null;
  const size = big ? 'h-24 w-16 sm:h-28 sm:w-20' : 'h-10 w-7';

  if (faceUp && def) {
    return (
      <div
        className={`card-back flex ${size} flex-col items-center justify-center gap-0.5 rounded-lg border bg-panel p-1 text-center shadow transition-all ${
          selected ? 'ring-2 ring-accent' : 'border-line'
        }`}
      >
        <span className="text-2xl drop-shadow sm:text-3xl">{def.emoji}</span>
        <span className="max-w-full truncate text-[9px] font-semibold sm:text-[10px]">{def.name}</span>
        {def.rarity === 'rare' && (
          <span className="absolute right-1 top-1 text-[9px]" title="Rare">✨</span>
        )}
      </div>
    );
  }

  // Boca abajo: no se sabe qué es, solo lo que te afirmaron al pasarla.
  return (
    <div
      className={`relative flex ${size} flex-col items-center justify-center rounded-lg border border-line bg-gradient-to-br from-surface to-panel shadow ${selected ? 'ring-2 ring-accent' : ''} ${big ? 'p-1' : ''}`}
      title={known ? `Told: ${known.name} (but you don't look)` : 'Unknown card'}
    >
      <span className={big ? 'text-xl sm:text-2xl' : 'text-sm'}>🎴</span>
      {big && known && (
        <span className="mt-0.5 max-w-full truncate rounded bg-ink/60 px-1 text-[8px] font-semibold text-slate-300">
          “{known.emoji} {known.name}”?
        </span>
      )}
      <span className="absolute right-0.5 top-0.5 text-[8px] text-slate-500">{ARROWS[card.rotation]}</span>
    </div>
  );
}

function MiniCard() {
  return (
    <div className="flex h-16 w-12 flex-col items-center justify-center gap-0.5 rounded-lg border border-line text-center shadow-lg sm:h-20 sm:w-14 bg-gradient-to-br from-surface to-panel">
      <span className="text-xl sm:text-2xl">🎴</span>
    </div>
  );
}

function MiniStack({ count }: { count: number }) {
  return (
    <div className="relative h-7 w-6">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute h-7 w-5 rounded bg-gradient-to-br from-surface to-panel border border-line"
          style={{ left: i * 1.5 - 3, top: i * -1.5 }}
        />
      ))}
      <span className="absolute -right-2 -top-2 rounded-full bg-accent px-1 text-[9px] font-bold text-ink">
        {count}
      </span>
    </div>
  );
}

/** Cartas de un rival junto a su asiento (boca arriba las públicas, dorso las ocultas). */
function SeatCards({ player }: { player: PublicPlayer }) {
  if (player.cardCount === 0) return <div className="h-4" />;
  const publics = player.cards.filter((c) => c.isPublic);
  const secretCount = player.cardCount - publics.length;
  return (
    <div className="flex items-center justify-center gap-0.5">
      {publics.slice(0, 5).map((c) => (
        <div key={c.uid}>
          <CardView card={c} faceUp selected={false} />
        </div>
      ))}
      {publics.length > 5 && (
        <span className="rounded-full bg-ink/70 px-1 text-[9px] font-bold text-slate-300">
          +{publics.length - 5}
        </span>
      )}
      {secretCount > 0 && <MiniStack count={secretCount} />}
    </div>
  );
}

function Seat({
  player,
  pos,
  isMe,
  isTurn,
  clickable,
  highlighted,
  onClickTarget,
  hasOffer,
}: {
  player: PublicPlayer;
  pos: SeatPos;
  isMe: boolean;
  isTurn: boolean;
  clickable: boolean;
  highlighted: boolean;
  onClickTarget: () => void;
  hasOffer: boolean;
}) {
  const eliminated = !player.alive;
  const initial = (player.name[0] ?? '?').toUpperCase();
  // Las cartas se colocan hacia el centro de la mesa para no salirse del tablero.
  const topHalf = pos.top < 50;
  const cardsRow = (
    <div className="pointer-events-none">
      <SeatCards player={player} />
    </div>
  );

  return (
    <div
      onClick={clickable ? onClickTarget : undefined}
      className={`flex flex-col items-center gap-0.5 transition-transform duration-200 ${
        clickable ? 'cursor-pointer' : ''
      } ${highlighted ? 'scale-110' : ''}`}
    >
      {topHalf ? (
        <>
          {cardsRow}
          <AvatarPlate />
        </>
      ) : (
        <>
          <AvatarPlate />
          {cardsRow}
        </>
      )}
    </div>
  );

  function AvatarPlate() {
    return (
      <>
        <div
          className={`seat-ghost ${isTurn && !eliminated ? 'seat-ring' : ''} ${
            isMe ? '!border-mint/70 !text-mint' : ''
          } ${eliminated ? 'opacity-50 grayscale' : ''} ${hasOffer ? 'animate-pulse' : ''} ${
            highlighted ? '!ring-2 !ring-accent !border-accent' : ''
          }`}
        >
          {eliminated ? '☠' : initial}
        </div>
        <div
          className={`rounded-full bg-ink/70 px-2 py-0.5 text-center text-[10px] font-semibold backdrop-blur ${
            isMe ? 'text-mint' : isTurn ? 'text-accent' : 'text-slate-300'
          }`}
        >
          <span className="inline-block max-w-[64px] truncate align-middle">{player.name}</span>
          {player.isHost && <span className="ml-1 align-middle text-[8px] text-accent">★</span>}
        </div>
        <div className="text-[11px] leading-none">
          {eliminated ? (
            <span className="font-bold tracking-widest text-slate-500">ELIMINATED</span>
          ) : (
            <span className="drop-shadow">
              {Array.from({ length: Math.max(0, player.lives) }).map((_, i) => (
                <span key={i}>❤️</span>
              ))}
            </span>
          )}
        </div>
      </>
    );
  }
}

function ClaimChooser({
  state,
  selectedCard,
  selectedTarget,
  selectedClaim,
  onSelectClaim,
  onConfirm,
  onCancel,
  onTruth,
}: {
  state: PublicGameState;
  selectedCard: PublicCard;
  selectedTarget: string;
  selectedClaim: string | null;
  onSelectClaim: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onTruth: () => void;
}) {
  const known = selectedCard.knownClaimDefId ? cardDef(selectedCard.knownClaimDefId) : null;
  const targetName = state.players[selectedTarget]?.name ?? '…';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5 text-center animate-card-in">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          Passing to {targetName}
        </p>

        <div className="my-4 flex items-center justify-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-slate-500">Handing over</span>
            {selectedCard.isPublic && selectedCard.defId ? (
              <MiniCard />
            ) : (
              <div className="flex h-16 w-12 flex-col items-center justify-center rounded-lg border border-line bg-gradient-to-br from-surface to-panel text-sm sm:h-20 sm:w-14">
                🎴
              </div>
            )}
          </div>
          <span className="text-2xl text-slate-500">→</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-slate-500">You claim</span>
            {selectedClaim ? (
              <CardView
                card={{
                  uid: 'claim',
                  isPublic: true,
                  rotation: 0,
                  knownClaimDefId: selectedClaim,
                  knownClaimName: cardDef(selectedClaim).name,
                  knownClaimEmoji: cardDef(selectedClaim).emoji,
                  defId: selectedClaim,
                }}
                faceUp
                selected={false}
              />
            ) : (
              <div className="flex h-16 w-12 items-center justify-center rounded-lg border border-line bg-surface text-xl text-slate-500 sm:h-20 sm:w-14">
                ?
              </div>
            )}
          </div>
        </div>

        <p className="mb-2 text-xs text-slate-400">Claim it is…</p>
        <div className="grid max-h-56 grid-cols-5 gap-1.5 overflow-y-auto">
          {CARD_DEFS.map((d) => (
            <button
              key={d.id}
              onClick={() => onSelectClaim(d.id)}
              className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-lg transition-all ${
                selectedClaim === d.id ? 'border-accent bg-accent/15' : 'border-line bg-surface hover:border-slate-400'
              }`}
              title={d.name}
            >
              <span>{d.emoji}</span>
              <span className="text-[9px] font-semibold leading-none">{d.name}</span>
            </button>
          ))}
        </div>

        {selectedCard.isPublic && selectedCard.defId && (
          <button className="mt-2 w-full text-xs text-slate-400 underline-offset-2 hover:text-mint hover:underline" onClick={onTruth}>
            Tell the truth — this is a {cardDef(selectedCard.defId).name.toLowerCase()}
          </button>
        )}
        {!selectedCard.isPublic && known && (
          <p className="mt-2 text-[11px] text-slate-500">
            You were told it's a {known.name} {known.emoji} — choose a claim from memory!
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button className="btn-ghost flex-1" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary flex-1" disabled={!selectedClaim} onClick={onConfirm}>
            Pass it!
          </button>
        </div>
      </div>
    </div>
  );
}

function OfferModal({
  state,
  offer,
  onAccept,
  onCallBluff,
}: {
  state: PublicGameState;
  offer: PublicGameState['pendingOffer'] & {};
  onAccept: () => void;
  onCallBluff: () => void;
}) {
  const fromName = state.players[offer.fromPlayerId]?.name ?? 'A player';
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm animate-fade-up">
      <div className="w-full max-w-xs rounded-2xl border border-line bg-panel p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          {fromName} says…
        </p>
        <div className="my-5 flex flex-col items-center gap-2">
          <div className="flex h-28 w-20 flex-col items-center justify-center rounded-xl border-2 border-accent/60 bg-ink shadow-2xl">
            <span className="text-5xl">{offer.claimedEmoji}</span>
          </div>
          <p className="font-display text-lg font-bold">
            This is a {offer.claimedName.toLowerCase()}
          </p>
          <p className="text-xs text-slate-500">You only see what {fromName} claims.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-primary flex-1" onClick={onAccept}>
            ACCEPT
          </button>
          <button className="btn-danger flex-1" onClick={onCallBluff}>
            CALL BLUFF
          </button>
        </div>
      </div>
    </div>
  );
}

function BluffResult({ r, state }: { r: BluffResolution; state: PublicGameState }) {
  const actual = cardDef(r.actualDefId);
  const truth = r.claimed;
  const [flipped, setFlipped] = useState(false);
  const [showVerdict, setShowVerdict] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setFlipped(true), 150);
    const t2 = window.setTimeout(() => setShowVerdict(true), 700);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm">
      <div className="text-center animate-fade-up">
        <div className="flip-card mx-auto mb-8 h-40 w-28 sm:h-48 sm:w-36">
          <div className={`flip-inner relative h-full w-full ${flipped ? 'is-flipped' : ''}`}>
            {/* Cara oculta */}
            <div className="flip-face absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-line bg-gradient-to-br from-surface to-panel">
              <span className="text-5xl">🎴</span>
            </div>
            {/* Cara revelada */}
            <div className="flip-face flip-front absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-accent bg-panel shadow-2xl">
              <span className="text-6xl">{actual.emoji}</span>
              <span className="font-display text-lg font-bold">{actual.name}</span>
            </div>
          </div>
        </div>

        <div
          className={`font-display text-5xl font-black tracking-wide transition-all duration-300 ${
            showVerdict ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
          } ${truth ? 'text-mint' : 'text-coral'}`}
        >
          {truth ? 'TRUTH' : 'BLUFF!'}
        </div>
        <p
          className={`mt-3 text-sm text-slate-400 transition-all duration-300 delay-100 ${
            showVerdict ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          {state.players[r.loserId]?.name ?? '…'} lost a life
        </p>
      </div>
    </div>
  );
}

function GameLog({ state }: { state: PublicGameState }) {
  const latest = [...state.log].slice(-25).reverse();
  const color = (t: string) =>
    t === 'lost' || t === 'eliminated' || t === 'bluff'
      ? 'text-coral'
      : t === 'win'
        ? 'text-accent'
        : t === 'gain' || t === 'truth'
          ? 'text-mint'
          : 'text-slate-400';
  return (
    <details className="panel !p-3 open:pb-2" open={false}>
      <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
        Game log
      </summary>
      <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto pr-1 text-sm">
        {latest.length === 0 && <li className="text-slate-500">No events yet.</li>}
        {latest.map((l) => (
          <li key={`${l.at}-${l.text}`} className={color(l.type)}>
            {l.text}
          </li>
        ))}
      </ul>
    </details>
  );
}