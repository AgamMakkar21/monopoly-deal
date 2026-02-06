'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  Crown,
  HandCoins,
  Layers3,
  ShieldAlert,
  SkipForward,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import Card, { type CardData } from './Card';

type PlayerView = {
  id: string;
  name: string;
  handCount: number;
  hand: CardData[];
  bank: CardData[];
  bankTotal: number;
  properties: Record<string, CardData[]>;
  fullSets: string[];
};

type PendingReaction = {
  id: string;
  sourcePlayerId: string;
  targetPlayerIds: string[];
  actionType: string;
  expiresAt: number;
  amount: number | null;
};

type PendingTurnDraw = {
  playerId: string;
  count: number;
};

type PendingPaymentEntry = {
  payerId: string;
  amount: number;
  paid: number | null;
  done: boolean;
};

type PendingPayment = {
  id: string;
  sourcePlayerId: string;
  receiverPlayerId: string;
  actionType: string;
  reason: string;
  currentPayerId: string | null;
  amountDue: number;
  queue: PendingPaymentEntry[];
};

type GameState = {
  roomId: string;
  started: boolean;
  hostId: string;
  currentPlayerId: string | null;
  cardsPlayedThisTurn: number;
  deckCount: number;
  discardCount: number;
  pendingTurnDraw: PendingTurnDraw | null;
  pendingReaction: PendingReaction | null;
  pendingPayment: PendingPayment | null;
  winnerId: string | null;
  lastEvent: string;
  players: PlayerView[];
};

type TableCardEntry = {
  card: CardData;
  zone: 'bank' | 'property';
  color?: string;
};

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
const PROPERTY_COLORS = [
  'brown',
  'light_blue',
  'pink',
  'orange',
  'red',
  'yellow',
  'green',
  'blue',
  'railroad',
  'utility',
] as const;

const SET_BADGE: Record<string, string> = {
  brown: 'bg-amber-700/80',
  light_blue: 'bg-sky-400/85',
  pink: 'bg-pink-500/85',
  orange: 'bg-orange-500/85',
  red: 'bg-red-600/85',
  yellow: 'bg-yellow-400/90 text-zinc-900',
  green: 'bg-emerald-600/85',
  blue: 'bg-blue-700/85',
  railroad: 'bg-zinc-800/85',
  utility: 'bg-zinc-500/85',
};

