const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const deckTemplate = require('./constants/deck.json');

const PORT = Number(process.env.PORT || 4000);
const REACTION_WINDOW_MS = 10_000;
const MAX_PLAYERS = 5;
const MIN_PLAYERS = 2;
const MAX_CARDS_PER_TURN = 3;

const SET_REQUIREMENTS = {
  brown: 2,
  light_blue: 3,
  pink: 3,
  orange: 3,
  red: 3,
  yellow: 3,
  green: 3,
  blue: 2,
  railroad: 4,
  utility: 2,
};

const RENT_TABLE = {
  brown: [1, 2],
  light_blue: [1, 2, 3],
  pink: [1, 2, 4],
  orange: [1, 3, 5],
  red: [2, 3, 6],
  yellow: [2, 4, 6],
  green: [2, 4, 7],
  blue: [3, 8],
  railroad: [1, 2, 3, 4],
  utility: [1, 2],
};

const PROPERTY_COLORS = Object.keys(SET_REQUIREMENTS);
const rooms = new Map();

const app = express();
app.use(cors());
app.get('/health', (_, res) => res.json({ ok: true }));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

function createEmptyProperties() {
  const properties = {};
  for (const color of PROPERTY_COLORS) {
    properties[color] = [];
  }
  return properties;
}

function cloneCard(card) {
  return JSON.parse(JSON.stringify(card));
}

function shuffle(cards) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDeck() {
  const playable = deckTemplate.filter((card) => card.playable !== false).map(cloneCard);
  return shuffle(playable);
}

function createRoom(roomId, hostSocketId, hostName) {
  return {
    id: roomId,
    hostId: hostSocketId,
    players: [
      {
        id: hostSocketId,
        name: hostName,
        hand: [],
        bank: [],
        properties: createEmptyProperties(),
      },
    ],
    started: false,
    deck: [],
    discard: [],
    currentPlayerIndex: 0,
    cardsPlayedThisTurn: 0,
    pendingReaction: null,
    turnEffects: {},
    winnerId: null,
    lastEvent: 'Room created',
  };
}

function getPlayer(room, playerId) {
  return room.players.find((player) => player.id === playerId);
}

function getCurrentPlayer(room) {
  return room.players[room.currentPlayerIndex] || null;
}

function nextPlayerIndex(room) {
  if (room.players.length === 0) {
    room.currentPlayerIndex = 0;
    return;
  }

  room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
}

function drawCards(room, player, count) {
  let drawn = 0;

  while (drawn < count) {
    if (room.deck.length === 0) {
      if (room.discard.length === 0) {
        break;
      }
      room.deck = shuffle(room.discard.map(cloneCard));
      room.discard = [];
    }

    const card = room.deck.pop();
    if (!card) {
      break;
    }

    player.hand.push(card);
    drawn += 1;
  }

  return drawn;
}

function getSetSize(color) {
  return SET_REQUIREMENTS[color] || Number.MAX_SAFE_INTEGER;
}

function isFullSet(cards, color) {
  return Array.isArray(cards) && cards.length >= getSetSize(color);
}

function fullSetColors(properties) {
  const colors = [];
  for (const [color, cards] of Object.entries(properties)) {
    if (isFullSet(cards, color)) {
      colors.push(color);
    }
  }
  return colors;
}

function hasWon(player) {
  return new Set(fullSetColors(player.properties)).size >= 3;
}

function tableValue(player) {
  const bankTotal = player.bank.reduce((sum, card) => sum + card.value, 0);
  const propertyTotal = Object.values(player.properties)
    .flat()
    .reduce((sum, card) => sum + card.value, 0);

  return bankTotal + propertyTotal;
}

function removeCardById(cards, cardId) {
  const index = cards.findIndex((card) => card.id === cardId);
  if (index === -1) {
    return null;
  }

  const [card] = cards.splice(index, 1);
  return card;
}

function removeCardFromTable(player, cardId) {
  const fromBank = removeCardById(player.bank, cardId);
  if (fromBank) {
    return fromBank;
  }

  for (const cards of Object.values(player.properties)) {
    const fromProperties = removeCardById(cards, cardId);
    if (fromProperties) {
      return fromProperties;
    }
  }

  return null;
}

