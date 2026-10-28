import { Host } from "@expo/ui";
import { LazyColumn, PullToRefreshBox } from "@expo/ui/jetpack-compose";
import { background, fillMaxSize } from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";

import { color } from "@/ui/tokens";

import type { FormProps } from "./types";

/**
 * Android: Material 3 grouped list on the app background, with
 * pull-to-refresh. Laid out like `FieldGroup`, which would wrap our
 * `FormSection`s in sections of their own.
 */
export function Form({ children, onRefresh }: FormProps) {
  const [refreshing, setRefreshing] = useState(false);

  const group = (
    <LazyColumn
      verticalArrangement={{ spacedBy: 24 }}
      contentPadding={{ start: 16, end: 16, top: 16, bottom: 16 }}
      modifiers={[background(color.bg)]}
    >
      {children}
    </LazyColumn>
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
