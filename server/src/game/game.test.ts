import { describe, expect, it } from 'vitest';
import type { GameError, GameOk } from './game';
import {
  acceptCard,
  addPlayer,
  buildDeck,
  callBluff,
  checkWinner,
  createGame,
  drawCard,
  getPassableCards,
  getValidTargets,
  passCard,
  removePlayer,
  startGame,
  MAX_PLAYERS,
  MIN_PLAYERS,
} from './game';

function assertOk<T>(r: GameError | GameOk<T>): GameOk<T> {
  expect(r.ok).toBe(true);
  return r as GameOk<T>;
}

function makeLobby(numPlayers: number) {
  const state = createGame('X7K92', 'Host', 'p1');
  for (let i = 2; i <= numPlayers; i++) {
    assertOk(addPlayer(state, `p${i}`, `P${i}`));
  }
  return state;
}

describe('createGame', () => {
  it('crea una sala en lobby con un host', () => {
    const s = createGame('AB12C', 'Alex', 'a1');
    expect(s.status).toBe('lobby');
    expect(s.players['a1'].isHost).toBe(true);
    expect(s.players['a1'].lives).toBe(3);
    expect(s.roomCode).toBe('AB12C');
  });
});

describe('addPlayer', () => {
  it('agrega jugadores', () => {
    const s = createGame('A', 'host', 'h');
    expect(addPlayer(s, 'p2', 'Diego').ok).toBe(true);
    expect(Object.keys(s.players).length).toBe(2);
  });

  it('rechaza cuando la sala está llena', () => {
    const s = makeLobby(MAX_PLAYERS);
    const res = addPlayer(s, 'extra', 'Extra');
    expect(res.ok).toBe(false);
  });

  it('rechaza unirse si la partida ya empezó', () => {
    const s = makeLobby(4);
    expect(startGame(s).ok).toBe(true);
    const res = addPlayer(s, 'x', 'Late');
    expect(res.ok).toBe(false);
  });
});

describe('startGame', () => {
  it('no permite comenzar con menos de 2 jugadores', () => {
    const s = createGame('A', 'host', 'h');
    const res = startGame(s);
    expect(res.ok).toBe(false);
  });

  it('reparte 1 carta boca arriba a cada jugador', () => {
    const s = makeLobby(4);
    const res = startGame(s);
    expect(res.ok).toBe(true);
    expect(s.status).toBe('playing');
    for (const p of Object.values(s.players)) {
      expect(p.cards.length).toBe(1);
      expect(p.cards[0].isPublic).toBe(true);
      expect(p.cards[0].knownClaimDefId).toBe(p.cards[0].defId);
    }
    expect(s.currentTurnId).toBe('p1');
    expect(s.pendingFirstDraw).toBe(true);
  });

  it('el orden de turno rota', () => {
    const s = makeLobby(3);
    startGame(s);
    expect(s.order).toEqual(['p1', 'p2', 'p3']);
    expect(s.currentTurnId).toBe('p1');
  });
});

describe('primer robo (drawCard)', () => {
  it('el jugador inicial roba y revela una carta boca arriba', () => {
    const s = makeLobby(2);
    startGame(s);
    const deckBefore = s.deck.length;
    const res = assertOk(drawCard(s, 'p1'));
    expect(res.value.currentTurnId).toBe('p1');
    expect(s.players['p1'].cards.length).toBe(2); // la inicial + la robada
    const drawn = s.players['p1'].cards[1];
    expect(drawn.isPublic).toBe(true);
    expect(drawn.knownClaimDefId).toBe(drawn.defId);
    expect(s.pendingFirstDraw).toBe(false);
    expect(s.deck.length).toBe(deckBefore - 1);
  });

  it('solo el jugador activo puede robar y solo una vez', () => {
    const s = makeLobby(2);
    startGame(s);
    expect(drawCard(s, 'p2').ok).toBe(false);
    expect(drawCard(s, 'p1').ok).toBe(true);
    expect(drawCard(s, 'p1').ok).toBe(false); // ya se hizo
  });
});

