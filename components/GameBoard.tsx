'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, HandCoins, SkipForward, ShieldAlert, Wallet } from 'lucide-react';
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

type GameState = {
  roomId: string;
  started: boolean;
  hostId: string;
  currentPlayerId: string | null;
  cardsPlayedThisTurn: number;
  deckCount: number;
  discardCount: number;
  pendingReaction: PendingReaction | null;
  winnerId: string | null;
  lastEvent: string;
  players: PlayerView[];
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

function colorLabel(color: string): string {
  if (color === 'light_blue') {
    return 'Lt Blue';
  }
  return color.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function canCardUseAction(card: CardData): boolean {
  if (card.category === 'rent') {
    return true;
  }
  if (card.category !== 'action') {
    return false;
  }
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
    if (!gameState) {
      return null;
    }
    return gameState.players.find((player) => player.id === myId) || null;
  }, [gameState, myId]);

  const opponents = useMemo(() => {
    if (!gameState) {
      return [];
    }
    return gameState.players.filter((player) => player.id !== myId);
  }, [gameState, myId]);

  useEffect(() => {
    if (!opponents.length) {
      setSelectedTargetId('');
      return;
    }

    if (!opponents.some((player) => player.id === selectedTargetId)) {
      setSelectedTargetId(opponents[0].id);
    }
  }, [opponents, selectedTargetId]);

  const isMyTurn = gameState?.currentPlayerId === myId;
  const hasWinner = Boolean(gameState?.winnerId);
  const isHost = gameState?.hostId === myId;

  const pendingReaction = gameState?.pendingReaction || null;
  const reactionSeconds = pendingReaction
    ? Math.max(0, Math.ceil((pendingReaction.expiresAt - now) / 1000))
    : 0;

  const canReactWithJSN =
    Boolean(pendingReaction?.targetPlayerIds.includes(myId)) &&
    Boolean(me?.hand.some((card) => card.category === 'action' && card.actionType === 'just_say_no'));

  const canPlayCards = Boolean(gameState?.started && isMyTurn && !pendingReaction && !hasWinner);

  function emit(event: string, payload?: Record<string, unknown>) {
    if (!socketRef.current) {
      return;
    }
    socketRef.current.emit(event, payload);
  }

  function playCard(card: CardData, mode: 'bank' | 'property' | 'action') {
    if (!gameState) {
      return;
    }

    const payload: Record<string, unknown> = {
      roomId: gameState.roomId,
      cardId: card.id,
      mode,
    };

    if (selectedTargetId) {
      payload.targetPlayerId = selectedTargetId;
    }

    if (card.category === 'rent') {
      payload.rentColor = selectedColor;
    }

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

  function wildcardMoveOptions(card: CardData): string[] {
    if (card.category !== 'wildcard') {
      return [];
    }

    const choices = card.colors?.[0] === 'any' ? [...PROPERTY_COLORS] : [...(card.colors || [])];
    return choices.filter((color) => color !== card.assignedColor);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4">
      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <h1 className="mb-2 text-2xl font-bold text-zinc-900">Monopoly Deal Multiplayer</h1>
        <p className="text-sm text-zinc-600">Socket: {connected ? 'Connected' : 'Disconnected'}</p>

        {!roomId ? (
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <input
              className="rounded border border-zinc-300 px-3 py-2"
              placeholder="Player name"
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
            />
            <input
              className="rounded border border-zinc-300 px-3 py-2"
              placeholder="Room ID"
              value={roomInput}
              onChange={(event) => setRoomInput(event.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded bg-zinc-900 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => joinRoom('create')}
              >
                Create Room
              </button>
              <button
                type="button"
                className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800"
                onClick={() => joinRoom('join')}
              >
                Join Room
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded bg-white px-3 py-1 font-medium text-zinc-700">Room: {roomId}</span>
            <span className="rounded bg-white px-3 py-1 text-zinc-700">
              Deck {gameState?.deckCount ?? 0} | Discard {gameState?.discardCount ?? 0}
            </span>
            {isHost && !gameState?.started ? (
              <button
                type="button"
                className="rounded bg-emerald-600 px-3 py-1 font-semibold text-white"
                onClick={() => emit('game:start')}
              >
                Start Game
              </button>
            ) : null}
            {isMyTurn && gameState?.started ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded bg-indigo-600 px-3 py-1 font-semibold text-white"
                onClick={() => emit('game:end_turn')}
              >
                <SkipForward className="h-4 w-4" />
                End Turn
              </button>
            ) : null}
          </div>
        )}

        {gameState?.lastEvent ? <p className="mt-3 text-sm text-zinc-700">{gameState.lastEvent}</p> : null}

        {error ? (
          <p className="mt-2 rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}

        {pendingReaction && pendingReaction.targetPlayerIds.includes(myId) ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
            <ShieldAlert className="h-4 w-4 text-amber-700" />
            <span>
              Reaction window: {reactionSeconds}s remaining for {pendingReaction.actionType}
            </span>
            <button
              type="button"
              disabled={!canReactWithJSN}
              onClick={() => emit('game:react_jsn')}
              className="rounded bg-amber-600 px-3 py-1 font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              Just Say No
            </button>
          </div>
        ) : null}
      </section>

      {gameState ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold text-zinc-900">Players</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {gameState.players.map((player) => (
              <div key={player.id} className="rounded-lg border border-zinc-200 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-900">{player.name}</span>
                  {gameState.currentPlayerId === player.id ? (
                    <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                      Current Turn
                    </span>
                  ) : null}
                  {gameState.winnerId === player.id ? (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      <Crown className="h-3 w-3" /> Winner
                    </span>
                  ) : null}
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                    Hand: {player.id === myId ? player.hand.length : player.handCount}
                  </span>
                </div>

                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-700">
                  <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-1">
                    <Wallet className="h-3 w-3" /> Bank ${player.bankTotal}M
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-1">
                    <HandCoins className="h-3 w-3" /> Full sets: {player.fullSets.length}
                  </span>
                </div>

                {player.bank.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
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
                        <p className="mb-1 text-xs font-semibold text-zinc-700">{colorLabel(color)} Set</p>
                        <div className="flex flex-wrap gap-2">
                          {cards.map((card) => (
                            <Card
                              key={card.id}
                              card={card}
                              compact
                              wildcardMoveOptions={
                                player.id === myId && card.category === 'wildcard'
                                  ? wildcardMoveOptions(card)
                                  : []
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
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {me && gameState?.started ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">Your Hand</h2>

          <div className="mb-3 grid gap-2 rounded border border-zinc-200 bg-zinc-50 p-3 md:grid-cols-2">
            <label className="text-sm text-zinc-700">
              Target Player
              <select
                className="mt-1 block w-full rounded border border-zinc-300 bg-white px-2 py-1"
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

            <label className="text-sm text-zinc-700">
              Set Color (wild/rent/buildings)
              <select
                className="mt-1 block w-full rounded border border-zinc-300 bg-white px-2 py-1"
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
                          className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
                        >
                          To Property
                        </button>
                      ) : null}

                      {showBank ? (
                        <button
                          type="button"
                          disabled={!canPlayCards}
                          onClick={() => playCard(card, 'bank')}
                          className="rounded bg-zinc-700 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
                        >
                          To Bank
                        </button>
                      ) : null}

                      {canCardUseAction(card) ? (
                        <button
                          type="button"
                          disabled={!canPlayCards}
                          onClick={() => playCard(card, 'action')}
                          className="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
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
    </div>
  );
}