function applyPayment(payer, receiver, amount) {
  if (amount <= 0 || tableValue(payer) === 0) {
    return {
      paid: 0,
      requested: amount,
      remaining: amount,
      transferred: [],
    };
  }

  const candidates = [
    ...payer.bank.map((card) => ({ card, priority: 0 })),
    ...Object.values(payer.properties)
      .flat()
      .map((card) => ({ card, priority: 1 })),
  ];

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.card.value - b.card.value;
  });

  let paid = 0;
  const transferred = [];

  for (const candidate of candidates) {
    if (paid >= amount) {
      break;
    }

    const removed = removeCardFromTable(payer, candidate.card.id);
    if (!removed) {
      continue;
    }

    transferred.push(removed);
    paid += removed.value;
  }

  receiver.bank.push(...transferred);

  return {
    paid,
    requested: amount,
    remaining: Math.max(0, amount - paid),
    transferred,
  };
}

function getCardDisplayColor(card) {
  if (card.assignedColor) {
    return card.assignedColor;
  }

  if (card.category === 'property' || card.category === 'wildcard') {
    return card.colors?.[0] || 'brown';
  }

  return null;
}

function addPropertyCard(player, card, color) {
  if (!player.properties[color]) {
    player.properties[color] = [];
  }

  card.assignedColor = color;
  player.properties[color].push(card);
}

function canAttachBuilding(cards, color) {
  if (!isFullSet(cards, color)) {
    return false;
  }

  if (color === 'railroad' || color === 'utility') {
    return false;
  }

  return true;
}

function calculateRent(cards, color) {
  const rentScale = RENT_TABLE[color] || [1];
  const boundedSize = Math.max(1, Math.min(cards.length, rentScale.length));
  const baseRent = rentScale[boundedSize - 1];

  if (!isFullSet(cards, color)) {
    return baseRent;
  }

  const houseBonus = cards.filter((card) => card.actionType === 'house').length * 3;
  const hotelBonus = cards.filter((card) => card.actionType === 'hotel').length * 4;

  return baseRent + houseBonus + hotelBonus;
}

function getStealableCards(player) {
  const result = [];

  for (const [color, cards] of Object.entries(player.properties)) {
    if (isFullSet(cards, color)) {
      continue;
    }

    for (const card of cards) {
      if (card.actionType === 'house' || card.actionType === 'hotel') {
        continue;
      }
      result.push({ color, card });
    }
  }

  return result;
}

function startTurn(room) {
  const player = getCurrentPlayer(room);
  if (!player) {
    return;
  }

  const cardsToDraw = player.hand.length === 0 ? 5 : 2;
  drawCards(room, player, cardsToDraw);

  room.cardsPlayedThisTurn = 0;
  room.turnEffects[player.id] = {
    rentMultiplier: 1,
  };

  room.lastEvent = `${player.name} starts turn and draws ${cardsToDraw}`;
}

function checkWinner(room) {
  const winner = room.players.find((player) => hasWon(player));
  if (!winner) {
    return null;
  }

  room.winnerId = winner.id;
  room.lastEvent = `${winner.name} wins with 3 full sets`;
  room.started = false;

  if (room.pendingReaction?.timer) {
    clearTimeout(room.pendingReaction.timer);
  }
  room.pendingReaction = null;

  return winner;
}

function getRoomByPlayer(socket) {
  const roomId = socket.data.roomId;
  if (!roomId) {
    return null;
  }

  return rooms.get(roomId) || null;
}

function safePendingReaction(pending) {
  if (!pending) {
    return null;
  }

  return {
    id: pending.id,
    sourcePlayerId: pending.sourcePlayerId,
    targetPlayerIds: pending.targetPlayerIds,
    actionType: pending.actionType,
    expiresAt: pending.expiresAt,
    amount: pending.payload?.amount || null,
  };
}

function serializePlayerView(room, viewerId) {
  return {
    roomId: room.id,
    started: room.started,
    hostId: room.hostId,
    currentPlayerId: getCurrentPlayer(room)?.id || null,
    cardsPlayedThisTurn: room.cardsPlayedThisTurn,
    deckCount: room.deck.length,
    discardCount: room.discard.length,
    pendingReaction: safePendingReaction(room.pendingReaction),
    winnerId: room.winnerId,
    lastEvent: room.lastEvent,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      handCount: player.hand.length,
      hand: player.id === viewerId ? player.hand : [],
      bank: player.bank,
      bankTotal: player.bank.reduce((sum, card) => sum + card.value, 0),
      properties: player.properties,
      fullSets: fullSetColors(player.properties),
    })),
  };
}

