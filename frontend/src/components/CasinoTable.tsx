import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/providers/SocketProvider';
import JoinRoomModal from './JoinRoomModal';
import Card from './Card';
import { audioManager } from '@/lib/audio';
import confetti from 'canvas-confetti';

const CasinoTable = () => {
  const { room, user, myHand } = useGameStore();
  const { players, gameState, engineState } = room;
  const socket = useSocket();
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [betAmount, setBetAmount] = useState(100);

  // Audio triggers
  useEffect(() => {
    if (gameState === 'PLAYING') audioManager.play('deal');
    if (engineState?.winner === user?.id) {
        audioManager.play('win');
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#fbbf24', '#f59e0b', '#ffffff']
        });
    }
  }, [gameState, engineState?.winner, user?.id]);

  const isMyTurn = engineState?.currentPlayerId === user?.id;

  // Position players around the oval table
  // 0: Bottom (Self), 1: Left, 2: Top, 3: Right
  const positions = [
    'bottom-32 left-1/2 -translate-x-1/2',
    'left-8 top-1/2 -translate-y-1/2',
    'top-8 left-1/2 -translate-x-1/2',
    'right-8 top-1/2 -translate-y-1/2',
  ];

  const handleToggleCard = (id: string) => {
    audioManager.play('flip');
    setSelectedCardIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAction = (action: string, payload: any = {}) => {
    if (!socket) return;
    audioManager.play('click');
    socket.emit('game_action', { action, ...payload });
  };

  const handlePlayCards = () => {
    if (selectedCardIds.length === 0) return;
    handleAction('play_cards', { cards: selectedCardIds });
    setSelectedCardIds([]);
  };

  const handlePlaceBet = () => {
    audioManager.play('chip');
    handleAction('place_bet', { amount: betAmount });
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-[#0a0a14] overflow-hidden flex items-center justify-center p-4 font-[family-name:var(--font-geist-sans)]">
      {/* The Oval Table */}
      <div className="relative w-[95%] max-w-6xl aspect-[2.2/1] bg-gradient-to-br from-green-900 to-green-950 rounded-[240px] border-8 border-[#3d2b1f] shadow-[0_0_150px_rgba(0,0,0,0.9),inset_0_0_80px_rgba(0,0,0,0.6)] flex items-center justify-center">
        {/* Felt Texture Overlay */}
        <div className="absolute inset-0 rounded-[232px] opacity-20 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] pointer-events-none" />
        
        {/* Players */}
        {players.map((player, idx) => (
          <div
            key={player.id}
            className={`absolute ${positions[idx]} p-4 flex flex-col items-center gap-2 transform scale-90 sm:scale-100 z-10`}
          >
            <div className={`w-20 h-20 rounded-full border-4 ${player.id === engineState?.currentPlayerId ? 'border-yellow-400 ring-8 ring-yellow-400/20' : 'border-white/10'} bg-gray-900 flex items-center justify-center text-3xl shadow-2xl relative`}>
                {player.isBot ? '🤖' : '🙋'}
                {player.isReady && gameState === 'LOBBY' && (
                   <div className="absolute -bottom-2 px-2 bg-green-500 rounded text-[10px] text-white font-black uppercase">READY</div>
                )}
            </div>
            <div className="bg-black/80 px-4 py-1 rounded-full text-[10px] font-black text-white border border-white/10 uppercase tracking-widest shadow-lg">
              {player.name}
            </div>
            <div className="flex items-center gap-1 text-yellow-500 font-bold text-sm bg-black/40 px-2 rounded-lg">
                <span className="text-xs">💰</span> {player.chips.toLocaleString()}
            </div>
          </div>
        ))}

        {/* Center Contents: Pot, Deck, Last Played */}
        <div className="flex flex-col items-center gap-8">
            <AnimatePresence>
                {engineState?.bets && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-black/60 backdrop-blur-md px-10 py-3 rounded-3xl border border-yellow-500/30 flex flex-col items-center shadow-2xl"
                    >
                        <span className="text-[10px] text-yellow-500/80 font-black uppercase tracking-[0.2em]">Total Stakes</span>
                        <span className="text-3xl font-black text-yellow-400 tabular-nums">
                            {Object.values(engineState.bets).reduce((a, b) => a + b, 0).toLocaleString()}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
            
            <div className="flex items-center gap-12">
                {/* Deck */}
                <div className="relative w-28 h-40 bg-red-900 rounded-2xl border-2 border-white/20 shadow-[0_15px_30px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden rotate-[-5deg]">
                    <div className="w-full h-full bg-[repeating-linear-gradient(45deg,#800,#800_10px,#900_10px,#900_20px)]" />
                    <div className="absolute inset-4 border border-white/5 rounded-xl" />
                </div>

                {/* Last Played Cards */}
                <div className="flex -space-x-12 translate-x-6">
                    <AnimatePresence mode="popLayout">
                        {engineState?.lastPlayedCards?.map((card, i) => (
                            <motion.div
                                key={`${card.id}-${i}`}
                                initial={{ scale: 0, rotate: -45, x: -100 }}
                                animate={{ scale: 1, rotate: 0, x: 0 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                            >
                                <Card card={card} />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </div>
      </div>

      {/* Betting Overlay */}
      <AnimatePresence>
          {gameState === 'BETTING' && !engineState?.bets[user?.id || ''] && (
              <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md flex items-center justify-center"
              >
                  <div className="bg-[#1a1a2e] p-8 rounded-[40px] border border-white/10 shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full">
                      <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">Place Your Bet</h3>
                      <div className="flex items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/10 w-full justify-between">
                          <button onClick={() => setBetAmount(Math.max(100, betAmount - 100))} className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all">-</button>
                          <span className="text-3xl font-black text-yellow-500 tabular-nums">{betAmount.toLocaleString()}</span>
                          <button onClick={() => setBetAmount(betAmount + 100)} className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all">+</button>
                      </div>
                      <button 
                        onClick={handlePlaceBet}
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-5 rounded-3xl shadow-[0_10px_30px_rgba(22,163,74,0.3)] transition-all active:scale-95 text-xl tracking-widest cursor-pointer"
                      >
                        CONFIRM BET
                      </button>
                  </div>
              </motion.div>
          )}
      </AnimatePresence>

      {/* My Hand HUD */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl flex flex-col items-center pb-8 z-30 pointer-events-none">
          <div className="flex -space-x-12 mb-8 pointer-events-auto">
              <AnimatePresence>
                {myHand.map((card, i) => (
                    <Card 
                        key={card.id} 
                        card={card} 
                        index={i} 
                        onClick={() => handleToggleCard(card.id)}
                        isSelected={selectedCardIds.includes(card.id)}
                    />
                ))}
              </AnimatePresence>
          </div>

          <div className="flex gap-4 pointer-events-auto">
            {gameState === 'LOBBY' && user?.isHost && (
                <button 
                    onClick={() => handleAction('start_game')}
                    className="bg-red-600 hover:bg-red-500 text-white px-12 py-4 rounded-2xl font-black shadow-xl transition-all active:scale-95 border-b-4 border-red-800 uppercase tracking-widest text-lg cursor-pointer"
                >
                    Start Game
                </button>
            )}

            {gameState === 'PLAYING' && isMyTurn && (
                <div className="flex gap-4">
                    <button 
                        onClick={handlePlayCards}
                        disabled={selectedCardIds.length === 0}
                        className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black px-12 py-4 rounded-2xl font-black shadow-xl transition-all active:scale-95 border-b-4 border-yellow-700 uppercase tracking-widest text-lg cursor-pointer"
                    >
                        Play Move
                    </button>
                    <button 
                        onClick={() => handleAction('pass_turn')}
                        className="bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-2xl font-black shadow-xl transition-all active:scale-95 border border-white/20 uppercase tracking-widest text-lg cursor-pointer backdrop-blur-md"
                    >
                        Pass
                    </button>
                </div>
            )}
          </div>
      </div>

      <JoinRoomModal />
    </div>
  );
};

export default CasinoTable;

