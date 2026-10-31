import { getLocales } from "expo-localization";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  View,
  type ViewStyle,
} from "react-native";

import {
  useRadioFavorites,
  useRadioToggleFavorite,
} from "@/features/radio/hooks/useRadioFavorites";
import {
  useRadioFilters,
  useSetRadioFilter,
  type RadioFilterKind,
} from "@/features/radio/hooks/useRadioFilters";
import {
  usePopularStations,
  useRadioCountries,
  useRadioLanguages,
  useRadioStations,
} from "@/features/radio/hooks/useRadioStations";
import type { RadioStation } from "@/features/radio/lib/radio-browser";
import { NowPlayingBar } from "@/features/speakers/components/NowPlayingBar";
import { copyText } from "@/lib/clipboard";
import { haptics } from "@/lib/haptics";
import { Button } from "@/ui/ds/Button";
import type { ContextMenuConfig } from "@/ui/ds/ContextMenu";
import { EmptyState } from "@/ui/ds/EmptyState";
import { FilterChips } from "@/ui/ds/FilterChips";
import { icons } from "@/ui/ds/Icon";
import { IconButton } from "@/ui/ds/IconButton";
import { ListRow } from "@/ui/ds/ListRow";
import { Screen } from "@/ui/ds/Screen";
import { SectionHeader } from "@/ui/ds/SectionHeader";
import { SegmentedControl } from "@/ui/ds/SegmentedControl";
import { Shelf } from "@/ui/ds/Shelf";
import { Text } from "@/ui/ds/Text";
import { Tile } from "@/ui/ds/Tile";
import { nativeIcons } from "@/ui/nativeIcons";
import { color, space } from "@/ui/tokens";

const GENRE_TAGS = [
  "All",
  "Jazz",
  "Classical",
  "Rock",
  "Pop",
  "80s",
  "90s",
  "News",
  "Ambient",
];

const GENRE_OPTIONS = GENRE_TAGS.map((tag) => ({ value: tag, label: tag }));

const TABS = [
  { value: "search", label: "Browse" },
  { value: "favorites", label: "Favorites" },
] as const;