function emitState(room) {
  for (const player of room.players) {
    io.to(player.id).emit('state:update', serializePlayerView(room, player.id));
  }
}

function emitError(socket, message) {
  socket.emit('error:game', message);
}

function queuePendingReaction(room, pending) {
  const existing = room.pendingReaction;
  if (existing?.timer) {
    clearTimeout(existing.timer);
  }

  room.pendingReaction = pending;
  room.pendingReaction.timer = setTimeout(() => {
    resolvePendingReaction(room.id, pending.id, null);
  }, REACTION_WINDOW_MS);
}

function resolvePendingReaction(roomId, pendingId, canceledByPlayerId) {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  const pending = room.pendingReaction;
  if (!pending || pending.id !== pendingId) {
    return;
  }

  if (pending.timer) {
    clearTimeout(pending.timer);
  }

  room.pendingReaction = null;

  if (canceledByPlayerId) {
    const canceledBy = getPlayer(room, canceledByPlayerId);
    room.lastEvent = `${canceledBy?.name || 'A player'} canceled the action with Just Say No`;
    emitState(room);
    return;
  }

  applyResolvedAction(room, pending.payload);
  checkWinner(room);
  emitState(room);
}

function applyResolvedAction(room, payload) {
  const actor = getPlayer(room, payload.actorId);
  if (!actor) {
    return;
  }

  if (payload.type === 'debt_collector') {
    const target = getPlayer(room, payload.targetPlayerId);
    if (!target) {
      return;
    }

    const result = applyPayment(target, actor, payload.amount || 5);
    room.lastEvent = `${actor.name} collected $${result.paid}M from ${target.name}`;
    return;
  }

  if (payload.type === 'birthday') {
    let totalPaid = 0;
    for (const targetId of payload.targetPlayerIds || []) {
      const target = getPlayer(room, targetId);
      if (!target || target.id === actor.id) {
        continue;
      }
      const result = applyPayment(target, actor, 2);
      totalPaid += result.paid;
    }
    room.lastEvent = `${actor.name} collected Birthday payments totaling $${totalPaid}M`;
    return;
  }

  if (payload.type === 'rent') {
    const target = getPlayer(room, payload.targetPlayerId);
    if (!target) {
      return;
    }

    const result = applyPayment(target, actor, payload.amount || 0);
    room.lastEvent = `${actor.name} collected $${result.paid}M rent from ${target.name}`;
    return;
  }

  if (payload.type === 'sly_deal') {
    const target = getPlayer(room, payload.targetPlayerId);
    if (!target) {
      return;
    }

    const stealable = getStealableCards(target);
    const picked = stealable.find((entry) => entry.card.id === payload.targetCardId) || stealable[0];
    if (!picked) {
      room.lastEvent = `${actor.name} played Sly Deal, but no eligible property was available`;
      return;
    }

    const stolen = removeCardById(target.properties[picked.color], picked.card.id);
    if (!stolen) {
      return;
    }

    const destinationColor = getCardDisplayColor(stolen) || picked.color;
    addPropertyCard(actor, stolen, destinationColor);

    room.lastEvent = `${actor.name} stole a property from ${target.name}`;
    return;
  }

  if (payload.type === 'forced_deal') {
    const target = getPlayer(room, payload.targetPlayerId);
    if (!target) {
      return;
    }

    const actorOptions = getStealableCards(actor);
    const targetOptions = getStealableCards(target);

    const actorPick = actorOptions.find((entry) => entry.card.id === payload.actorCardId) || actorOptions[0];
    const targetPick =
      targetOptions.find((entry) => entry.card.id === payload.targetCardId) || targetOptions[0];

    if (!actorPick || !targetPick) {
      room.lastEvent = `${actor.name} played Forced Deal, but no valid swap was available`;
      return;
    }

    const actorCard = removeCardById(actor.properties[actorPick.color], actorPick.card.id);
    const targetCard = removeCardById(target.properties[targetPick.color], targetPick.card.id);

    if (!actorCard || !targetCard) {
      return;
    }

    const actorToColor = getCardDisplayColor(targetCard) || targetPick.color;
    const targetToColor = getCardDisplayColor(actorCard) || actorPick.color;

    addPropertyCard(actor, targetCard, actorToColor);
    addPropertyCard(target, actorCard, targetToColor);

    room.lastEvent = `${actor.name} swapped properties with ${target.name}`;
    return;
  }

  if (payload.type === 'deal_breaker') {
    const target = getPlayer(room, payload.targetPlayerId);
    if (!target) {
      return;
    }

    const candidateColor =
      payload.setColor || fullSetColors(target.properties)[0] || null;

    if (!candidateColor || !isFullSet(target.properties[candidateColor], candidateColor)) {
      room.lastEvent = `${actor.name} played Deal Breaker, but no full set was available`;
      return;
    }

    const stolenSet = [...target.properties[candidateColor]];
    target.properties[candidateColor] = [];

    for (const card of stolenSet) {
      const destinationColor = getCardDisplayColor(card) || candidateColor;
      addPropertyCard(actor, card, destinationColor);
    }

    room.lastEvent = `${actor.name} stole ${target.name}'s full ${candidateColor} set`;
  }
}

