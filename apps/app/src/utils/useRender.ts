import React, { cloneElement, isValidElement } from "react";

export function mergeProps(
  parentProps: Record<string, unknown>,
  childProps: Record<string, unknown>,
) {
  const merged: Record<string, unknown> = { ...parentProps, ...childProps };

  if (parentProps.style && childProps.style) {
    merged.style = [parentProps.style, childProps.style];
  }

  for (const key in childProps) {
    if (
      key.startsWith("on") &&
      typeof childProps[key] === "function" &&
      typeof parentProps[key] === "function"
    ) {
      merged[key] = (...args: unknown[]) => {
        (parentProps[key] as (...args: unknown[]) => void)(...args);
        (childProps[key] as (...args: unknown[]) => void)(...args);
      };
    }
  }

  return merged;
}

export interface UseRenderOptions {
  render?:
    | React.ReactElement
    | ((props: Record<string, unknown>) => React.ReactElement);
  props: Record<string, unknown>;
  defaultElement: React.ReactElement;
}

export function useRender({ render, props, defaultElement }: UseRenderOptions) {
  if (render) {
    const element = typeof render === "function" ? render(props) : render;
    if (isValidElement(element)) {
      // eslint-disable-next-line react/no-clone-element
      return cloneElement(
        element as React.ReactElement<any>,
        mergeProps(props, element.props as Record<string, unknown>),
      );
    }
  }
  // eslint-disable-next-line react/no-clone-element
  return cloneElement(
    defaultElement,
    mergeProps(props, defaultElement.props as Record<string, unknown>),
  );
}
