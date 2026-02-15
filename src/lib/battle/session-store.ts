import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type BattleSessionMode = "mock" | "supabase";

type BattleSessionState = {
  battleId: string | null;
  mode: BattleSessionMode | null;
  setSession: (session: { battleId: string; mode: BattleSessionMode }) => void;
  clear: () => void;
};

export const useBattleSessionStore = create<BattleSessionState>()(
  persist(
    (set) => ({
      battleId: null,
      mode: null,
      setSession: ({ battleId, mode }) => set({ battleId, mode }),
      clear: () => set({ battleId: null, mode: null }),
    }),
    {
      name: "arena_battle_session",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ battleId: state.battleId, mode: state.mode }),
    },
  ),
);
