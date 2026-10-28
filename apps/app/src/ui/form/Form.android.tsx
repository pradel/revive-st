import { FieldGroup, Host } from "@expo/ui";
import { PullToRefreshBox } from "@expo/ui/jetpack-compose";
import { fillMaxSize } from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";

import { color } from "@/ui/tokens";

import type { FormProps } from "./types";

/** Android: Material 3 grouped list on the app background, with pull-to-refresh. */
export function Form({ children, onRefresh }: FormProps) {
  const [refreshing, setRefreshing] = useState(false);

  const group = (
    <FieldGroup style={{ backgroundColor: color.bg }}>{children}</FieldGroup>
  );

  return (
    <Host style={$fill} colorScheme="dark" seedColor={color.accent}>
      {onRefresh ? (
        <PullToRefreshBox
          isRefreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void onRefresh().finally(() => {
              setRefreshing(false);
            });
          }}
          indicator={{ color: color.accent, containerColor: color.surface2 }}
          contentAlignment="topCenter"
          modifiers={[fillMaxSize()]}
        >
          {group}
        </PullToRefreshBox>
      ) : (
        group
      )}
    </Host>
  );
}

const $fill = { flex: 1 };
