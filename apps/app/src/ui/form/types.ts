import type { ReactNode } from "react";

export interface FormProps {
  children: ReactNode;
  /** Enables pull-to-refresh; the indicator stays until the promise settles. */
  onRefresh?: () => Promise<void>;
}
