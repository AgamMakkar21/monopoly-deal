'use client';

import type { CSSProperties, ReactNode } from 'react';
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
  onCardClick?: () => void;
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
const RAINBOW_TEXT_GRADIENT =
  'linear-gradient(90deg,#ff5a45 0%,#ff9730 18%,#ffd84a 34%,#35cf76 50%,#48cfff 66%,#4f67ff 82%,#ff61c2 100%)';

const ACTION_THEME: Record<string, { title: string; icon: ReactNode; bg: string; hint: string }> = {
  deal_breaker: {
    title: 'Deal Breaker',
    icon: <Building2 className="h-4 w-4" />,
    bg: '#1440cf',
    hint: 'Steal full set',
  },
  forced_deal: {
    title: 'Forced Deal',
    icon: <ArrowLeftRight className="h-4 w-4" />,
    bg: '#0f7cc2',
    hint: 'Swap one property',
  },
  sly_deal: {
    title: 'Sly Deal',
    icon: <HandCoins className="h-4 w-4" />,
    bg: '#dc7f00',
    hint: 'Steal one property',
  },
  just_say_no: {
    title: 'Just Say No',
    icon: <Shield className="h-4 w-4" />,
    bg: '#cb2e2e',
    hint: 'Cancel action',
  },
  debt_collector: {
    title: 'Debt Collector',
    icon: <CircleDollarSign className="h-4 w-4" />,
    bg: '#4b8f1b',
    hint: 'Collect $5M',
  },
  birthday: {
    title: "It's My Birthday",
    icon: <CircleDollarSign className="h-4 w-4" />,
    bg: '#c53f9d',
    hint: 'Everyone pays $2M',
  },
  double_rent: {
    title: 'Double Rent',
    icon: <CircleDollarSign className="h-4 w-4" />,
    bg: '#cc5c1f',
    hint: 'Double next rent',
  },
  house: {
    title: 'House',
    icon: <Building2 className="h-4 w-4" />,
    bg: '#1f9952',
    hint: '+$3 on full set',
  },
  hotel: {
    title: 'Hotel',
    icon: <Building2 className="h-4 w-4" />,
    bg: '#0a6fb5',
    hint: '+$4 with house',
  },
  pass_go: {
    title: 'Pass Go',
    icon: <CircleDollarSign className="h-4 w-4" />,
    bg: '#0f8d86',
    hint: 'Draw 2 cards',
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

function faceColor(card: CardData): string {
  if (card.category === 'money') {
    const moneyColor: Record<number, string> = {
      1: '#22a45b',
      2: '#2f8bcf',
      3: '#df7f1d',
      4: '#af4fcb',
      5: '#d6ac18',
      10: '#4f5fb4',
    };
    return moneyColor[card.value] || '#1f9e54';
  }
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
  const isAnyWildcard = card.category === 'wildcard' && card.colors?.[0] === 'any';
  const isAnyRent = card.category === 'rent' && card.rentColors?.[0] === 'any';
  if (isAnyWildcard || isAnyRent) return 'text-white';

  if (card.category === 'wildcard') return 'text-zinc-900';

  if (card.category === 'property') {
    const color = card.assignedColor || card.colors?.[0] || 'neutral';
    return LIGHT_COLORS.has(color) ? 'text-zinc-900' : 'text-white';
  }

  if (card.category === 'rent') {
    const color = card.rentColors?.[0] || 'neutral';
    return LIGHT_COLORS.has(color) ? 'text-zinc-900' : 'text-white';
  }

  return 'text-white';
}

function cardTitle(card: CardData): string {
  if (card.category === 'money') return `$${card.value}M Money`;
  if (card.category === 'action') return ACTION_THEME[card.actionType || '']?.title || card.name;
  return card.name;
}

function cardHint(card: CardData): string {
  if (card.category === 'action') {
    return ACTION_THEME[card.actionType || '']?.hint || 'Use action';
  }

  if (card.category === 'money') return 'Bank this';
  if (card.category === 'wildcard') return 'Counts as either color';
  if (card.category === 'rent') return 'Charge set rent';
  if (card.category === 'property') return 'Bank or build set';

  return '';
}

function detailText(card: CardData): string {
  if (card.category === 'property') {
    const color = card.assignedColor || card.colors?.[0] || 'brown';
    return `${colorLabel(color)} | Full Set ${setRequirement(color)}`;
  }

  if (card.category === 'wildcard') {
    if (card.colors?.[0] === 'any') return 'Works with all colors';
    return (card.colors || []).map((color) => `${colorLabel(color)} (${setRequirement(color)})`).join(' / ');
  }

  if (card.category === 'rent') {
    if (card.rentColors?.[0] === 'any') return 'Any set rent';
    return (card.rentColors || []).map((color) => `${colorLabel(color)} (${setRequirement(color)})`).join(' / ');
  }

  if (card.category === 'money') return `Value $${card.value}M`;
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

function wildcardBands(card: CardData): { top: string; bottom: string; topLabel: string; bottomLabel: string; topKey: string; bottomKey: string } | null {
  if (card.category !== 'wildcard') return null;

  if (card.colors?.[0] === 'any') {
    return {
      top: '#111111',
      bottom: '#111111',
      topLabel: 'ANY',
      bottomLabel: 'COLOR',
      topKey: 'any',
      bottomKey: 'any',
    };
  }

  const topKey = card.colors?.[0] || 'neutral';
  const bottomKey = card.colors?.[1] || topKey;

  return {
    top: COLOR_SOLID[topKey] || COLOR_SOLID.neutral,
    bottom: COLOR_SOLID[bottomKey] || COLOR_SOLID.neutral,
    topLabel: colorLabel(topKey),
    bottomLabel: colorLabel(bottomKey),
    topKey,
    bottomKey,
  };
}

function bandTextClass(colorKey: string): string {
  if (colorKey === 'any') {
    return 'text-white';
  }
  return LIGHT_COLORS.has(colorKey) ? 'text-zinc-900' : 'text-white';
}

function lineClampStyle(lines: number) {
  return {
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  };
}

function rainbowTextStyle(): CSSProperties {
  return {
    backgroundImage: RAINBOW_TEXT_GRADIENT,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
  };
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
  onCardClick,
}: CardProps) {
  const cardWidth = compact ? 'w-[142px]' : 'w-[176px]';
  const cardText = textColor(card);
  const badge = fullSetBadge(card);
  const bands = wildcardBands(card);

  const effectiveColor = card.category === 'property' ? (card.assignedColor || card.colors?.[0]) : null;
  const schedule = effectiveColor ? rentSchedule(effectiveColor) : [];
  const liveRent = currentRent(setColor, setCards);
  const isAnyWildcard = card.category === 'wildcard' && card.colors?.[0] === 'any';
  const isAnyRent = card.category === 'rent' && card.rentColors?.[0] === 'any';
  const useRainbowText = isAnyWildcard || isAnyRent;
  const rainbowStyle = useRainbowText ? rainbowTextStyle() : undefined;
  const isSplitRent = card.category === 'rent' && !isAnyRent && (card.rentColors?.length || 0) > 1;
  const splitRentTop = COLOR_SOLID[card.rentColors?.[0] || 'neutral'] || COLOR_SOLID.neutral;
  const splitRentBottom =
    COLOR_SOLID[card.rentColors?.[1] || card.rentColors?.[0] || 'neutral'] || COLOR_SOLID.neutral;

  const faceStyle: CSSProperties = {
    aspectRatio: '63 / 88',
    backgroundColor: faceColor(card),
  };

  if (useRainbowText) {
    faceStyle.background = 'none';
    faceStyle.backgroundColor = '#050505';
  }

  return (
    <article
      className={`${cardWidth} rounded-2xl border-2 ${
        selected ? 'border-amber-400 ring-2 ring-amber-300' : 'border-zinc-100/90'
      } bg-white p-2 shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition-transform hover:-translate-y-0.5 ${
        onCardClick ? 'cursor-pointer' : ''
      }`}
      onClick={onCardClick}
    >
      <div
        className="relative overflow-hidden rounded-xl border-2 border-white/85"
        style={faceStyle}
      >
        <div className="absolute inset-2 rounded-lg border border-white/35" />

        {isSplitRent ? (
          <>
            <div className="absolute inset-x-0 top-0 h-1/2 border-b border-black/30" style={{ backgroundColor: splitRentTop }} />
            <div className="absolute inset-x-0 bottom-0 h-1/2 border-t border-black/30" style={{ backgroundColor: splitRentBottom }} />
          </>
        ) : null}

        {bands ? (
          <>
            <div
              className="absolute inset-x-0 top-0 z-10 h-[22%] border-b-2 border-black/30"
              style={{ background: bands.top }}
            >
              <div
                className={`flex h-full items-center justify-center px-1 text-center text-[10px] font-black uppercase tracking-wide ${bandTextClass(bands.topKey)}`}
                style={bands.topKey === 'any' ? rainbowStyle : undefined}
              >
                {bands.topLabel}
              </div>
            </div>
            <div
              className="absolute inset-x-0 bottom-0 z-10 h-[22%] border-t-2 border-black/30"
              style={{ background: bands.bottom }}
            >
              <div
                className={`flex h-full items-center justify-center px-1 text-center text-[10px] font-black uppercase tracking-wide ${bandTextClass(bands.bottomKey)}`}
                style={bands.bottomKey === 'any' ? rainbowStyle : undefined}
              >
                {bands.bottomLabel}
              </div>
            </div>
          </>
        ) : null}

        <div className={`relative z-20 flex h-full flex-col justify-between p-2 ${bands ? 'pt-10 pb-10' : ''}`}>
          <div className="flex items-start justify-between gap-1">
            <div className={`rounded-md border border-white/70 bg-black/35 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${cardText}`}>
              {card.category.toUpperCase()}
            </div>
            {card.category === 'action' && ACTION_THEME[card.actionType || ''] ? (
              <div className="rounded-md border border-white/70 bg-black/30 p-1 text-white">
                {ACTION_THEME[card.actionType || ''].icon}
              </div>
            ) : null}
          </div>

          <div className="space-y-1 text-center">
            <p
              className={`mx-auto break-words px-1 font-black ${compact ? 'text-[10px] leading-3.5' : 'text-[12px] leading-4'} ${cardText} [text-shadow:0_1px_1px_rgba(0,0,0,0.5)]`}
              style={lineClampStyle(2)}
            >
              <span style={rainbowStyle}>{cardTitle(card)}</span>
            </p>

            <p
              className={`mx-auto break-words px-1 font-extrabold tracking-[0.01em] ${compact ? 'text-[8px] leading-3' : 'text-[9px] leading-3'} ${cardText} [text-shadow:0_1px_1px_rgba(0,0,0,0.5)]`}
              style={lineClampStyle(compact ? 1 : 2)}
            >
              <span style={rainbowStyle}>{cardHint(card)}</span>
            </p>

            <p
              className={`mx-auto break-words px-1 font-bold tracking-[0.01em] ${compact ? 'text-[8px] leading-3' : 'text-[9px] leading-3'} ${cardText} [text-shadow:0_1px_1px_rgba(0,0,0,0.45)]`}
              style={lineClampStyle(2)}
            >
              <span style={rainbowStyle}>{detailText(card)}</span>
            </p>

            {card.category === 'property' && schedule.length > 0 ? (
              <div className="mx-auto flex max-w-[94%] flex-wrap justify-center gap-1 rounded-md border border-black/25 bg-white/90 px-1 py-1 text-[8px] font-black text-zinc-900">
                {schedule.map((value, idx) => (
                  <span key={`${card.id}-rent-${idx}`} className="rounded bg-zinc-100 px-1.5 py-0.5">
                    {idx + 1}:{value}
                  </span>
                ))}
              </div>
            ) : null}

            {liveRent !== null ? (
              <div className="mx-auto inline-flex rounded-full border border-black/25 bg-yellow-200 px-2 py-0.5 text-[9px] font-black tracking-wide text-zinc-900">
                RENT ${liveRent}M
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
        <div className="mt-2 flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>
          {wildcardMoveOptions.map((option) => (
            <button
              key={option}
              type="button"
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-[10px] font-bold text-zinc-800 hover:bg-zinc-100"
              onClick={(event) => {
                event.stopPropagation();
                onWildcardMove(option);
              }}
            >
              Move {colorLabel(option)}
            </button>
          ))}
        </div>
      ) : null}

      {actions ? (
        <div className="mt-2 flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
          {actions}
        </div>
      ) : null}
    </article>
  );
}