function playCard(socket, payload) {
  const room = getRoomByPlayer(socket);
  if (!room || !room.started || room.winnerId) {
    emitError(socket, 'Game is not active.');
    return;
  }

  if (room.pendingReaction) {
    emitError(socket, 'Waiting for reaction window to resolve.');
    return;
  }

  const player = getPlayer(room, socket.id);
  const currentPlayer = getCurrentPlayer(room);

  if (!player || !currentPlayer || currentPlayer.id !== socket.id) {
    emitError(socket, 'It is not your turn.');
    return;
  }

  if (room.cardsPlayedThisTurn >= MAX_CARDS_PER_TURN) {
    emitError(socket, 'You have already played 3 cards this turn.');
    return;
  }

  const handCard = removeCardById(player.hand, payload.cardId);
  if (!handCard) {
    emitError(socket, 'Card not found in hand.');
    return;
  }

  const mode = payload.mode;

  if (mode === 'bank') {
    player.bank.push(handCard);
    room.cardsPlayedThisTurn += 1;
    room.lastEvent = `${player.name} banked ${handCard.name}`;
    checkWinner(room);
    emitState(room);
    return;
  }

  if (mode === 'property') {
    if (handCard.category === 'property') {
      const color = handCard.colors?.[0];
      addPropertyCard(player, handCard, color);
      room.cardsPlayedThisTurn += 1;
      room.lastEvent = `${player.name} played a property`;
      checkWinner(room);
      emitState(room);
      return;
    }

    if (handCard.category === 'wildcard') {
      const choices = handCard.colors?.[0] === 'any' ? PROPERTY_COLORS : handCard.colors || [];
      const chosenColor = choices.includes(payload.chosenColor)
        ? payload.chosenColor
        : choices[0];

      if (!chosenColor) {
        player.hand.push(handCard);
        emitError(socket, 'No valid color available for wildcard.');
        return;
      }

      addPropertyCard(player, handCard, chosenColor);
      room.cardsPlayedThisTurn += 1;
      room.lastEvent = `${player.name} played wildcard as ${chosenColor}`;
      checkWinner(room);
      emitState(room);
      return;
    }

    if (
      handCard.category === 'action' &&
      (handCard.actionType === 'house' || handCard.actionType === 'hotel')
    ) {
      const color = payload.chosenColor;
      const setCards = player.properties[color] || [];

      if (!canAttachBuilding(setCards, color)) {
        player.hand.push(handCard);
        emitError(socket, 'House/Hotel can only be added to a full non-utility/non-railroad set.');
        return;
      }

      if (
        handCard.actionType === 'hotel' &&
        !setCards.some((card) => card.actionType === 'house')
      ) {
        player.hand.push(handCard);
        emitError(socket, 'Hotel requires a House on that set.');
        return;
      }

      addPropertyCard(player, handCard, color);
      room.cardsPlayedThisTurn += 1;
      room.lastEvent = `${player.name} attached ${handCard.name} to ${color}`;
      checkWinner(room);
      emitState(room);
      return;
    }

    player.hand.push(handCard);
    emitError(socket, 'That card cannot be played into properties.');
    return;
  }

  if (mode !== 'action') {
    player.hand.push(handCard);
    emitError(socket, 'Unknown play mode.');
    return;
  }

  if (handCard.category === 'action') {
    if (handCard.actionType === 'just_say_no') {
      player.hand.push(handCard);
      emitError(socket, 'Just Say No is a reaction card. Bank it or use it in reaction window.');
      return;
    }

    if (
      ['debt_collector', 'sly_deal', 'forced_deal', 'deal_breaker'].includes(
        handCard.actionType,
      ) &&
      (!payload.targetPlayerId || payload.targetPlayerId === player.id)
    ) {
      player.hand.push(handCard);
      emitError(socket, `${handCard.name} requires one opponent target.`);
      return;
    }

    room.cardsPlayedThisTurn += 1;
    room.discard.push(handCard);

    if (handCard.actionType === 'pass_go') {
      drawCards(room, player, 2);
      room.lastEvent = `${player.name} played Pass Go and drew 2 cards`;
      emitState(room);
      return;
    }

    if (handCard.actionType === 'double_rent') {
      const effects = room.turnEffects[player.id] || { rentMultiplier: 1 };
      effects.rentMultiplier *= 2;
      room.turnEffects[player.id] = effects;
      room.lastEvent = `${player.name} doubled their next rent card`;
      emitState(room);
      return;
    }

    if (handCard.actionType === 'debt_collector') {
      const reactionPayload = {
        type: 'debt_collector',
        actorId: player.id,
        targetPlayerId: payload.targetPlayerId,
        amount: 5,
      };

      const pendingId = `${Date.now()}-${Math.random()}`;
      queuePendingReaction(room, {
        id: pendingId,
        sourcePlayerId: player.id,
        targetPlayerIds: [payload.targetPlayerId],
        actionType: handCard.actionType,
        payload: reactionPayload,
        expiresAt: Date.now() + REACTION_WINDOW_MS,
      });

      room.lastEvent = `${player.name} played Debt Collector. Waiting for reaction...`;
      emitState(room);
      return;
    }

    if (handCard.actionType === 'birthday') {
      const targets = room.players.map((entry) => entry.id).filter((id) => id !== player.id);

      const reactionPayload = {
        type: 'birthday',
        actorId: player.id,
        targetPlayerIds: targets,
      };

      const pendingId = `${Date.now()}-${Math.random()}`;
      queuePendingReaction(room, {
        id: pendingId,
        sourcePlayerId: player.id,
        targetPlayerIds: targets,
        actionType: handCard.actionType,
        payload: reactionPayload,
        expiresAt: Date.now() + REACTION_WINDOW_MS,
      });

      room.lastEvent = `${player.name} played Birthday. Waiting for reaction...`;
      emitState(room);
      return;
    }

    if (handCard.actionType === 'sly_deal') {
      const reactionPayload = {
        type: 'sly_deal',
        actorId: player.id,
        targetPlayerId: payload.targetPlayerId,
        targetCardId: payload.targetCardId || null,
      };

      const pendingId = `${Date.now()}-${Math.random()}`;
      queuePendingReaction(room, {
        id: pendingId,
        sourcePlayerId: player.id,
        targetPlayerIds: [payload.targetPlayerId],
        actionType: handCard.actionType,
        payload: reactionPayload,
        expiresAt: Date.now() + REACTION_WINDOW_MS,
      });

      room.lastEvent = `${player.name} played Sly Deal. Waiting for reaction...`;
      emitState(room);
      return;
    }

    if (handCard.actionType === 'forced_deal') {
      const reactionPayload = {
        type: 'forced_deal',
        actorId: player.id,
        targetPlayerId: payload.targetPlayerId,
        actorCardId: payload.actorCardId || null,
        targetCardId: payload.targetCardId || null,
      };

      const pendingId = `${Date.now()}-${Math.random()}`;
      queuePendingReaction(room, {
        id: pendingId,
        sourcePlayerId: player.id,
        targetPlayerIds: [payload.targetPlayerId],
        actionType: handCard.actionType,
        payload: reactionPayload,
        expiresAt: Date.now() + REACTION_WINDOW_MS,
      });

      room.lastEvent = `${player.name} played Forced Deal. Waiting for reaction...`;
      emitState(room);
      return;
    }

    if (handCard.actionType === 'deal_breaker') {
      const reactionPayload = {
        type: 'deal_breaker',
        actorId: player.id,
        targetPlayerId: payload.targetPlayerId,
        setColor: payload.setColor || null,
      };

      const pendingId = `${Date.now()}-${Math.random()}`;
      queuePendingReaction(room, {
        id: pendingId,
        sourcePlayerId: player.id,
        targetPlayerIds: [payload.targetPlayerId],
        actionType: handCard.actionType,
        payload: reactionPayload,
        expiresAt: Date.now() + REACTION_WINDOW_MS,
      });

      room.lastEvent = `${player.name} played Deal Breaker. Waiting for reaction...`;
      emitState(room);
      return;
    }

    emitState(room);
    return;
  }

  if (handCard.category === 'rent') {
    if (!payload.targetPlayerId || payload.targetPlayerId === player.id) {
      player.hand.push(handCard);
      emitError(socket, 'Rent requires one opponent target.');
      return;
    }

    const rentChoices = handCard.rentColors?.[0] === 'any' ? PROPERTY_COLORS : handCard.rentColors || [];
    const requestedColor = payload.rentColor;
    const chosenColor = rentChoices.includes(requestedColor) ? requestedColor : rentChoices[0];

    if (!chosenColor) {
      player.hand.push(handCard);
      emitError(socket, 'No valid rent color selected.');
      return;
    }

    const propertySet = player.properties[chosenColor] || [];
    if (propertySet.length === 0) {
      player.hand.push(handCard);
      emitError(socket, 'You must own at least one card in that color to charge rent.');
      return;
    }

    const effects = room.turnEffects[player.id] || { rentMultiplier: 1 };
    const baseRent = calculateRent(propertySet, chosenColor);
    const rentAmount = baseRent * effects.rentMultiplier;

    room.turnEffects[player.id] = {
      rentMultiplier: 1,
    };

    room.cardsPlayedThisTurn += 1;
    room.discard.push(handCard);

    const reactionPayload = {
      type: 'rent',
      actorId: player.id,
      targetPlayerId: payload.targetPlayerId,
      amount: rentAmount,
    };

    const pendingId = `${Date.now()}-${Math.random()}`;
    queuePendingReaction(room, {
      id: pendingId,
      sourcePlayerId: player.id,
      targetPlayerIds: [payload.targetPlayerId],
      actionType: 'rent',
      payload: reactionPayload,
      expiresAt: Date.now() + REACTION_WINDOW_MS,
    });

    room.lastEvent = `${player.name} charged $${rentAmount}M rent (${chosenColor}). Waiting for reaction...`;
    emitState(room);
    return;
  }

  player.hand.push(handCard);
  emitError(socket, 'This card cannot be played as an action.');
}

