import {
  Button,
  ContextMenu as SwiftUIContextMenu,
  Host,
  Menu,
  RNHostView,
  Toggle,
} from "@expo/ui/swift-ui";
import { disabled } from "@expo/ui/swift-ui/modifiers";
import { useState } from "react";
import { View, type LayoutChangeEvent, type ViewStyle } from "react-native";

import type { ContextMenuAction, ContextMenuProps } from "./ContextMenu.types";

export type {
  ContextMenuAction,
  ContextMenuConfig,
  ContextMenuProps,
} from "./ContextMenu.types";

function renderItem(action: ContextMenuAction, onAction: (id: string) => void) {
  const systemImage = typeof action.icon === "string" ? action.icon : undefined;
  if (action.actions) {
    return (
      <Menu key={action.id} label={action.title} systemImage={systemImage}>
        {action.actions.map((child) => renderItem(child, onAction))}
      </Menu>
    );
  }
  const modifiers = action.disabled ? [disabled(true)] : undefined;
  if (action.checked !== undefined) {
    return (
      <Toggle
        key={action.id}
        label={action.title}
        systemImage={systemImage}
        isOn={action.checked}
        onIsOnChange={() => {
          onAction(action.id);
        }}
        modifiers={modifiers}
      />
    );
  }
  return (
    <Button
      key={action.id}
      label={action.title}
      systemImage={systemImage}
      role={action.destructive ? "destructive" : undefined}
      modifiers={modifiers}
      onPress={() => {
        onAction(action.id);
      }}
    />
  );
}

/**
 * Long-press menu: the system context menu, which lifts the trigger as its
 * preview. Built on SwiftUI directly rather than the community `MenuView`,
 * whose trigger always sizes to its content and so can't fill a row.
 */
export function ContextMenu({
  actions,
  onAction,
  children,
  fill = false,
}: ContextMenuProps) {
  // Hosted React Native content lays out at its natural width, so a filling
  // trigger gets the host's measured width explicitly.
  const [width, setWidth] = useState<number>();
  const menu = (
    <Host matchContents={fill ? { vertical: true } : true}>
      <SwiftUIContextMenu>
        <SwiftUIContextMenu.Trigger>
          <RNHostView matchContents>
            <View style={fill ? { width } : undefined}>
              {children(undefined)}
            </View>
          </RNHostView>
        </SwiftUIContextMenu.Trigger>
        <SwiftUIContextMenu.Items>
          {actions.map((action) => renderItem(action, onAction))}
        </SwiftUIContextMenu.Items>
      </SwiftUIContextMenu>
    </Host>
  );
  if (!fill) {
    return menu;
  }
  return (
    <View
      style={$fill}
      onLayout={(event: LayoutChangeEvent) => {
        setWidth(event.nativeEvent.layout.width);
      }}
    >
      {menu}
    </View>
  );
}

const $fill: ViewStyle = {
  flex: 1,
};
