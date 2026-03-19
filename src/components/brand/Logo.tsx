import React from 'react';
import { motion } from 'framer-motion';

type LogoSize = "small" | "medium" | "large" | "xl";

export const BattleArenaLogo = ({ size = "medium", className = "" }: { size?: LogoSize; className?: string }) => {
  const sizeClasses = {
    small: "w-8 h-8",
    medium: "w-12 h-12", 
    large: "w-16 h-16",
    xl: "w-24 h-24"
  };

  return (
    <motion.div
      className={`${sizeClasses[size]} ${className}`}
      initial={{ rotate: 0 }}
      animate={{ rotate: 360 }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Outer hexagon */}
        <polygon
          points="50,5 90,27 90,73 50,95 10,73 10,27"
          fill="none"
          stroke="url(#gradient1)"
          strokeWidth="3"
        />
        
        {/* Inner hexagon */}
        <polygon
          points="50,20 75,35 75,65 50,80 25,65 25,35"
          fill="url(#gradient2)"
          stroke="url(#gradient1)"
          strokeWidth="2"
        />
        
        {/* Battle swords cross */}
        <g transform="translate(50, 50)">
          {/* Left sword */}
          <rect x="-2" y="-25" width="4" height="35" fill="url(#gradient1)" />
          <polygon points="-2,-25 2,-25 0,-30" fill="url(#gradient1)" />
          <rect x="-4" y="10" width="8" height="4" fill="url(#gradient1)" />
          
          {/* Right sword */}
          <rect x="-2" y="-25" width="4" height="35" fill="url(#gradient1)" transform="rotate(90)" />
          <polygon points="-2,-25 2,-25 0,-30" fill="url(#gradient1)" transform="rotate(90)" />
          <rect x="-4" y="10" width="8" height="4" fill="url(#gradient1)" transform="rotate(90)" />
        </g>
        
        {/* SplitZone mark */}
        <text x="50" y="92" textAnchor="middle" fill="url(#gradient1)" fontSize="8" fontWeight="bold" fontFamily="Arial Black">
          SPLIT
        </text>
        
        {/* Gradients */}
        <defs>
          <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF6B35" />
            <stop offset="50%" stopColor="#F7931E" />
            <stop offset="100%" stopColor="#FFD23F" />
          </linearGradient>
          <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1A1A2E" />
            <stop offset="100%" stopColor="#16213E" />
          </linearGradient>
        </defs>
      </svg>
    </motion.div>
  );
};

export const BattleArenaWordmark = ({ size = "medium", className = "" }: { size?: LogoSize; className?: string }) => {
  const sizeClasses = {
    small: "text-lg",
    medium: "text-2xl",
    large: "text-4xl",
    xl: "text-6xl"
  };

  return (
    <div className={`${sizeClasses[size]} ${className} font-black tracking-tight`}>
      <span className="bg-gradient-to-r from-orange-500 via-yellow-400 to-orange-600 bg-clip-text text-transparent">
        SPLIT
      </span>
      <span className="bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 bg-clip-text text-transparent">
        ZONE
      </span>
    </div>
  );
};
