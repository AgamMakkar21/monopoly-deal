export type CardCategory =
  | 'property'
  | 'wildcard'
  | 'action'
  | 'rent'
  | 'money'
  | 'reference';

export type Card = {
  id: string;
  name: string;
  category: CardCategory;
  value: number;
  colors?: string[];
  rentColors?: string[];
  actionType?: string;
  assignedColor?: string;
  playable?: boolean;
};

export type PlayerState = {
  id: string;
  name: string;
  hand: Card[];
  bank: Card[];
  properties: Record<string, Card[]>;
};

export type PaymentResult = {
  paid: number;
  requested: number;
  remaining: number;
  transferred: Card[];
};

export const SET_REQUIREMENTS: Record<string, number> = {
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

const RENT_TABLE: Record<string, number[]> = {
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

export function getSetSize(color: string): number {
  return SET_REQUIREMENTS[color] ?? Number.MAX_SAFE_INTEGER;
}

export function isFullSet(cards: Card[], color: string): boolean {
  if (!cards || cards.length === 0) {
    return false;
  }

  return cards.length >= getSetSize(color);
}

export function fullSetColors(properties: Record<string, Card[]>): string[] {
  const colors: string[] = [];

  for (const [color, cards] of Object.entries(properties)) {
    if (isFullSet(cards, color)) {
      colors.push(color);
    }
  }

  return colors;
}

export function hasThreeFullSets(properties: Record<string, Card[]>): boolean {
  const colors = fullSetColors(properties);
  const unique = new Set(colors);
  return unique.size >= 3;
}

export function tableValue(player: PlayerState): number {
  const bankTotal = player.bank.reduce((sum, card) => sum + card.value, 0);

  const propertyTotal = Object.values(player.properties)
    .flat()
    .reduce((sum, card) => sum + card.value, 0);

  return bankTotal + propertyTotal;
}

function removeCardFromPlayer(player: PlayerState, cardId: string): Card | null {
  const bankIndex = player.bank.findIndex((card) => card.id === cardId);
  if (bankIndex !== -1) {
    const [card] = player.bank.splice(bankIndex, 1);
    return card;
  }

  for (const cards of Object.values(player.properties)) {
    const propertyIndex = cards.findIndex((card) => card.id === cardId);
    if (propertyIndex !== -1) {
      const [card] = cards.splice(propertyIndex, 1);
      return card;
    }
  }

  return null;
}

export function applyPayment(
  payer: PlayerState,
  receiver: PlayerState,
  amount: number,
): PaymentResult {
  if (amount <= 0) {
    return {
      paid: 0,
      requested: amount,
      remaining: 0,
      transferred: [],
    };
  }

  if (tableValue(payer) === 0) {
    return {
      paid: 0,
      requested: amount,
      remaining: amount,
      transferred: [],
    };
  }

  const candidates: Array<{ card: Card; priority: number }> = [
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

  const selected: Card[] = [];
  let total = 0;

  for (const candidate of candidates) {
    if (total >= amount) {
      break;
    }

    const removed = removeCardFromPlayer(payer, candidate.card.id);
    if (!removed) {
      continue;
    }

    selected.push(removed);
    total += removed.value;
  }

  if (selected.length > 0) {
    receiver.bank.push(...selected);
  }

  return {
    paid: total,
    requested: amount,
    remaining: Math.max(0, amount - total),
    transferred: selected,
  };
}

export function rentDueForSet(cards: Card[], color: string): number {
  const rentScale = RENT_TABLE[color] ?? [1];
  const sized = Math.max(1, Math.min(cards.length, rentScale.length));
  const baseRent = rentScale[sized - 1];

  if (!isFullSet(cards, color)) {
    return baseRent;
  }

  const houseBonus = cards.filter((card) => card.actionType === 'house').length * 3;
  const hotelBonus = cards.filter((card) => card.actionType === 'hotel').length * 4;

  return baseRent + houseBonus + hotelBonus;
}

export function canAttachBuilding(cards: Card[], color: string): boolean {
  return isFullSet(cards, color) && color !== 'railroad' && color !== 'utility';
}
