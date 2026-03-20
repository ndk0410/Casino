'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card as CardType } from '@/types/game';

interface CardProps {
  card: CardType;
  index?: number;
  isFolded?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}

const Card = ({
  card,
  index = 0,
  isFolded = false,
  onClick,
  isSelected = false,
}: CardProps) => {
  const getSuitColor = (suit: string) => {
    return suit === 'h' || suit === 'd' ? 'text-red-500' : 'text-black';
  };

  const getSuitIcon = (suit: string) => {
    switch (suit) {
      case 'h':
        return '\u2665';
      case 'd':
        return '\u2666';
      case 'c':
        return '\u2663';
      case 's':
        return '\u2660';
      default:
        return '';
    }
  };

  return (
    <motion.div
      layoutId={card.id}
      initial={{ opacity: 0, y: 50 }}
      animate={{
        opacity: 1,
        y: isSelected ? -20 : 0,
        transition: {
          delay: index * 0.05,
          type: 'spring',
          stiffness: 260,
          damping: 20,
        },
      }}
      whileHover={{ y: isSelected ? -25 : -10, scale: 1.02 }}
      onClick={onClick}
      className="card-perspective"
    >
      <div
        className={`card-inner ${isFolded ? 'card-flip' : ''} w-24 h-36 border-2 ${
          isSelected
            ? 'border-yellow-400 ring-4 ring-yellow-400/20'
            : 'border-black/5'
        } rounded-xl shadow-xl cursor-pointer select-none`}
      >
        <div
          className={`card-face bg-white rounded-xl p-2 flex flex-col justify-between ${getSuitColor(card.suit)}`}
        >
          <div className="flex flex-col items-start leading-none">
            <span className="text-xl font-black">{card.rank}</span>
            <span className="text-lg">{getSuitIcon(card.suit)}</span>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl opacity-10">
            {getSuitIcon(card.suit)}
          </div>
          <div className="flex flex-col items-end leading-none rotate-180">
            <span className="text-xl font-black">{card.rank}</span>
            <span className="text-lg">{getSuitIcon(card.suit)}</span>
          </div>
        </div>

        <div className="card-face card-back bg-red-900 rounded-xl flex items-center justify-center overflow-hidden">
          <div className="w-full h-full bg-[repeating-linear-gradient(45deg,#800,#800_10px,#900_10px,#900_20px)]" />
          <div className="absolute inset-2 border border-white/20 rounded-lg opacity-40" />
        </div>
      </div>
    </motion.div>
  );
};

export default Card;
