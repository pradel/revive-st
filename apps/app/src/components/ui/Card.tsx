import React from "react";
import { View, type ViewProps, type ViewStyle } from "react-native";

import { COLORS } from "../../ui/theme";
import { useRender } from "../../utils/useRender";

export interface CardProps extends ViewProps {
  children?: React.ReactNode;
  render?: React.ReactElement | ((props: any) => React.ReactElement);
}

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
  backgroundColor: COLORS.card,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: COLORS.border,
};
