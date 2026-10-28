import type { ReactNode } from "react";

import type { nativeIcons } from "@/ui/nativeIcons";

export interface ContextMenuAction {
  id: string;
  title: string;
  icon?: (typeof nativeIcons)[keyof typeof nativeIcons];
  destructive?: boolean;
  disabled?: boolean;
  /** Shows a checkmark: `true` on, `false` off, omitted for plain actions. */
  checked?: boolean;
  /** Nested actions, shown as a submenu. */
  actions?: ContextMenuAction[];
}

/** Long-press menu for a ds component that offers one (row, tile, card). */
export interface ContextMenuConfig {
  actions: ContextMenuAction[];
  onAction: (id: string) => void;
}

export interface ContextMenuProps extends ContextMenuConfig {
  /**
   * Renders the trigger. On Android, pass `openMenu` to the trigger's own
   * `onLongPress`: its pressable takes the touch, so the menu's wrapper never
   * sees the long press. On iOS the native context menu handles the gesture
   * and `openMenu` is `undefined`.
   */
  children: (openMenu: (() => void) | undefined) => ReactNode;
  /**
   * Stretches the trigger to the container's width (rows, cards) instead of
   * sizing the menu to the trigger (tiles).
   */
  fill?: boolean;
}
