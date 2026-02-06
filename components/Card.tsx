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
};

const COLOR_MAP: Record<string, string> = {
  brown: '#8b5a2b',
  light_blue: '#53b5ea',
  pink: '#e85ea8',
  orange: '#ef8f2d',
  red: '#de4037',
  yellow: '#f0d349',
  green: '#39a662',
  blue: '#2457d6',
  railroad: '#252525',
  utility: '#8f8f8f',
  neutral: '#3f3f46',
};

const ACTION_THEME: Record<string, { title: string; icon: ReactNode; bg: string }> = {
  deal_breaker: {
    title: 'Deal Breaker',
    icon: <Building2 className="h-4 w-4" />,
    bg: 'linear-gradient(135deg,#3b82f6 0%,#111827 100%)',
  },
  forced_deal: {
    title: 'Forced Deal',
    icon: <ArrowLeftRight className="h-4 w-4" />,
    bg: 'linear-gradient(135deg,#06b6d4 0%,#1d4ed8 100%)',
  },
  sly_deal: {
    title: 'Sly Deal',
    icon: <HandCoins className="h-4 w-4" />,
    bg: 'linear-gradient(135deg,#f59e0b 0%,#b45309 100%)',
  },
  just_say_no: {
    title: 'Just Say No',
    icon: <Shield className="h-4 w-4" />,
    bg: 'linear-gradient(135deg,#ef4444 0%,#7f1d1d 100%)',
  },
  debt_collector: {
    title: 'Debt Collector',
    icon: <CircleDollarSign className="h-4 w-4" />,
    bg: 'linear-gradient(135deg,#65a30d 0%,#14532d 100%)',
  },
  birthday: {
    title: "It's My Birthday",
    icon: <CircleDollarSign className="h-4 w-4" />,
    bg: 'linear-gradient(135deg,#ec4899 0%,#8b5cf6 100%)',
  },
  double_rent: {
    title: 'Double Rent',
    icon: <CircleDollarSign className="h-4 w-4" />,
    bg: 'linear-gradient(135deg,#f59e0b 0%,#ef4444 100%)',
  },
  house: {
    title: 'House',
    icon: <Building2 className="h-4 w-4" />,
    bg: 'linear-gradient(135deg,#22c55e 0%,#166534 100%)',
  },
  hotel: {
    title: 'Hotel',
    icon: <Building2 className="h-4 w-4" />,
    bg: 'linear-gradient(135deg,#0ea5e9 0%,#1e3a8a 100%)',
  },
  pass_go: {
    title: 'Pass Go',
    icon: <CircleDollarSign className="h-4 w-4" />,
    bg: 'linear-gradient(135deg,#14b8a6 0%,#0f766e 100%)',
  },
};

function colorLabel(color: string): string {
  if (color === 'light_blue') return 'Lt Blue';
  return color.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function cardTone(card: CardData): string {
  if (card.category === 'money') return 'linear-gradient(165deg,#fefce8 0%,#dcfce7 55%,#bbf7d0 100%)';

  if (card.category === 'action') {
    return ACTION_THEME[card.actionType || '']?.bg || 'linear-gradient(165deg,#e4e4e7 0%,#a1a1aa 100%)';
  }

  if (card.category === 'rent') {
    const colors = card.rentColors || [];
    if (colors[0] === 'any') {
      return 'linear-gradient(90deg,#de4037 0%,#f0d349 20%,#39a662 40%,#2457d6 60%,#e85ea8 80%,#8b5a2b 100%)';
    }
    const a = COLOR_MAP[colors[0] || 'neutral'];
    const b = COLOR_MAP[colors[1] || colors[0] || 'neutral'];
    return `linear-gradient(120deg,${a} 0%,${b} 100%)`;
  }

  if (card.category === 'wildcard') {
    const colors = card.colors || [];
    if (colors[0] === 'any') {
      return 'linear-gradient(90deg,#de4037 0%,#f0d349 20%,#39a662 40%,#2457d6 60%,#e85ea8 80%,#8b5a2b 100%)';
    }
    const assigned = card.assignedColor ? [card.assignedColor] : colors;
    const a = COLOR_MAP[assigned[0] || colors[0] || 'neutral'];
    const b = COLOR_MAP[assigned[1] || colors[1] || assigned[0] || 'neutral'];
    return `linear-gradient(135deg,${a} 0%,${b} 100%)`;
  }

  if (card.category === 'property') {
    const tone = COLOR_MAP[card.assignedColor || card.colors?.[0] || 'neutral'];
    return `linear-gradient(165deg,#ffffff 0%,#f4f4f5 55%,${tone}33 100%)`;
  }

  return 'linear-gradient(165deg,#fafafa 0%,#e4e4e7 100%)';
}

function categoryLabel(card: CardData): string {
  if (card.category === 'action') return ACTION_THEME[card.actionType || '']?.title || 'Action Card';
  if (card.category === 'money') return 'Money Card';
  if (card.category === 'rent') return 'Rent Card';
  if (card.category === 'wildcard') return 'Wildcard';
  if (card.category === 'property') return 'Property';
  return card.category;
}

function detailText(card: CardData): string {
  if (card.category === 'property') return colorLabel(card.assignedColor || card.colors?.[0] || 'brown');
  if (card.category === 'wildcard') {
    if (card.colors?.[0] === 'any') return 'Any color set';
    return (card.colors || []).map((color) => colorLabel(color)).join(' / ');
  }
  if (card.category === 'rent') {
    if (card.rentColors?.[0] === 'any') return 'Charge rent on any set';
    return (card.rentColors || []).map((color) => colorLabel(color)).join(' / ');
  }
  if (card.category === 'money') return `Bank value $${card.value}M`;
  return card.actionType ? card.actionType.replaceAll('_', ' ') : card.name;
}

export default function Card({
  card,
  actions,
  wildcardMoveOptions = [],
  onWildcardMove,
  compact = false,
  selected = false,
}: CardProps) {
  const cardWidth = compact ? 'w-[124px]' : 'w-[162px]';

  return (
    <article
      className={`${cardWidth} rounded-2xl border-2 ${
        selected ? 'border-amber-500 ring-2 ring-amber-300' : 'border-white/80'
      } bg-white/95 p-2 shadow-[0_8px_20px_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-0.5`}
    >
      <div
        className="relative overflow-hidden rounded-xl border border-white/80"
        style={{ background: cardTone(card), aspectRatio: '63 / 88' }}
      >
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_50%),radial-gradient(circle_at_80%_75%,white_0,transparent_55%)]" />

        <div className="relative flex h-full flex-col justify-between p-2 text-white">
          <div className="rounded-md border border-white/70 bg-black/25 px-1.5 py-1 text-[10px] font-black uppercase tracking-wide">
            {categoryLabel(card)}
          </div>

          <div className="space-y-1 text-center">
            <p className="px-1 text-[11px] font-black leading-4 text-white drop-shadow">{card.name}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-white/90">{detailText(card)}</p>
          </div>

          <div className="flex justify-end">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-red-600 bg-white/95 text-[11px] font-extrabold text-red-700 shadow-sm">
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
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-100"
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