describe('turnos y pasar cartas', () => {
  it('solo el jugador activo puede pasar una carta', () => {
    const s = makeLobby(3);
    startGame(s);
    drawCard(s, 'p1');
    const giver = s.players['p1'];
    const card = giver.cards[0];
    const res1 = passCard(s, 'p2', card.uid, 'p3', 'apple') as GameError;
    expect(res1.ok).toBe(false);
    expect(res1.error).toContain('not your turn');

    const res2 = passCard(s, 'p1', card.uid, 'p3', card.defId);
    expect(res2.ok).toBe(true);
    expect(s.pendingOffer).toBeTruthy();
  });

  it('no permite pasar una carta que no posees', () => {
    const s = makeLobby(3);
    startGame(s);
    drawCard(s, 'p1');
    const res = passCard(s, 'p1', 'no-existe', 'p3', 'apple');
    expect(res.ok).toBe(false);
  });

  it('no permite pasarse la carta a uno mismo', () => {
    const s = makeLobby(3);
    startGame(s);
    drawCard(s, 'p1');
    const card = s.players['p1'].cards[0];
    const res = passCard(s, 'p1', card.uid, 'p1', 'apple');
    expect(res.ok).toBe(false);
  });

  it('los destinos válidos excluyen al propio jugador', () => {
    const s = makeLobby(3);
    startGame(s);
    const targets = getValidTargets(s, 'p1');
    expect(targets).toEqual(['p2', 'p3']);
  });

  it('ajusta la rotación de la flecha al pasar', () => {
    const s = makeLobby(2);
    startGame(s);
    drawCard(s, 'p1');
    const card = s.players['p1'].cards[0];
    passCard(s, 'p1', card.uid, 'p2', card.defId, 3);
    expect(s.pendingOffer?.card.rotation).toBe(3);
  });
});

describe('aceptar carta', () => {
  it('la carta llega boca abajo y se conserva la afirmación', () => {
    const s = makeLobby(3);
    startGame(s);
    drawCard(s, 'p1');
    const giver = s.players['p1'];
    const card = giver.cards[0];
    passCard(s, 'p1', card.uid, 'p2', 'apple');
    const res = acceptCard(s, 'p2');
    expect(res.ok).toBe(true);
    expect(s.pendingOffer).toBeNull();
    const received = s.players['p2'].cards.find((c) => c.uid === card.uid);
    expect(received).toBeTruthy();
    // boca abajo: nadie la mira
    expect(received!.isPublic).toBe(false);
    expect(received!.knownClaimDefId).toBe('apple');
    expect(s.currentTurnId).not.toBe('p1');
  });

  it('solo el destinatario puede aceptar', () => {
    const s = makeLobby(3);
    startGame(s);
    drawCard(s, 'p1');
    const card = s.players['p1'].cards[0];
    passCard(s, 'p1', card.uid, 'p2', card.defId);
    const res = acceptCard(s, 'p3');
    expect(res.ok).toBe(false);
  });
});

describe('callBluff', () => {
  it('detecta una mentira: el remitente pierde la vida y la carta se revela', () => {
    const s = makeLobby(2);
    startGame(s);
    drawCard(s, 'p1');
    const giver = s.players['p1'];
    const card = giver.cards[0];
    const falseClaim = card.defId === 'apple' ? 'guitar' : 'apple';
    passCard(s, 'p1', card.uid, 'p2', falseClaim);
    const livesBefore = s.players['p1'].lives;
    const res = assertOk(callBluff(s, 'p2'));
    expect(res.value.resolution.claimed).toBe(false);
    expect(s.players['p1'].lives).toBe(livesBefore - 1);
    const revealed = s.players['p2'].cards.find((c) => c.uid === card.uid);
    expect(revealed!.isPublic).toBe(true);
    expect(revealed!.defId).toBe(card.defId);
  });

  it('detecta la verdad: el receptor pierde la vida', () => {
    const s = makeLobby(2);
    startGame(s);
    drawCard(s, 'p1');
    const giver = s.players['p1'];
    const card = giver.cards[0];
    passCard(s, 'p1', card.uid, 'p2', card.defId);
    const livesBefore = s.players['p2'].lives;
    const res = assertOk(callBluff(s, 'p2'));
    expect(res.value.resolution.claimed).toBe(true);
    expect(s.players['p2'].lives).toBe(livesBefore - 1);
  });
});

