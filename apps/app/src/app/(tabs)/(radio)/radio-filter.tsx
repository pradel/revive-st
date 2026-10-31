import { getLocales } from "expo-localization";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  View,
  type ViewStyle,
} from "react-native";

import {
  useRadioFilters,
  useSetRadioFilter,
  type RadioFilterKind,
} from "@/features/radio/hooks/useRadioFilters";
import {
  useRadioCountries,
  useRadioLanguages,
} from "@/features/radio/hooks/useRadioStations";
import { haptics } from "@/lib/haptics";
import { Button } from "@/ui/ds/Button";
import { EmptyState } from "@/ui/ds/EmptyState";
import { Icon, icons } from "@/ui/ds/Icon";
import { ListRow } from "@/ui/ds/ListRow";
import { Screen } from "@/ui/ds/Screen";
import { Text } from "@/ui/ds/Text";
import { artwork, color, radius, space } from "@/ui/tokens";

interface Option {
  /** Empty for "any". */
  value: string;
  label: string;
  subtitle?: string;
  /** Flag or language code drawn as the row's artwork. */
  badge?: string;
}

const COPY: Record<
  RadioFilterKind,
  { title: string; any: string; search: string }
> = {
  country: {
    title: "Country",
    any: "Any country",
    search: "Search countries",
  },
  language: {
    title: "Language",
    any: "Any language",
    search: "Search languages",
  },
};

const stationCount = (count: number) =>
  count === 1 ? "1 station" : `${count} stations`;

/** `FR` → 🇫🇷: each letter maps to its regional indicator symbol. */
const flag = (countryCode: string) =>
  String.fromCodePoint(
    ...Array.from(
      countryCode.toUpperCase(),
      (letter) => letter.charCodeAt(0) + 0x1f1a5,
    ),
  );

/** The device's own country or language first, then the rest in order. */
function suggestedFirst(options: Option[], suggested: string | undefined) {
  const index = options.findIndex((option) => option.value === suggested);
  if (index <= 0) {
    return options;
  }
  return [
    options[index],
    ...options.slice(0, index),
    ...options.slice(index + 1),
  ];
}

/** Picks the Radio tab's country or language filter. */
export default function RadioFilterScreen() {
  const router = useRouter();
  const { kind } = useLocalSearchParams<{ kind: RadioFilterKind }>();
  const copy = COPY[kind];
  const [query, setQuery] = useState("");
  const { data: filters } = useRadioFilters();
  const { mutate: setFilter } = useSetRadioFilter();

  const countries = useRadioCountries();
  const languages = useRadioLanguages();
  const list = kind === "country" ? countries : languages;
  const locale = getLocales()[0];

  const options =
    kind === "country"
      ? suggestedFirst(
          (countries.data ?? []).map((entry) => ({
            value: entry.code,
            label: entry.name,
            subtitle: stationCount(entry.stationCount),
            badge: flag(entry.code),
          })),
          locale?.regionCode ?? undefined,
        )
      : suggestedFirst(
          (languages.data ?? []).map((entry) => ({
            value: entry.name,
            label: entry.label,
            subtitle: stationCount(entry.stationCount),
            badge: (entry.code ?? entry.name.slice(0, 2)).toUpperCase(),
          })),
          languages.data?.find((entry) => entry.code === locale?.languageCode)
            ?.name,
        );

  const needle = query.trim().toLowerCase();
  const rows: Option[] = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : [{ value: "", label: copy.any }, ...options];
  const selected = filters?.[kind] ?? "";

  const select = (value: string) => {
    haptics.selection();
    setFilter({ kind, value: value || null });
    router.back();
  };

  const renderEmpty = () => {
    if (list.isLoading) {
      return (
        <View style={$loading}>
          <ActivityIndicator size="small" color={color.textSecondary} />
        </View>
      );
    }
    if (list.isError) {
      return (
        <EmptyState
          icon={icons.warning}
          title={`Couldn't load the ${kind === "country" ? "countries" : "languages"}`}
          description="Check your internet connection and try again."
          actions={
            <Button
              label="Retry"
              variant="secondary"
              onPress={() => {
                void list.refetch();
              }}
            />
          }
        />
      );
    }
    return <EmptyState icon={icons.search} title={`No match for "${query}"`} />;
  };

  return (
    <Screen>
      <Stack.Title>{copy.title}</Stack.Title>
      <Stack.SearchBar
        placeholder={copy.search}
        autoCapitalize="none"
        onChangeText={(event) => {
          setQuery(event.nativeEvent.text);
        }}
        onCancelButtonPress={() => {
          setQuery("");
        }}
        onClose={() => {
          setQuery("");
        }}
      />
      <FlatList
        data={list.data ? rows : []}
        keyExtractor={(option) => option.value || "any"}
        renderItem={({ item }) => (
          <ListRow
            title={item.label}
            subtitle={item.subtitle}
            leading={
              <View style={$badge}>
                {item.badge ? (
                  <Text variant="subhead">{item.badge}</Text>
                ) : (
                  <Icon name={icons.radio} size={20} />
                )}
              </View>
            }
            selected={item.value === selected}
            onPress={() => {
              select(item.value);
            }}
          />
        )}
        ListEmptyComponent={renderEmpty()}
        contentContainerStyle={$listContent}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </Screen>
  );
}

const $listContent: ViewStyle = {
  paddingBottom: space.xl,
};

const $badge: ViewStyle = {
  width: artwork.row,
  height: artwork.row,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: radius.xs,
  backgroundColor: color.surface2,
};

const $loading: ViewStyle = {
  alignItems: "center",
  paddingVertical: space.xl,
};