function colorLabel(color: string): string {
  if (color === 'light_blue') return 'Lt Blue';
  return color.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function canCardUseAction(card: CardData): boolean {
  if (card.category === 'rent') return true;
  if (card.category !== 'action') return false;
  return card.actionType !== 'just_say_no' && card.actionType !== 'house' && card.actionType !== 'hotel';
}

export default function GameBoard() {
  const socketRef = useRef<Socket | null>(null);

  const [connected, setConnected] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [roomId, setRoomId] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('brown');
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError('');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('state:update', (nextState: GameState) => {
      setGameState(nextState);
      setRoomId(nextState.roomId);
      setError('');
    });

    socket.on('error:game', (message: string) => {
      setError(message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const myId = socketRef.current?.id || '';

  const me = useMemo(() => {
    if (!gameState) return null;
    return gameState.players.find((player) => player.id === myId) || null;
  }, [gameState, myId]);

  const opponents = useMemo(() => {
    if (!gameState) return [];
    return gameState.players.filter((player) => player.id !== myId);
  }, [gameState, myId]);

  const playerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const player of gameState?.players || []) {
      map.set(player.id, player.name);
    }
    return map;
  }, [gameState]);

  const pendingReaction = gameState?.pendingReaction || null;
  const pendingTurnDraw = gameState?.pendingTurnDraw || null;
  const pendingPayment = gameState?.pendingPayment || null;

  const drawPendingForMe = pendingTurnDraw?.playerId === myId;
  const reactionSeconds = pendingReaction ? Math.max(0, Math.ceil((pendingReaction.expiresAt - now) / 1000)) : 0;

  const canReactWithJSN =
    Boolean(pendingReaction?.targetPlayerIds.includes(myId)) &&
    Boolean(me?.hand.some((card) => card.category === 'action' && card.actionType === 'just_say_no'));

  const isMyTurn = gameState?.currentPlayerId === myId;
  const hasWinner = Boolean(gameState?.winnerId);
  const isHost = gameState?.hostId === myId;

  const paymentTurnForMe = pendingPayment?.currentPayerId === myId;

  const canPlayCards = Boolean(
    gameState?.started &&
      isMyTurn &&
      !hasWinner &&
      !pendingReaction &&
      !pendingPayment &&
      (!pendingTurnDraw || !drawPendingForMe),
  );

  useEffect(() => {
    if (!opponents.length) {
      setSelectedTargetId('');
      return;
    }

    if (!opponents.some((player) => player.id === selectedTargetId)) {
      setSelectedTargetId(opponents[0].id);
    }
  }, [opponents, selectedTargetId]);

  useEffect(() => {
    setSelectedPaymentIds([]);
  }, [pendingPayment?.id, pendingPayment?.currentPayerId]);

  const myTableCards = useMemo<TableCardEntry[]>(() => {
    if (!me) return [];

    const bankCards = me.bank.map((card) => ({ card, zone: 'bank' as const }));
    const propertyCards = Object.entries(me.properties).flatMap(([color, cards]) =>
      cards.map((card) => ({ card, zone: 'property' as const, color })),
    );

    return [...bankCards, ...propertyCards];
  }, [me]);

  const selectedPaymentTotal = useMemo(() => {
    const idSet = new Set(selectedPaymentIds);
    return myTableCards
      .filter((entry) => idSet.has(entry.card.id))
      .reduce((sum, entry) => sum + entry.card.value, 0);
  }, [myTableCards, selectedPaymentIds]);

  function emit(event: string, payload?: Record<string, unknown>) {
    if (!socketRef.current) return;
    socketRef.current.emit(event, payload);
  }

  function joinRoom(mode: 'create' | 'join') {
    if (!playerName.trim() || !roomInput.trim()) {
      setError('Provide player name and room ID.');
      return;
    }

    setError('');
    emit(mode === 'create' ? 'room:create' : 'room:join', {
      roomId: roomInput.trim(),
      playerName: playerName.trim(),
    });
  }

  function playCard(card: CardData, mode: 'bank' | 'property' | 'action') {
    if (!gameState) return;

    const payload: Record<string, unknown> = {
      roomId: gameState.roomId,
      cardId: card.id,
      mode,
    };

    if (selectedTargetId) payload.targetPlayerId = selectedTargetId;
    if (card.category === 'rent') payload.rentColor = selectedColor;

    if (
      mode === 'property' &&
      (card.category === 'wildcard' || card.actionType === 'house' || card.actionType === 'hotel')
    ) {
      payload.chosenColor = selectedColor;
    }

    if (card.actionType === 'deal_breaker') {
      payload.setColor = selectedColor;
    }

    emit('game:play_card', payload);
  }

  function moveWildcard(cardId: string, newColor: string) {
    emit('game:move_wildcard', { cardId, newColor });
  }

  function wildcardMoveOptions(card: CardData): string[] {
    if (card.category !== 'wildcard') return [];
    const choices = card.colors?.[0] === 'any' ? [...PROPERTY_COLORS] : [...(card.colors || [])];
    return choices.filter((color) => color !== card.assignedColor);
  }

  function drawTurnCards() {
    emit('game:draw_turn_cards');
  }

  function togglePaymentCard(cardId: string) {
    setSelectedPaymentIds((previous) =>
      previous.includes(cardId) ? previous.filter((id) => id !== cardId) : [...previous, cardId],
    );
  }

  function submitPayment() {
    if (!pendingPayment) return;
    emit('game:submit_payment', {
      paymentId: pendingPayment.id,
      cardIds: selectedPaymentIds,
    });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#1c7d4d_0%,#10532f_38%,#063520_100%)] px-3 py-4 text-zinc-100 md:px-5">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
        <section className="rounded-2xl border border-white/20 bg-black/25 p-4 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black tracking-wide text-white">MONOPOLY DEAL ONLINE</h1>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/80">
                Real-time multiplayer table
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                Socket: {connected ? 'Connected' : 'Disconnected'}
              </span>
              {roomId ? (
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Room: {roomId}</span>
              ) : null}
              {gameState ? (
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                  Plays this turn: {gameState.cardsPlayedThisTurn}/3
                </span>
              ) : null}
            </div>
          </div>

          {!roomId ? (
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <input
                className="rounded-lg border border-white/30 bg-white/95 px-3 py-2 text-sm text-zinc-900"
                placeholder="Player name"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
              />
              <input
                className="rounded-lg border border-white/30 bg-white/95 px-3 py-2 text-sm text-zinc-900"
                placeholder="Room ID"
                value={roomInput}
                onChange={(event) => setRoomInput(event.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-black text-zinc-900"
                  onClick={() => joinRoom('create')}
                >
                  Create Room
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/40 bg-white/15 px-3 py-2 text-sm font-black text-white"
                  onClick={() => joinRoom('join')}
                >
                  Join Room
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs">
                Deck {gameState?.deckCount ?? 0}
              </span>
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs">
                Discard {gameState?.discardCount ?? 0}
              </span>

              {isHost && !gameState?.started ? (
                <button
                  type="button"
                  className="rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-black text-zinc-900"
                  onClick={() => emit('game:start')}
                >
                  Start Game
                </button>
              ) : null}

              {isMyTurn && gameState?.started ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-black text-zinc-900"
                  onClick={() => emit('game:end_turn')}
                >
                  <SkipForward className="h-4 w-4" /> End Turn
                </button>
              ) : null}
            </div>
          )}

          {gameState?.lastEvent ? <p className="mt-3 text-sm text-emerald-50">{gameState.lastEvent}</p> : null}

          {error ? <p className="mt-2 rounded-lg bg-rose-500/25 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

          {pendingReaction && pendingReaction.targetPlayerIds.includes(myId) ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-100/20 px-3 py-2 text-sm">
              <ShieldAlert className="h-4 w-4 text-amber-200" />
              <span>
                Reaction window: {reactionSeconds}s for {pendingReaction.actionType}
              </span>
              <button
                type="button"
                disabled={!canReactWithJSN}
                onClick={() => emit('game:react_jsn')}
                className="rounded bg-amber-400 px-3 py-1 text-xs font-black text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                Just Say No
              </button>
            </div>
          ) : null}

          {pendingPayment ? (
            <div className="mt-3 rounded-lg border border-cyan-300/50 bg-cyan-100/15 px-3 py-2 text-sm">
              <p>
                Pending payment: {pendingPayment.reason} | Payer:{' '}
                <span className="font-bold">{playerNameById.get(pendingPayment.currentPayerId || '') || 'N/A'}</span>{' '}
                needs to pay <span className="font-bold">${pendingPayment.amountDue}M</span>
              </p>
            </div>
          ) : null}
        </section>

        {gameState?.started ? (
          <section className="rounded-2xl border border-white/20 bg-black/20 p-4 shadow-xl backdrop-blur">
            <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
              <div className="space-y-4">
                <div className="rounded-xl border border-white/20 bg-black/25 p-3">
                  <p className="mb-2 text-xs uppercase tracking-[0.2em] text-emerald-100/80">Table center</p>
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={drawTurnCards}
                      disabled={!drawPendingForMe}
                      className={`h-40 w-28 rounded-xl border-2 p-2 text-left shadow-lg ${
                        drawPendingForMe
                          ? 'border-yellow-300 bg-gradient-to-br from-yellow-200 to-yellow-400 text-zinc-900'
                          : 'border-white/30 bg-white/10 text-white/80'
                      }`}
                    >
                      <p className="text-[10px] font-black uppercase tracking-wider">Deck</p>
                      <p className="mt-2 text-2xl font-black">{gameState.deckCount}</p>
                      {drawPendingForMe ? (
                        <p className="mt-2 text-xs font-bold">Click to draw {pendingTurnDraw?.count}</p>
                      ) : (
                        <p className="mt-2 text-xs">Draw pending: {playerNameById.get(pendingTurnDraw?.playerId || '') || 'No'}</p>
                      )}
                    </button>

                    <div className="h-40 w-28 rounded-xl border-2 border-white/30 bg-white/10 p-2 text-white/90 shadow-lg">
                      <p className="text-[10px] font-black uppercase tracking-wider">Discard</p>
                      <p className="mt-2 text-2xl font-black">{gameState.discardCount}</p>
                    </div>

                    <div className="flex min-w-[220px] flex-1 flex-wrap gap-2 rounded-xl border border-white/20 bg-white/5 p-3 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
                        <Users className="h-3.5 w-3.5" /> Players: {gameState.players.length}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
                        <Layers3 className="h-3.5 w-3.5" /> Current: {playerNameById.get(gameState.currentPlayerId || '')}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
                        <Sparkles className="h-3.5 w-3.5" /> Win: 3 complete sets
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  {gameState.players.map((player) => (
                    <article key={player.id} className="rounded-xl border border-white/20 bg-black/25 p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-white">{player.name}</span>
                        {gameState.currentPlayerId === player.id ? (
                          <span className="rounded-full bg-sky-400 px-2 py-0.5 text-[10px] font-black text-zinc-900">Turn</span>
                        ) : null}
                        {gameState.winnerId === player.id ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-black text-zinc-900">
                            <Crown className="h-3 w-3" /> Winner
                          </span>
                        ) : null}
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">Hand: {player.id === myId ? player.hand.length : player.handCount}</span>
                      </div>

                      <div className="mb-2 flex flex-wrap gap-2 text-[10px]">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
                          <Wallet className="h-3 w-3" /> Bank ${player.bankTotal}M
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
                          <HandCoins className="h-3 w-3" /> Full sets {player.fullSets.length}
                        </span>
                      </div>

                      {player.bank.length > 0 ? (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {player.bank.map((card) => (
                            <Card key={card.id} card={card} compact />
                          ))}
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        {Object.entries(player.properties)
                          .filter(([, cards]) => cards.length > 0)
                          .map(([color, cards]) => (
                            <div key={color}>
                              <p className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${SET_BADGE[color] || 'bg-white/20'}`}>
                                {colorLabel(color)} ({cards.length})
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {cards.map((card) => (
                                  <Card
                                    key={card.id}
                                    card={card}
                                    compact
                                    wildcardMoveOptions={
                                      player.id === myId && card.category === 'wildcard' ? wildcardMoveOptions(card) : []
                                    }
                                    onWildcardMove={
                                      player.id === myId && card.category === 'wildcard'
                                        ? (nextColor) => moveWildcard(card.id, nextColor)
                                        : undefined
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <aside className="space-y-4">
                <section className="rounded-xl border border-white/20 bg-black/30 p-3">
                  <h2 className="text-sm font-black uppercase tracking-wide text-white">Action setup</h2>

                  <label className="mt-2 block text-xs">
                    Target Player
                    <select
                      className="mt-1 block w-full rounded border border-white/30 bg-white/95 px-2 py-1 text-zinc-900"
                      value={selectedTargetId}
                      onChange={(event) => setSelectedTargetId(event.target.value)}
                    >
                      {opponents.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mt-2 block text-xs">
                    Set Color
                    <select
                      className="mt-1 block w-full rounded border border-white/30 bg-white/95 px-2 py-1 text-zinc-900"
                      value={selectedColor}
                      onChange={(event) => setSelectedColor(event.target.value)}
                    >
                      {PROPERTY_COLORS.map((color) => (
                        <option key={color} value={color}>
                          {colorLabel(color)}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>

                {pendingPayment ? (
                  <section className="rounded-xl border border-cyan-300/40 bg-cyan-100/10 p-3">
                    <h3 className="text-sm font-black uppercase tracking-wide text-cyan-100">Payment Queue</h3>
                    <div className="mt-2 space-y-1 text-xs">
                      {pendingPayment.queue.map((entry, idx) => (
                        <p key={`${entry.payerId}-${idx}`} className="rounded bg-white/10 px-2 py-1">
                          {playerNameById.get(entry.payerId)}: owes ${entry.amount}M | paid {entry.paid ?? '...'}
                        </p>
                      ))}
                    </div>
                  </section>
                ) : null}
              </aside>
            </div>
          </section>
        ) : null}

        {me && gameState?.started ? (
          <section className="rounded-2xl border border-white/20 bg-black/25 p-4 shadow-xl backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-black text-white">Your Hand</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs">
                <Banknote className="h-4 w-4" /> {me.hand.length} cards
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              {me.hand.map((card) => {
                const showBank = card.category !== 'property' && card.category !== 'wildcard';
                const showProperty =
                  card.category === 'property' ||
                  card.category === 'wildcard' ||
                  card.actionType === 'house' ||
                  card.actionType === 'hotel';

                return (
                  <Card
                    key={card.id}
                    card={card}
                    actions={
                      <>
                        {showProperty ? (
                          <button
                            type="button"
                            disabled={!canPlayCards}
                            onClick={() => playCard(card, 'property')}
                            className="rounded bg-emerald-500 px-2 py-1 text-[10px] font-black text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-500"
                          >
                            To Property
                          </button>
                        ) : null}

                        {showBank ? (
                          <button
                            type="button"
                            disabled={!canPlayCards}
                            onClick={() => playCard(card, 'bank')}
                            className="rounded bg-zinc-200 px-2 py-1 text-[10px] font-black text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-500"
                          >
                            To Bank
                          </button>
                        ) : null}

                        {canCardUseAction(card) ? (
                          <button
                            type="button"
                            disabled={!canPlayCards}
                            onClick={() => playCard(card, 'action')}
                            className="rounded bg-sky-400 px-2 py-1 text-[10px] font-black text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-500"
                          >
                            Play Action
                          </button>
                        ) : null}
                      </>
                    }
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {pendingPayment && paymentTurnForMe ? (
          <section className="rounded-2xl border border-yellow-300/60 bg-yellow-100/15 p-4 shadow-xl backdrop-blur">
            <h3 className="text-base font-black text-yellow-100">Choose Exact Payment Cards</h3>
            <p className="mt-1 text-sm text-yellow-50">
              Pay exactly from your table. You can use bank cards, properties, or both.
            </p>
            <p className="mt-1 text-sm text-yellow-50">
              Due: <span className="font-black">${pendingPayment.amountDue}M</span> | Selected:{' '}
              <span className="font-black">${selectedPaymentTotal}M</span>
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {myTableCards.map((entry) => (
                <div key={entry.card.id} className="space-y-1">
                  <Card
                    card={entry.card}
                    compact
                    selected={selectedPaymentIds.includes(entry.card.id)}
                    actions={
                      <button
                        type="button"
                        onClick={() => togglePaymentCard(entry.card.id)}
                        className={`rounded px-2 py-1 text-[10px] font-black ${
                          selectedPaymentIds.includes(entry.card.id)
                            ? 'bg-amber-400 text-zinc-900'
                            : 'bg-white/90 text-zinc-900'
                        }`}
                      >
                        {selectedPaymentIds.includes(entry.card.id) ? 'Selected' : 'Use for Payment'}
                      </button>
                    }
                  />
                  <p className="text-center text-[10px] uppercase tracking-wide text-yellow-100/80">
                    {entry.zone === 'bank' ? 'Bank' : `Property: ${colorLabel(entry.color || 'brown')}`}
                  </p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={submitPayment}
              className="mt-3 rounded bg-yellow-400 px-3 py-2 text-xs font-black text-zinc-900"
            >
              Submit Payment
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}
