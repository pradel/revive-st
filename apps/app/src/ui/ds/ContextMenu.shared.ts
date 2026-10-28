import type { ReactNode } from "react";
import type { PressableProps } from "react-native";

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

/**
 * Props the trigger spreads onto its own `Pressable`. On Android
 * `onLongPress` opens the menu: the trigger's pressable takes the touch, so
 * the menu never sees the long press. On iOS the native context menu handles
 * the gesture and `onLongPress` is absent. Both platforms expose the menu's
 * actions to VoiceOver and TalkBack, which can't long-press.
 */
export type ContextMenuTriggerProps = Pick<
  PressableProps,
  "onLongPress" | "accessibilityActions" | "onAccessibilityAction"
>;

export interface ContextMenuProps extends ContextMenuConfig {
  children: (triggerProps: ContextMenuTriggerProps) => ReactNode;
  /**
   * Stretches the trigger to the container's width (rows, cards) instead of
   * sizing the menu to the trigger (tiles).
   */
  fill?: boolean;
}

function enabledLeaves(
  actions: ContextMenuAction[],
  parentTitle?: string,
): { name: string; label: string }[] {
  return actions.flatMap((action) => {
    if (action.disabled) {
      return [];
    }
    const label = parentTitle
      ? `${parentTitle}: ${action.title}`
      : action.title;
    return action.actions
      ? enabledLeaves(action.actions, label)
      : [{ name: action.id, label }];
  });
}

/** The menu's enabled actions as screen-reader actions on the trigger. */
export function accessibilityMenuProps({
  actions,
  onAction,
}: ContextMenuConfig): ContextMenuTriggerProps {
  return {
    accessibilityActions: enabledLeaves(actions),
    onAccessibilityAction: (event) => {
      onAction(event.nativeEvent.actionName);
    },
  };
}