function stationDetail(station: RadioStation) {
  return [
    station.country,
    station.codec,
    station.bitrate ? `${station.bitrate} kbps` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Pages can overlap when the ranking shifts between two loads. */
function uniqueStations(stations: RadioStation[]) {
  return [
    ...new Map(stations.map((station) => [station.stationuuid, station])),
  ].map(([, station]) => station);
}

export default function RadioBrowser() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "favorites">("search");
  const [selectedTag, setSelectedTag] = useState("All");
  const {
    data: filters,
    isError: filtersFailed,
    refetch: refetchFilters,
  } = useRadioFilters();
  const { mutate: setFilter } = useSetRadioFilter();
  const country = filters?.country ?? null;
  const language = filters?.language ?? null;
  const regionCode = getLocales()[0]?.regionCode ?? null;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  const { data: favorites = [] } = useRadioFavorites();
  const { mutate: toggleFavorite } = useRadioToggleFavorite();
  // Name the chips of the chosen filters; loading them here also opens the
  // pickers on a ready list.
  const { data: countries } = useRadioCountries();
  const { data: languages } = useRadioLanguages();
  // A chosen country already fills the list with its popular stations.
  const { data: popularNearby = [] } = usePopularStations(
    filters && !country ? regionCode : null,
  );

  const {
    data,
    isPending,
    isLoadingError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useRadioStations(
    // Waits for the saved filters rather than loading every station first.
    filters
      ? {
          query: debouncedQuery,
          tag: selectedTag === "All" ? null : selectedTag,
          countryCode: country,
          language,
        }
      : null,
  );
  const stations = uniqueStations(
    data?.pages.flatMap((page) => page.stations) ?? [],
  );

  const [refreshing, setRefreshing] = useState(false);
  const refreshStations = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Country and language narrow the browse list; only a search or a genre
  // turns it into results and hides the shelves.
  const isSearching = Boolean(debouncedQuery.trim()) || selectedTag !== "All";

  const countryName = country
    ? (countries?.find((entry) => entry.code === country)?.name ?? country)
    : null;
  const languageName = language
    ? (languages?.find((entry) => entry.name === language)?.label ?? language)
    : null;

  const listTitle = isSearching
    ? "Search results"
    : countryName
      ? `Popular in ${countryName}`
      : languageName
        ? `Popular in ${languageName}`
        : "Popular worldwide";

  const activeFilters = (["country", "language"] as const).filter((kind) =>
    Boolean(filters?.[kind]),
  );

  const openFilter = (kind: RadioFilterKind) => {
    haptics.selection();
    router.push({ pathname: "/radio-filter", params: { kind } });
  };

  const openStationSheet = (
    station: RadioStation,
    mode: "play" | "preset" = "play",
  ) => {
    router.push({
      pathname: "/cast",
      params: {
        stationuuid: station.stationuuid,
        name: station.name,
        favicon: station.favicon,
        mode,
      },
    });
  };

  const isFavorite = (station: RadioStation) =>
    favorites.some((fav) => fav.stationuuid === station.stationuuid);

  const toggleStationFavorite = (station: RadioStation) => {
    const isFav = isFavorite(station);
    haptics.toggle(!isFav);
    toggleFavorite({ station, isFavorite: isFav });
  };

  const stationMenu = (station: RadioStation): ContextMenuConfig => {
    const isFav = isFavorite(station);
    return {
      actions: [
        { id: "play", title: "Play on…", icon: nativeIcons.cast },
        { id: "preset", title: "Save to preset…", icon: nativeIcons.save },
        {
          id: "favorite",
          title: isFav ? "Remove from favorites" : "Add to favorites",
          icon: isFav ? nativeIcons.starSlash : nativeIcons.star,
        },
        { id: "copy", title: "Copy stream URL", icon: nativeIcons.copy },
      ],
      onAction: (id) => {
        if (id === "play") {
          openStationSheet(station);
        } else if (id === "preset") {
          openStationSheet(station, "preset");
        } else if (id === "favorite") {
          toggleStationFavorite(station);
        } else {
          void copyText(
            station.url_resolved || station.url,
            "Stream URL copied",
          )
            .then((needsConfirmation) => {
              if (needsConfirmation) {
                haptics.success();
              }
            })
            .catch(() => {
              haptics.error();
            });
        }
      },
    };
  };

  const renderStationRow = ({ item }: { item: RadioStation }) => {
    const isFav = isFavorite(item);

    return (
      <ListRow
        title={item.name}
        subtitle={stationDetail(item)}
        artworkUri={item.favicon || null}
        fallbackIcon={icons.radio}
        onPress={() => {
          openStationSheet(item);
        }}
        menu={stationMenu(item)}
        trailing={
          <IconButton
            icon={isFav ? icons.starFilled : icons.star}
            accessibilityLabel={
              isFav ? "Remove from favorites" : "Add to favorites"
            }
            tint={isFav ? "accent" : "textSecondary"}
            onPress={() => {
              toggleStationFavorite(item);
            }}
          />
        }
      />
    );
  };

  const renderStationTile = (station: RadioStation, subtitle?: string) => (
    <Tile
      key={station.stationuuid}
      title={station.name}
      subtitle={subtitle}
      artworkUri={station.favicon || null}
      fallbackIcon={icons.radio}
      onPress={() => {
        openStationSheet(station);
      }}
      menu={stationMenu(station)}
    />
  );

  const renderBrowseEmpty = () => {
    // Stations wait for the saved filters, so a filter failure comes first.
    if (filtersFailed) {
      return (
        <EmptyState
          icon={icons.warning}
          title="Couldn't load your filters"
          description="Your country and language filters couldn't be read."
          actions={
            <Button
              label="Retry"
              variant="secondary"
              onPress={() => {
                void refetchFilters();
              }}
            />
          }
        />
      );
    }
    if (isPending) {
      return (
        <View style={$loading}>
          <ActivityIndicator size="small" color={color.textSecondary} />
          <Text variant="subhead" color="textSecondary">
            Fetching stations…
          </Text>
        </View>
      );
    }
    if (isLoadingError) {
      return (
        <EmptyState
          icon={icons.warning}
          title="Search failed"
          description={
            error instanceof Error
              ? error.message
              : "Could not retrieve radio stations. Please check your internet connection."
          }
          actions={
            <Button
              label="Retry"
              variant="secondary"
              onPress={() => {
                void refetch();
              }}
            />
          }
        />
      );
    }
    return (
      <EmptyState
        icon={icons.radio}
        title="No stations found"
        description="Try a different search term, genre, country or language."
      />
    );
  };

  const controls = (
    <View style={$controls}>
      <SegmentedControl
        options={TABS}
        value={activeTab}
        onChange={setActiveTab}
      />
    </View>
  );

  const browseHeader = (
    <>
      {controls}
      <FilterChips
        options={[
          {
            value: "country",
            label: countryName ?? "Any country",
          },
          {
            value: "language",
            label: languageName ?? "Any language",
          },
        ]}
        value={activeFilters}
        style={$tags}
        onSelect={openFilter}
      />
      <FilterChips
        options={GENRE_OPTIONS}
        value={selectedTag}
        style={$tags}
        onSelect={(tag) => {
          haptics.selection();
          setSelectedTag(selectedTag === tag ? "All" : tag);
        }}
      />
      {favorites.length > 0 && !isSearching && (
        <Shelf title="Your favorites">
          {favorites.map((station) =>
            renderStationTile(station, station.country),
          )}
        </Shelf>
      )}
      {regionCode !== null &&
        !country &&
        popularNearby.length > 0 &&
        !isSearching && (
          <Shelf
            title="Popular near you"
            action={{
              label: "See all",
              onPress: () => {
                setFilter({ kind: "country", value: regionCode });
              },
            }}
          >
            {popularNearby.map((station) =>
              renderStationTile(station, station.tags.split(",")[0]),
            )}
          </Shelf>
        )}
      {!isPending && !isLoadingError && stations.length > 0 && (
        <SectionHeader title={listTitle} />
      )}
    </>
  );

  return (
    <Screen inTabs footer={<NowPlayingBar />}>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={nativeIcons.add}
          accessibilityLabel="Play a stream URL"
          onPress={() => {
            router.push("/stream-url");
          }}
        />
      </Stack.Toolbar>
      <Stack.SearchBar
        placeholder="Search stations"
        autoCapitalize="none"
        onChangeText={(event) => {
          setQuery(event.nativeEvent.text);
          if (event.nativeEvent.text !== "") {
            setActiveTab("search");
          }
        }}
        onSearchButtonPress={(event) => {
          setQuery(event.nativeEvent.text);
          setDebouncedQuery(event.nativeEvent.text);
          setActiveTab("search");
        }}
        onCancelButtonPress={() => {
          setQuery("");
        }}
        onClose={() => {
          setQuery("");
        }}
      />

      {activeTab === "search" ? (
        <FlatList
          data={isPending || isLoadingError ? [] : stations}
          keyExtractor={(item) => item.stationuuid}
          renderItem={renderStationRow}
          ListHeaderComponent={browseHeader}
          ListEmptyComponent={renderBrowseEmpty()}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={$loadingMore}>
                <ActivityIndicator size="small" color={color.textSecondary} />
              </View>
            ) : isFetchNextPageError ? (
              <View style={$loadingMore}>
                <Text variant="subhead" color="textSecondary">
                  Couldn't load more stations.
                </Text>
                <Button
                  label="Retry"
                  variant="secondary"
                  onPress={() => {
                    void fetchNextPage();
                  }}
                />
              </View>
            ) : undefined
          }
          onEndReached={() => {
            // After a failed page, loading more waits for the Retry button.
            if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
              void fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          contentContainerStyle={$listContent}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refreshStations()}
              tintColor={color.textSecondary}
              colors={[color.accent]}
              progressBackgroundColor={color.surface2}
            />
          }
        />
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.stationuuid}
          renderItem={renderStationRow}
          ListHeaderComponent={controls}
          contentContainerStyle={$listContent}
          contentInsetAdjustmentBehavior="automatic"
          ListEmptyComponent={
            <EmptyState
              icon={icons.starFilled}
              title="No favorites yet"
              description="Stations you star will appear here for quick access."
              actions={
                <Button
                  label="Find stations"
                  variant="secondary"
                  onPress={() => {
                    setActiveTab("search");
                  }}
                />
              }
            />
          }
        />
      )}
    </Screen>
  );
}

const $controls: ViewStyle = {
  paddingHorizontal: space.screen,
  paddingBottom: space.sm,
};

const $tags: ViewStyle = {
  paddingVertical: space.xxs,
};

const $listContent: ViewStyle = {
  paddingBottom: space.xl,
};

const $loading: ViewStyle = {
  alignItems: "center",
  gap: space.sm,
  paddingVertical: space.xxxl,
};

const $loadingMore: ViewStyle = {
  alignItems: "center",
  gap: space.sm,
  paddingVertical: space.lg,
};
