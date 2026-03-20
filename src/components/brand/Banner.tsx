import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BattleArenaLogo, BattleArenaWordmark } from '@/components/brand/Logo';

interface Battle {
  id: string;
  title?: string;
  room_code: string;
  battle_type: 'ranked' | 'casual' | 'tournament';
  format: '30s' | '60s' | '90s';
  entry_fee_tokens: number;
  status: 'waiting' | 'active' | 'completed';
}

export const HeroBanner = ({ className = "" }) => {
  const gridPattern =
    "data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 60 0 L 0 0 0 60' fill='none' stroke='white' stroke-width='0.5' opacity='0.1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)' /%3E%3C/svg%3E";
  return (
    <div className={`relative w-full h-96 overflow-hidden ${className}`}>
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-orange-900/20 to-pink-900/20" />
      
      {/* Animated background elements */}
      <div className="absolute inset-0">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-gradient-to-r from-orange-500/10 to-pink-500/10 blur-xl"
            style={{
              width: Math.random() * 300 + 100,
              height: Math.random() * 300 + 100,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              x: [0, Math.random() * 100 - 50],
              y: [0, Math.random() * 100 - 50],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{ backgroundImage: `url("${gridPattern}")` }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "backOut" }}
          className="mb-6"
        >
          <BattleArenaLogo size="xl" />
        </motion.div>

        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-4"
        >
          <BattleArenaWordmark size="xl" />
        </motion.div>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="max-w-2xl mx-auto"
        >
          <p className="text-white/80 text-lg mb-3 font-medium">
            Head-to-head audio battles. Real rooms. Real rounds. Real outcomes.
          </p>
          <p className="text-white/55 text-sm uppercase tracking-[0.3em]">
            Queue up. Lock in. Split the room.
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex gap-4"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              href="/app/battles"
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all inline-flex"
            >
              ENTER BATTLE ARENA
            </Link>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              href="/app/battles/room"
              className="px-8 py-3 bg-white/10 backdrop-blur-sm text-white font-bold rounded-full border border-white/20 hover:bg-white/20 transition-all inline-flex"
            >
              WATCH LIVE
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
};

export const BattleBanner = ({ battle, className = "" }: { battle: Battle; className?: string }) => {
  return (
    <div className={`relative w-full h-64 overflow-hidden rounded-2xl ${className}`}>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-orange-900/40 to-pink-900/40" />
      
      {/* Background image for battle banner */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-50"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=400&fit=crop')" }}
      />
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-full">
            {battle.battle_type.toUpperCase()}
          </span>
          <span className="px-3 py-1 bg-purple-500 text-white text-xs font-bold rounded-full">
            {battle.status.toUpperCase()}
          </span>
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-2">
          {battle.title || `Battle ${battle.room_code}`}
        </h3>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-pink-400 rounded-full" />
              <span className="text-white/80 text-sm">vs</span>
              <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full" />
            </div>
            <span className="text-white/60 text-sm">{battle.format}</span>
          </div>
          
          {battle.entry_fee_tokens > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-yellow-400 text-sm font-bold">{battle.entry_fee_tokens}</span>
              <span className="text-white/60 text-sm">TOKENS</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

