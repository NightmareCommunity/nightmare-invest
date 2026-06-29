import { create } from "zustand";
import { api, type PublicUser } from "./api-client";

export type Route =
  | { name: "landing" }
  | { name: "login" }
  | { name: "signup" }
  | { name: "forgot" }
  | { name: "legal"; doc: "tos" | "privacy" | "cookies" | "risk" }
  // investor
  | { name: "dashboard" }
  | { name: "portfolio" }
  | { name: "transactions" }
  | { name: "reports" }
  | { name: "settings" }
  // admin
  | { name: "admin-dashboard" }
  | { name: "admin-investors" }
  | { name: "admin-fund" }
  | { name: "admin-nav" }
  | { name: "admin-transactions" }
  | { name: "admin-ledger" }
  | { name: "admin-audit" };

interface AppState {
  user: PublicUser | null;
  hasFund: boolean;
  loading: boolean;
  route: Route;
  setRoute: (r: Route) => void;
  refresh: () => Promise<void>;
  setUser: (u: PublicUser | null) => void;
  logout: () => Promise<void>;
}

const PUBLIC_ROUTES = new Set(["landing", "login", "signup", "forgot", "legal"]);

export const useApp = create<AppState>((set, get) => ({
  user: null,
  hasFund: false,
  loading: true,
  route: { name: "landing" },
  setRoute: (r) => set({ route: r }),
  setUser: (u) => set({ user: u }),
  refresh: async () => {
    set({ loading: true });
    try {
      const res = await api.get<{ user: PublicUser | null; hasFund: boolean }>("/api/auth/me");
      set({ user: res.user, hasFund: res.hasFund, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  logout: async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      /* ignore */
    }
    set({ user: null, route: { name: "landing" } });
  },
}));

export function isPublicRoute(r: Route): boolean {
  return PUBLIC_ROUTES.has(r.name);
}
