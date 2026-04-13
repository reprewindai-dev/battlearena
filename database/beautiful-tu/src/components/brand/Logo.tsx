"use client";

type LogoSize = "small" | "medium" | "large" | "xl";

const sizeClasses: Record<LogoSize, string> = {
  small: "h-8 w-8",
  medium: "h-11 w-11",
  large: "h-14 w-14",
  xl: "h-20 w-20",
};

const wordmarkClasses: Record<LogoSize, string> = {
  small: "text-2xl",
  medium: "text-3xl",
  large: "text-5xl",
  xl: "text-7xl",
};

export const BattleArenaLogo = ({
  size = "medium",
  className = "",
}: {
  size?: LogoSize;
  className?: string;
}) => {
  return (
    <div
      className={`${sizeClasses[size]} ${className} rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(30,25,39,0.96),rgba(15,14,20,0.98))] p-2 shadow-[0_14px_40px_rgba(0,0,0,0.34)]`}
    >
      <svg viewBox="0 0 96 96" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="spitzone-core" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f7dd8e" />
            <stop offset="35%" stopColor="#f3b842" />
            <stop offset="68%" stopColor="#ff7a1a" />
            <stop offset="100%" stopColor="#f2447a" />
          </linearGradient>
          <linearGradient id="spitzone-frame" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
          </linearGradient>
        </defs>

        <rect x="7" y="7" width="82" height="82" rx="22" fill="none" stroke="url(#spitzone-frame)" strokeWidth="2" />
        <path
          d="M64 18H34L24 29V39L66 50L72 58V66L62 76H31"
          fill="none"
          stroke="url(#spitzone-core)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="9"
        />
        <path
          d="M27 29H67"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeDasharray="5 5"
          strokeWidth="2"
        />
        <circle cx="72" cy="49" r="4.5" fill="#f3b842" />
        <circle cx="24" cy="39" r="4.5" fill="#f2447a" />
      </svg>
    </div>
  );
};

export const BattleArenaWordmark = ({
  size = "medium",
  className = "",
}: {
  size?: LogoSize;
  className?: string;
}) => {
  return (
    <div className={`${wordmarkClasses[size]} ${className} flex flex-col leading-none`}>
      <span className="spitzone-display spitzone-wordmark">Spitzone</span>
      <span className="mt-1 text-[0.58em] font-medium uppercase tracking-[0.42em] text-white/58">
        live frequency battles
      </span>
    </div>
  );
};
