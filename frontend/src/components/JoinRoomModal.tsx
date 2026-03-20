'use client';

import React, { useState } from 'react';
import { useSocket } from '@/providers/SocketProvider';
import { useGameStore } from '@/store/useGameStore';
import { motion } from 'framer-motion';

const JoinRoomModal = () => {
  const [roomId, setRoomId] = useState('');
  const [name, setName] = useState('');
  const [isHost, setIsHost] = useState(false);
  const socket = useSocket();
  const { room, setUser } = useGameStore();

  const handleJoin = () => {
    const normalizedRoomId =
      roomId.trim().toUpperCase() ||
      `ROOM-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const normalizedName = name.trim();

    if (!normalizedName || !socket) return;

    const userId = `user_${Math.random().toString(36).slice(2, 11)}`;
    setUser({ id: userId, name: normalizedName, chips: 10000, isHost });

    socket.emit('join_room', {
      roomId: normalizedRoomId,
      playerName: normalizedName,
      isHost,
      isSolo: false
    });
  };

  if (room.roomId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#1a1a2e] border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full"
      >
        <h2 className="text-3xl font-black text-white mb-6 text-center tracking-tight">
          CASINO <span className="text-yellow-500">ROYALE</span>
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest ml-2 mb-1 block">Your Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow-500/50 transition-all"
              placeholder="Enter name..."
            />
          </div>

          <div>
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest ml-2 mb-1 block">Room ID</label>
            <input 
              type="text" 
              value={roomId} 
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow-500/50 transition-all"
              placeholder="Enter room ID or leave blank to create"
            />
          </div>

          <div className="flex items-center gap-2 px-2 py-2">
            <input 
              type="checkbox" 
              id="isHost"
              checked={isHost}
              onChange={(e) => setIsHost(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 bg-white/5 text-yellow-500 focus:ring-yellow-500/20"
            />
            <label htmlFor="isHost" className="text-sm text-gray-300 font-medium">Create as Host</label>
          </div>

          <button 
            onClick={handleJoin}
            className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 mt-4 text-lg"
          >
            ENTER THE ARENA
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default JoinRoomModal;
