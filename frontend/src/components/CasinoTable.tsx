'use client';

import React from 'react';
import { useGameStore } from '@/store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';

const CasinoTable = () => {
  const { room, user } = useGameStore();
  const { players, gameState } = room;

  // Position players around the oval table
  // 0: Bottom (Self), 1: Left, 2: Top, 3: Right
  const positions = [
    'bottom-4 left-1/2 -translate-x-1/2',
    'left-4 top-1/2 -translate-y-1/2',
    'top-4 left-1/2 -translate-x-1/2',
    'right-4 top-1/2 -translate-y-1/2',
  ];

  return (
    <div className="relative w-full h-full min-h-screen bg-[#0a0a14] overflow-hidden flex items-center justify-center p-4">
      {/* The Oval Table */}
      <div className="relative w-[90%] max-w-5xl aspect-[2/1] bg-gradient-to-br from-green-900 to-green-950 rounded-[200px] border-8 border-[#3d2b1f] shadow-[0_0_100px_rgba(0,0,0,0.8),inset_0_0_50px_rgba(0,0,0,0.5)] flex items-center justify-center">
        {/* Felt Texture Overlay */}
        <div className="absolute inset-0 rounded-[192px] opacity-20 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] pointer-events-none" />
        
        {/* Table Logo or Felt Pattern */}
        <div className="text-green-800/20 text-9xl font-black select-none uppercase tracking-tighter">
          CASINO
        </div>

        {/* Players */}
        {players.map((player, idx) => (
          <div
            key={player.id}
            className={`absolute ${positions[idx]} p-4 flex flex-col items-center gap-2`}
          >
            <div className={`w-20 h-20 rounded-full border-4 ${player.id === room.engineState?.currentPlayerId ? 'border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.5)]' : 'border-gray-700'} bg-gray-800 flex items-center justify-center text-3xl overflow-hidden relative`}>
                {player.isBot ? '🤖' : '🙋'}
                {player.isReady && (
                   <div className="absolute bottom-0 w-full bg-green-500 text-[10px] text-center font-bold">READY</div>
                )}
            </div>
            <div className="bg-black/60 px-3 py-1 rounded-full text-xs font-bold text-white border border-white/10">
              {player.name}
            </div>
            <div className="flex items-center gap-1 text-yellow-500 font-bold text-sm">
                <span className="text-xs">💰</span> {player.chips.toLocaleString()}
            </div>
          </div>
        ))}

        {/* Center: Pot & Deck */}
        <div className="flex flex-col items-center gap-4">
            {room.engineState?.bets && (
                <div className="bg-black/40 px-6 py-2 rounded-2xl border border-yellow-500/30 flex flex-col items-center">
                    <span className="text-[10px] text-yellow-500/70 font-bold uppercase tracking-widest">Total Pot</span>
                    <span className="text-2xl font-black text-yellow-400">
                        {Object.values(room.engineState.bets).reduce((a, b) => a + b, 0).toLocaleString()}
                    </span>
                </div>
            )}
            
            <div className="relative w-24 h-36 bg-red-900 rounded-lg border-2 border-white/20 shadow-2xl flex items-center justify-center overflow-hidden">
                <div className="w-full h-full bg-[repeating-linear-gradient(45deg,#800,#800_10px,#900_10px,#900_20px)]" />
                <div className="absolute inset-4 border border-white/10 rounded" />
            </div>
        </div>
      </div>

      {/* Controls HUD */}
      <div className="absolute bottom-8 right-8 flex gap-4">
          {gameState === 'LOBBY' && (
              <button className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-xl font-black shadow-lg transition-all active:scale-95 border-b-4 border-green-800">
                  READY
              </button>
          )}
      </div>

      {/* Ambient Lighting FX */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none bg-[radial-gradient(circle_at_50%_-20%,rgba(59,130,246,0.1),transparent_70%)]" />
    </div>
  );
};

export default CasinoTable;
