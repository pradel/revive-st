import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
} from "react";

import { useWifiProvisioningSideEffects } from "./hooks/useWifiProvisioning";
import { provisioningReducer } from "./reducer";
import {
  initialState,
  type ProvisioningAction,
  type ProvisioningState,
} from "./types";

interface ProvisioningContextValue {
  state: ProvisioningState;
  dispatch: React.Dispatch<ProvisioningAction>;
  start: () => void;
}

const ProvisioningContext = createContext<ProvisioningContextValue | null>(
  null,
);

function ProvisioningSideEffects() {
  const { state, dispatch } = useProvisioning();
  useWifiProvisioningSideEffects(state, dispatch);
  return null;
}

export function ProvisioningProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(provisioningReducer, initialState);
  const start = useCallback(() => {
    dispatch({ type: "START" });
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, start }),
    [state, dispatch, start],
  );

  return (
    <ProvisioningContext.Provider value={value}>
      {children}
      <ProvisioningSideEffects />
    </ProvisioningContext.Provider>
  );
}

export function useProvisioning() {
  const ctx = useContext(ProvisioningContext);
  if (!ctx) {
    throw new Error(
      "useProvisioning must be used within a ProvisioningProvider",
    );
  }
  return ctx;
}
