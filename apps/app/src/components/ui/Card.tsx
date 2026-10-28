import React from "react";
import { View, type ViewProps, type ViewStyle } from "react-native";

import { color, radius, space } from "../../ui/tokens";
import { useRender } from "../../utils/useRender";

export interface CardProps extends ViewProps {
  children?: React.ReactNode;
  render?: React.ReactElement | ((props: any) => React.ReactElement);
}

/** Grouped content on the first surface step; no border (see `ui/tokens`). */
export function Card({ children, style, render, ...props }: CardProps) {
  return useRender({
    render,
    props: {
      style: [$card, style],
      children,
      ...props,
    },
    defaultElement: <View />,
  });
}

const $card: ViewStyle = {
  backgroundColor: color.surface1,
  borderRadius: radius.md,
  padding: space.md,
};
