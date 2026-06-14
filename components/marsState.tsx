import { createContext, useContext, useEffect, useState } from "react";
import { EMPTY_STATE } from "./marsData";
import type { MarsState } from "./marsData";

// Polls /api/state (the JSON DB, derived) and shares it with the whole
// dashboard. The single source of truth — no mock data.

const Ctx = createContext<{ state: MarsState; ready: boolean }>({ state: EMPTY_STATE, ready: false });

export function MarsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MarsState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/state", { cache: "no-store" });
        const d = await r.json();
        if (alive && d && d.stats) {
          setState({ ...EMPTY_STATE, ...d });
          setReady(true);
        }
      } catch {
        /* keep last good */
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return <Ctx.Provider value={{ state, ready }}>{children}</Ctx.Provider>;
}

export function useMars() {
  return useContext(Ctx);
}
