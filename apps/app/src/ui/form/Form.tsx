import { FieldGroup, Host } from "@expo/ui";

import type { FormProps } from "./types";

/**
 * Grouped settings form. Platform files (`Form.ios.tsx`, `Form.android.tsx`)
 * add native styling and pull-to-refresh; this fallback is the plain group.
 */
export function Form({ children }: FormProps) {
  return (
    <Host style={$fill}>
      <FieldGroup>{children}</FieldGroup>
    </Host>
  );
}

const $fill = { flex: 1 };