function moveWildcard(socket, payload) {
  const room = getRoomByPlayer(socket);
  if (!room || !room.started) {
    emitError(socket, 'Game is not active.');
    return;
  }

  const player = getPlayer(room, socket.id);
  if (!player) {
    emitError(socket, 'Player not found.');
    return;
  }

  for (const [color, cards] of Object.entries(player.properties)) {
    const cardIndex = cards.findIndex((card) => card.id === payload.cardId);
    if (cardIndex === -1) {
      continue;
    }

    const [card] = cards.splice(cardIndex, 1);

    if (card.category !== 'wildcard') {
      cards.push(card);
      emitError(socket, 'Only wildcard cards can be moved.');
      return;
    }

    const validColors = card.colors?.[0] === 'any' ? PROPERTY_COLORS : card.colors || [];
    if (!validColors.includes(payload.newColor)) {
      cards.push(card);
      emitError(socket, 'Invalid color for this wildcard.');
      return;
    }

    addPropertyCard(player, card, payload.newColor);
    room.lastEvent = `${player.name} moved wildcard to ${payload.newColor}`;
    checkWinner(room);
    emitState(room);
    return;
  }

  emitError(socket, 'Wildcard card not found in your properties.');
}

function endTurn(socket) {
  const room = getRoomByPlayer(socket);
  if (!room || !room.started || room.winnerId) {
    emitError(socket, 'Game is not active.');
    return;
  }

  if (room.pendingReaction) {
    emitError(socket, 'Cannot end turn during reaction window.');
    return;
  }

  const currentPlayer = getCurrentPlayer(room);
  if (!currentPlayer || currentPlayer.id !== socket.id) {
    emitError(socket, 'It is not your turn.');
    return;
  }

  while (currentPlayer.hand.length > 7) {
    const discarded = currentPlayer.hand.pop();
    if (discarded) {
      room.discard.push(discarded);
    }
  }

  nextPlayerIndex(room);
  startTurn(room);
  emitState(room);
}

