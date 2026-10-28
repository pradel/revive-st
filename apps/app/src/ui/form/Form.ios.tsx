import { FieldGroup, Host } from "@expo/ui";
import {
  background,
  refreshable,
  scrollContentBackground,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import { color } from "@/ui/tokens";

import type { FormProps } from "./types";

/** iOS: SwiftUI `Form` on the app background, with native pull-to-refresh. */
export function Form({ children, onRefresh }: FormProps) {
  return (
    <Host style={$fill} colorScheme="dark">
      <FieldGroup
        modifiers={[
          scrollContentBackground("hidden"),
          background(color.bg),
          tint(color.accent),
          ...(onRefresh ? [refreshable(onRefresh)] : []),
        ]}
      >
        {children}
      </FieldGroup>
    </Host>
  );
}

const $fill = { flex: 1 };
