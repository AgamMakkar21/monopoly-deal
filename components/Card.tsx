'use client';

import type { ReactNode } from 'react';
import { ArrowLeftRight, Building2, CircleDollarSign, HandCoins, Shield } from 'lucide-react';

export type CardData = {
  id: string;
  name: string;
  category: 'property' | 'wildcard' | 'action' | 'rent' | 'money' | 'reference';
  value: number;
  colors?: string[];
  rentColors?: string[];
  actionType?: string;
  assignedColor?: string;
};

type CardProps = {
  card: CardData;
  actions?: ReactNode;
  wildcardMoveOptions?: string[];
  onWildcardMove?: (nextColor: string) => void;
  compact?: boolean;
  selected?: boolean;
  setColor?: string;
  setCards?: CardData[];
};

const SET_REQUIREMENTS: Record<string, number> = {
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

const COLOR_SOLID: Record<string, string> = {
  brown: '#be6b2b',
  light_blue: '#41c5ff',
  pink: '#ff4fae',
  orange: '#ff8d1c',
  red: '#ff3b30',
  yellow: '#ffd51f',
  green: '#1fc96a',
  blue: '#2f56ff',
  railroad: '#2b2b2b',
  utility: '#9ca3af',
  neutral: '#52525b',
};

const LIGHT_COLORS = new Set(['yellow', 'light_blue', 'utility']);

const ACTION_THEME: Record<string, { title: string; icon: ReactNode; bg: string }> = {
  deal_breaker: {
    title: 'Deal Breaker',
    icon: <Building2 className="h-4 w-4" />,
    bg: '#1440cf',
  },
  forced_deal: {
    title: 'Forced Deal',
    icon: <ArrowLeftRight className="h-4 w-4" />,
    bg: '#0f7cc2',
  },
  sly_deal: {
    title: 'Sly Deal',
    icon: <HandCoins className="h-4 w-4" />,
    bg: '#dc7f00',
  },
  just_say_no: {
    title: 'Just Say No',
    icon: <Shield className="h-4 w-4" />,
    bg: '#cb2e2e',
  },
  debt_collector: {
    title: 'Debt Collector',
    icon: <CircleDollarSign className="h-4 w-4" />,
    bg: '#4b8f1b',
  },
  birthday: {
    title: "It's My Birthday",
    icon: <CircleDollarSign className="h-4 w-4" />,
    bg: '#c53f9d',
  },
  double_rent: {
    title: 'Double Rent',
    icon: <CircleDollarSign className="h-4 w-4" />,
    bg: '#cc5c1f',
  },
  house: {
    title: 'House',
    icon: <Building2 className="h-4 w-4" />,
    bg: '#1f9952',
  },
  hotel: {
    title: 'Hotel',
    icon: <Building2 className="h-4 w-4" />,
    bg: '#0a6fb5',
  },
  pass_go: {
    title: 'Pass Go',
    icon: <CircleDollarSign className="h-4 w-4" />,
    bg: '#0f8d86',
  },
};

function colorLabel(color: string): string {
  if (color === 'light_blue') return 'Lt Blue';
  return color.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function setRequirement(color: string): number {
  return SET_REQUIREMENTS[color] ?? 0;
}

function rentSchedule(color: string): number[] {
  return RENT_TABLE[color] || [1];
}

function categoryLabel(card: CardData): string {
  if (card.category === 'action') return ACTION_THEME[card.actionType || '']?.title || 'Action Card';
  if (card.category === 'money') return 'Money Card';
  if (card.category === 'rent') return 'Rent Card';
  if (card.category === 'wildcard') return 'Wildcard';
  if (card.category === 'property') return 'Property';
  return card.category;
}

function faceColor(card: CardData): string {
  if (card.category === 'money') return '#1f9e54';
  if (card.category === 'action') return ACTION_THEME[card.actionType || '']?.bg || '#52525b';

  if (card.category === 'property') {
    const color = card.assignedColor || card.colors?.[0] || 'neutral';
    return COLOR_SOLID[color] || COLOR_SOLID.neutral;
  }

  if (card.category === 'rent') {
    if (card.rentColors?.[0] === 'any') return '#6d28d9';
    return COLOR_SOLID[card.rentColors?.[0] || 'neutral'] || COLOR_SOLID.neutral;
  }

  if (card.category === 'wildcard') return '#ffffff';
  return '#e4e4e7';
}

function textColor(card: CardData): string {
  if (card.category === 'wildcard') return 'text-zinc-900';
  if (card.category === 'property') {
    const color = card.assignedColor || card.colors?.[0] || 'neutral';
    return LIGHT_COLORS.has(color) ? 'text-zinc-900' : 'text-white';
  }

  if (card.category === 'rent') {
    const color = card.rentColors?.[0] || 'neutral';
    return LIGHT_COLORS.has(color) ? 'text-zinc-900' : 'text-white';
  }

  if (card.category === 'money') return 'text-white';
  return 'text-white';
}

function detailText(card: CardData): string {
  if (card.category === 'property') {
    const color = card.assignedColor || card.colors?.[0] || 'brown';
    return `${colorLabel(color)} | Full Set ${setRequirement(color)}`;
  }

  if (card.category === 'wildcard') {
    if (card.colors?.[0] === 'any') return 'Any color set';
    return (card.colors || [])
      .map((color) => `${colorLabel(color)} (${setRequirement(color)})`)
      .join(' / ');
  }

  if (card.category === 'rent') {
    if (card.rentColors?.[0] === 'any') return 'Charge rent on any set';
    return (card.rentColors || [])
      .map((color) => `${colorLabel(color)} (${setRequirement(color)})`)
      .join(' / ');
  }

  if (card.category === 'money') return `Bank value $${card.value}M`;
  return card.actionType ? card.actionType.replaceAll('_', ' ') : card.name;
}

function fullSetBadge(card: CardData): string | null {
  if (card.category === 'property') {
    const color = card.assignedColor || card.colors?.[0] || 'brown';
    return `FULL SET ${setRequirement(color)}`;
  }

  if (card.category === 'wildcard' && card.assignedColor) {
    return `SET ${setRequirement(card.assignedColor)}`;
  }

  return null;
}

function currentRent(setColor: string | undefined, setCards: CardData[] | undefined): number | null {
  if (!setColor || !setCards || setCards.length === 0) {
    return null;
  }

  const schedule = rentSchedule(setColor);
  const size = Math.max(1, Math.min(setCards.length, schedule.length));
  let rent = schedule[size - 1];

  const isFullSet = setCards.length >= setRequirement(setColor);
  if (isFullSet && setColor !== 'railroad' && setColor !== 'utility') {
    const houses = setCards.filter((card) => card.actionType === 'house').length;
    const hotels = setCards.filter((card) => card.actionType === 'hotel').length;
    rent += houses * 3 + hotels * 4;
  }

  return rent;
}

function wildcardBands(card: CardData): { top: string; bottom: string; topLabel: string; bottomLabel: string } | null {
  if (card.category !== 'wildcard') return null;

  if (card.colors?.[0] === 'any') {
    return {
      top: '#ff3b30',
      bottom: '#2f56ff',
      topLabel: 'ANY',
      bottomLabel: 'COLOR',
    };
  }

  const topColorKey = card.colors?.[0] || 'neutral';
  const bottomColorKey = card.colors?.[1] || topColorKey;

  return {
    top: COLOR_SOLID[topColorKey] || COLOR_SOLID.neutral,
    bottom: COLOR_SOLID[bottomColorKey] || COLOR_SOLID.neutral,
    topLabel: colorLabel(topColorKey),
    bottomLabel: colorLabel(bottomColorKey),
  };
}

function bandTextClass(colorKey: string): string {
  return LIGHT_COLORS.has(colorKey) ? 'text-zinc-900' : 'text-white';
}

export default function Card({
  card,
  actions,
  wildcardMoveOptions = [],
  onWildcardMove,
  compact = false,
  selected = false,
  setColor,
  setCards,
}: CardProps) {
  const cardWidth = compact ? 'w-[130px]' : 'w-[176px]';
  const cardText = textColor(card);
  const badge = fullSetBadge(card);
  const bands = wildcardBands(card);
  const topBandColorKey = card.colors?.[0] || 'neutral';
  const bottomBandColorKey = card.colors?.[1] || topBandColorKey;
  const effectiveColor = card.category === 'property' ? (card.assignedColor || card.colors?.[0]) : null;
  const schedule = effectiveColor ? rentSchedule(effectiveColor) : [];
  const liveRent = currentRent(setColor, setCards);

  return (
    <article
      className={`${cardWidth} rounded-2xl border-2 ${
        selected ? 'border-amber-400 ring-2 ring-amber-300' : 'border-zinc-100/90'
      } bg-white p-2 shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition-transform hover:-translate-y-0.5`}
    >
      <div
        className="relative overflow-hidden rounded-xl border-2 border-white/85"
        style={{ backgroundColor: faceColor(card), aspectRatio: '63 / 88' }}
      >
        <div className="absolute inset-2 rounded-lg border border-white/40" />

        {bands ? (
          <>
            <div className="absolute inset-x-0 top-0 h-[24%] border-b border-black/30" style={{ backgroundColor: bands.top }}>
              <div className={`pt-1 text-center text-[10px] font-black uppercase tracking-wide ${bandTextClass(topBandColorKey)}`}>
                {bands.topLabel}
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-[24%] border-t border-black/30" style={{ backgroundColor: bands.bottom }}>
              <div className={`pt-2 text-center text-[10px] font-black uppercase tracking-wide ${bandTextClass(bottomBandColorKey)}`}>
                {bands.bottomLabel}
              </div>
            </div>
          </>
        ) : null}

        <div className={`relative flex h-full flex-col justify-between p-2 ${bands ? 'pt-8 pb-8' : ''}`}>
          <div className="flex items-start justify-between gap-1">
            <div className={`rounded-md border border-white/70 bg-black/35 px-2 py-1 text-[10px] font-black uppercase tracking-[0.09em] ${cardText}`}>
              {categoryLabel(card)}
            </div>
            {card.category === 'action' && ACTION_THEME[card.actionType || ''] ? (
              <div className="rounded-md border border-white/70 bg-black/30 p-1 text-white">
                {ACTION_THEME[card.actionType || ''].icon}
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5 text-center">
            <p className={`px-1 text-[12px] font-black leading-4 ${cardText} [text-shadow:0_1px_1px_rgba(0,0,0,0.45)]`}>
              {card.name}
            </p>
            <p className={`px-1 text-[10px] font-bold uppercase tracking-[0.08em] ${cardText} [text-shadow:0_1px_1px_rgba(0,0,0,0.45)]`}>
              {detailText(card)}
            </p>

            {card.category === 'property' && schedule.length > 0 ? (
              <div className="mx-auto flex max-w-[92%] flex-wrap justify-center gap-1 rounded-md border border-black/25 bg-white/90 px-1 py-1 text-[8px] font-black text-zinc-900">
                {schedule.map((value, idx) => (
                  <span key={`${card.id}-rent-${idx}`} className="rounded bg-zinc-100 px-1.5 py-0.5">
                    {idx + 1}:{value}
                  </span>
                ))}
              </div>
            ) : null}

            {liveRent !== null ? (
              <div className="mx-auto inline-flex rounded-full border border-black/25 bg-yellow-200 px-2 py-0.5 text-[9px] font-black tracking-wide text-zinc-900">
                CURRENT RENT ${liveRent}M
              </div>
            ) : null}

            {badge ? (
              <div className="mx-auto inline-flex rounded-full border border-black/25 bg-white/90 px-2 py-0.5 text-[9px] font-black tracking-wide text-zinc-900">
                {badge}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-red-700 bg-white text-[12px] font-extrabold text-red-700 shadow-[0_2px_4px_rgba(0,0,0,0.35)]">
              ${card.value}
            </div>
          </div>
        </div>
      </div>

      {onWildcardMove && wildcardMoveOptions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {wildcardMoveOptions.map((option) => (
            <button
              key={option}
              type="button"
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-[10px] font-bold text-zinc-800 hover:bg-zinc-100"
              onClick={() => onWildcardMove(option)}
            >
              Move {colorLabel(option)}
            </button>
          ))}
        </div>
      ) : null}

      {actions ? <div className="mt-2 flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}