/**
 * Avanza un paso del juego: el jugador activo (robando primero si toca) pasa
 * una carta verdadera al primer destino vivo y este llama bluff -> verdad ->
 * el receptor pierde una vida. Devuelve false si el juego ya terminó.
 */
function playTruthRound(s: ReturnType<typeof makeLobby>): boolean {
  if (s.status === 'finished') return false;
  const turnId = s.currentTurnId;
  if (!turnId) return false;
  if (s.pendingFirstDraw) {
    if (!drawCard(s, turnId).ok) return false;
  }
  const giver = s.players[turnId];
  const card = giver.cards[0];
  const targets = getValidTargets(s, turnId);
  if (targets.length === 0) return false;
  const targetId = targets[0];
  const tr = passCard(s, turnId, card.uid, targetId, card.defId);
  if (!tr.ok) return false;
  const recv = s.players[targetId];
  const livesBefore = recv.lives;
  const cb = callBluff(s, targetId);
  expect(cb.ok).toBe(true);
  if (livesBefore > 0) {
    expect(recv.lives).toBe(livesBefore - 1);
  }
  return true;
}

describe('eliminación y victoria', () => {
  it('elimina a un jugador que llega a 0 vidas', () => {
    const s = makeLobby(4);
    startGame(s);
    let guard = 0;
    while (s.players['p2'].alive && guard < 200) {
      if (!playTruthRound(s)) break;
      guard++;
    }
    expect(s.players['p2'].alive).toBe(false);
    expect(s.players['p2'].lives).toBe(0);
  });

  it('declara ganador cuando queda un solo vivo', () => {
    const s = makeLobby(4);
    startGame(s);
    let guard = 0;
    while (s.status !== 'finished' && guard < 300) {
      playTruthRound(s);
      guard++;
    }
    expect(s.status).toBe('finished');
    const alive = Object.values(s.players).filter((p) => p.alive);
    expect(alive.length).toBe(1);
    expect(s.winnerId).toBe(alive[0].id);
    expect(checkWinner(s)).toBe(alive[0].id);
  });

  it('suministra carta de emergencia a un jugador sin cartas', () => {
    const s = makeLobby(3);
    startGame(s);
    expect(drawCard(s, 'p1').ok).toBe(true);
    let guard = 0;
    let sawEmergency = false;
    // Todos pasan siempre a p1/p2: p3 nunca recibe cartas.
    while (s.status === 'playing' && guard < 30) {
      const turn = s.currentTurnId!;
      const target = turn === 'p2' ? 'p1' : 'p2';
      const card = s.players[turn].cards[0];
      expect(passCard(s, turn, card.uid, target, 'apple').ok).toBe(true);
      expect(acceptCard(s, target).ok).toBe(true);
      expect(s.currentTurnId).not.toBe(turn);
      if (s.players['p3'].cards.some((c) => !c.isPublic)) sawEmergency = true;
      guard++;
    }
    // p3 solo tuvo su carta inicial (pública): toda carta oculta = robo de emergencia.
    expect(s.players['p3'].alive).toBe(true);
    expect(sawEmergency).toBe(true);
  });
});

describe('removePlayer y host', () => {
  it('transfiere el host cuando el host se va', () => {
    const s = makeLobby(3);
    const res = assertOk(removePlayer(s, 'p1'));
    expect(res.value.newHostId).toBe('p2');
    expect(s.players['p2'].isHost).toBe(true);
  });

  it('no rompe si queda un solo jugador', () => {
    const s = makeLobby(2);
    const res = removePlayer(s, 'p1');
    expect(res.ok).toBe(true);
    expect(s.players['p2'].isHost).toBe(true);
  });
});

describe('buildDeck', () => {
  it('construye una baraja del tamaño pedido', () => {
    const d = buildDeck(40);
    expect(d.length).toBe(40);
  });
});

it('getPassableCards devuelve las cartas del jugador', () => {
  const s = makeLobby(2);
  startGame(s);
  expect(getPassableCards(s, 'p1').length).toBe(1);
  expect(MIN_PLAYERS).toBe(2);
});