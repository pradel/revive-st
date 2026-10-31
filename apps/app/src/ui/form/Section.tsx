import { FieldGroup, Text } from "@expo/ui";
import type { ReactNode } from "react";

import { color, type } from "@/ui/tokens";

const header = {
  fontSize: type.overline.fontSize,
  fontWeight: type.overline.fontWeight,
  letterSpacing: type.overline.letterSpacing,
  color: color.textSecondary,
};

/**
 * Grouped form section. On iOS a `FieldGroup.Section` whose title is a small
 * uppercase label, like the app's other section headers (`SectionHeader`);
 * `Section.android.tsx` also makes link rows clickable across the whole item.
 */
export function FormSection({
  title,
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <FieldGroup.Section>
      {title ? (
        <FieldGroup.SectionHeader>
          <Text textStyle={header}>{title.toUpperCase()}</Text>
        </FieldGroup.SectionHeader>
      ) : null}
      {children}
    </FieldGroup.Section>
  );
}
