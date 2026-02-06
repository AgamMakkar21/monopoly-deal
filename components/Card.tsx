'use client';

import type { ReactNode } from 'react';

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
};

const COLOR_MAP: Record<string, string> = {
  brown: '#8B5A2B',
  light_blue: '#8ED1FC',
  pink: '#FF7AB8',
  orange: '#F38B2A',
  red: '#D74141',
  yellow: '#F2D13D',
  green: '#43A35E',
  blue: '#2D56C6',
  railroad: '#181818',
  utility: '#8A8A8A',
  neutral: '#2E2E2E',
};

function colorLabel(color: string): string {
  if (color === 'light_blue') {
    return 'Lt Blue';
  }
  return color.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function headerColor(card: CardData): string {
  if (card.category === 'property' || card.category === 'wildcard') {
    const chosen = card.assignedColor || card.colors?.[0];
    if (chosen === 'any') {
      return 'linear-gradient(90deg, #D74141 0%, #F2D13D 25%, #43A35E 50%, #2D56C6 75%, #FF7AB8 100%)';
    }
    return COLOR_MAP[chosen || 'neutral'] || COLOR_MAP.neutral;
  }

  if (card.category === 'rent') {
    const first = card.rentColors?.[0] || 'neutral';
    if (first === 'any') {
      return 'linear-gradient(90deg, #D74141 0%, #F2D13D 25%, #43A35E 50%, #2D56C6 75%, #FF7AB8 100%)';
    }
    return COLOR_MAP[first] || COLOR_MAP.neutral;
  }

  return COLOR_MAP.neutral;
}

function subtitle(card: CardData): string {
  if (card.category === 'property' || card.category === 'wildcard') {
    if (card.assignedColor) {
      return `Set: ${colorLabel(card.assignedColor)}`;
    }
    if (card.colors?.[0] === 'any') {
      return 'Wild: Any Color';
    }
    return `Color: ${(card.colors || []).map(colorLabel).join(' / ')}`;
  }

  if (card.category === 'rent') {
    if (card.rentColors?.[0] === 'any') {
      return 'Rent: Any Color';
    }
    return `Rent: ${(card.rentColors || []).map(colorLabel).join(' / ')}`;
  }

  if (card.actionType) {
    return card.actionType.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return card.category.toUpperCase();
}

export default function Card({
  card,
  actions,
  wildcardMoveOptions = [],
  onWildcardMove,
  compact = false,
}: CardProps) {
  return (
    <article
      className={`rounded-xl border border-zinc-300 bg-white shadow-sm ${
        compact ? 'w-40 p-2' : 'w-56 p-3'
      }`}
    >
      <header
        className="mb-2 rounded-md px-2 py-1 text-xs font-semibold text-white"
        style={{ background: headerColor(card) }}
      >
        {card.category.toUpperCase()}
      </header>

      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">{card.name}</h3>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-red-600 text-xs font-bold text-red-700">
          ${card.value}M
        </div>
      </div>

      <p className="min-h-10 text-xs text-zinc-600">{subtitle(card)}</p>

      {onWildcardMove && wildcardMoveOptions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {wildcardMoveOptions.map((option) => (
            <button
              key={option}
              type="button"
              className="rounded border border-zinc-300 px-2 py-1 text-[10px] font-medium text-zinc-700 hover:bg-zinc-100"
              onClick={() => onWildcardMove(option)}
            >
              Move to {colorLabel(option)}
            </button>
          ))}
        </div>
      ) : null}

      {actions ? <div className="mt-2 flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}