io.on('connection', (socket) => {
  socket.on('room:create', ({ roomId, playerName }) => {
    if (!roomId || !playerName) {
      emitError(socket, 'roomId and playerName are required.');
      return;
    }

    if (rooms.has(roomId)) {
      emitError(socket, 'Room already exists.');
      return;
    }

    const room = createRoom(roomId, socket.id, playerName.trim());
    rooms.set(roomId, room);

    socket.data.roomId = roomId;
    socket.join(roomId);

    emitState(room);
  });

  socket.on('room:join', ({ roomId, playerName }) => {
    const room = rooms.get(roomId);

    if (!room) {
      emitError(socket, 'Room not found.');
      return;
    }

    if (room.started) {
      emitError(socket, 'Game already started for this room.');
      return;
    }

    if (room.players.length >= MAX_PLAYERS) {
      emitError(socket, 'Room is full (max 5 players).');
      return;
    }

    room.players.push({
      id: socket.id,
      name: playerName?.trim() || `Player ${room.players.length + 1}`,
      hand: [],
      bank: [],
      properties: createEmptyProperties(),
    });

    socket.data.roomId = roomId;
    socket.join(roomId);

    room.lastEvent = `${playerName} joined room ${roomId}`;
    emitState(room);
  });

  socket.on('game:start', () => {
    const room = getRoomByPlayer(socket);
    if (!room) {
      emitError(socket, 'Join a room first.');
      return;
    }

    if (room.hostId !== socket.id) {
      emitError(socket, 'Only host can start the game.');
      return;
    }

    if (room.players.length < MIN_PLAYERS) {
      emitError(socket, 'Need at least 2 players to start.');
      return;
    }

    room.started = true;
    room.winnerId = null;
    room.discard = [];
    room.deck = buildDeck();
    room.currentPlayerIndex = 0;
    room.cardsPlayedThisTurn = 0;
    room.pendingReaction = null;
    room.turnEffects = {};

    for (const player of room.players) {
      player.hand = [];
      player.bank = [];
      player.properties = createEmptyProperties();
      drawCards(room, player, 5);
    }

    room.lastEvent = 'Game started';
    startTurn(room);
    emitState(room);
  });

  socket.on('game:play_card', (payload) => {
    playCard(socket, payload || {});
  });

  socket.on('game:move_wildcard', (payload) => {
    moveWildcard(socket, payload || {});
  });

  socket.on('game:react_jsn', () => {
    const room = getRoomByPlayer(socket);
    if (!room || !room.pendingReaction) {
      emitError(socket, 'No active reaction window.');
      return;
    }

    const reaction = room.pendingReaction;
    if (!reaction.targetPlayerIds.includes(socket.id)) {
      emitError(socket, 'You are not a target of this action.');
      return;
    }

    const player = getPlayer(room, socket.id);
    if (!player) {
      emitError(socket, 'Player not found.');
      return;
    }

    const jsnIndex = player.hand.findIndex(
      (card) => card.category === 'action' && card.actionType === 'just_say_no',
    );

    if (jsnIndex === -1) {
      emitError(socket, 'You do not have a Just Say No card.');
      return;
    }

    const [jsnCard] = player.hand.splice(jsnIndex, 1);
    room.discard.push(jsnCard);

    resolvePendingReaction(room.id, reaction.id, socket.id);
  });

  socket.on('game:end_turn', () => {
    endTurn(socket);
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId) {
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      return;
    }

    const playerIndex = room.players.findIndex((player) => player.id === socket.id);
    if (playerIndex === -1) {
      return;
    }

    const [removed] = room.players.splice(playerIndex, 1);

    if (room.pendingReaction?.targetPlayerIds.includes(removed.id)) {
      resolvePendingReaction(room.id, room.pendingReaction.id, null);
    }

    if (room.players.length === 0) {
      rooms.delete(roomId);
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
    }

    if (playerIndex <= room.currentPlayerIndex && room.currentPlayerIndex > 0) {
      room.currentPlayerIndex -= 1;
    }

    room.currentPlayerIndex %= room.players.length;
    room.lastEvent = `${removed.name} disconnected`;
    emitState(room);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Monopoly Deal server running on http://localhost:${PORT}`);
});
