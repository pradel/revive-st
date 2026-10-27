import type { ReactNode } from "react";
import { ActivityIndicator, View, type ViewStyle } from "react-native";

import { color, space, type ColorName } from "@/ui/tokens";

import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export type StepStatus = "pending" | "active" | "done" | "error";

export interface StepListItem {
  id: string;
  title: string;
  status: StepStatus;
  /** Secondary line under the title; shown in `danger` for a failed step. */
  description?: string;
  /** Right-aligned content, e.g. an elapsed time or countdown. */
  trailing?: ReactNode;
}

export interface StepListProps {
  steps: StepListItem[];
}

const STATUS_ICON: Record<
  Exclude<StepStatus, "active">,
  { name: IconName; color: ColorName }
> = {
  pending: {
    name: {
      ios: "circle",
      android: "radio_button_unchecked",
      web: "radio_button_unchecked",
    },
    color: "textTertiary",
  },
  done: {
    name: {
      ios: "checkmark.circle.fill",
      android: "check_circle",
      web: "check_circle",
    },
    color: "accent",
  },
  error: {
    name: {
      ios: "exclamationmark.triangle.fill",
      android: "warning",
      web: "warning",
    },
    color: "danger",
  },
};

const TITLE_COLOR: Record<StepStatus, ColorName> = {
  pending: "textTertiary",
  active: "textPrimary",
  done: "textSecondary",
  error: "textPrimary",
};

/** Vertical progress checklist: one row per step with a status glyph. */
export function StepList({ steps }: StepListProps) {
  return (
    <View style={$list}>
      {steps.map((step) => {
        const emphasized = step.status === "active" || step.status === "error";
        return (
          <View key={step.id} style={$row}>
            <View style={$icon}>
              {step.status === "active" ? (
                <ActivityIndicator size="small" color={color.accent} />
              ) : (
                <Icon
                  name={STATUS_ICON[step.status].name}
                  color={STATUS_ICON[step.status].color}
                />
              )}
            </View>
            <View style={$text}>
              <Text
                variant={emphasized ? "headline" : "body"}
                color={TITLE_COLOR[step.status]}
              >
                {step.title}
              </Text>
              {step.description ? (
                <Text
                  variant="caption"
                  color={step.status === "error" ? "danger" : "textSecondary"}
                >
                  {step.description}
                </Text>
              ) : null}
            </View>
            {step.trailing}
          </View>
        );
      })}
    </View>
  );
}

const $list: ViewStyle = {
  gap: space.xxs,
};

const $row: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.sm,
  paddingVertical: space.xs,
};

const $icon: ViewStyle = {
  width: 24,
  alignItems: "center",
  alignSelf: "flex-start",
  paddingTop: 1,
};

const $text: ViewStyle = {
  flex: 1,
  gap: 2,
};
