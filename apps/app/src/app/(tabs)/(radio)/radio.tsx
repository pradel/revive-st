import { useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  View,
  type ViewStyle,
} from "react-native";
import type { SearchBarCommands } from "react-native-screens";

import {
  useRadioFavorites,
  useRadioToggleFavorite,
} from "@/features/radio/hooks/useRadioFavorites";
import {
  useRadioStations,
  type RadioStation,
} from "@/features/radio/hooks/useRadioStations";
import { NowPlayingBar } from "@/features/speakers/components/NowPlayingBar";
import { Button } from "@/ui/ds/Button";
import { Chip } from "@/ui/ds/Chip";
import { EmptyState } from "@/ui/ds/EmptyState";
import { icons } from "@/ui/ds/Icon";
import { IconButton } from "@/ui/ds/IconButton";
import { ListRow } from "@/ui/ds/ListRow";
import { Screen } from "@/ui/ds/Screen";
import { SectionHeader } from "@/ui/ds/SectionHeader";
import { SegmentedControl } from "@/ui/ds/SegmentedControl";
import { Shelf } from "@/ui/ds/Shelf";
import { Text } from "@/ui/ds/Text";
import { Tile } from "@/ui/ds/Tile";
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

export default function RadioBrowser() {
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "favorites">("search");
  const [selectedTag, setSelectedTag] = useState<string | null>("All");
  const searchBarRef = useRef<SearchBarCommands>(null);

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

  const {
    data: stations,
    isLoading,
    isError,
    error,
    refetch: refetchStations,
  } = useRadioStations(
    debouncedQuery,
    selectedTag === "All" ? null : selectedTag,
  );

  const [refreshing, setRefreshing] = useState(false);
  const refreshStations = async () => {
    setRefreshing(true);
    await refetchStations();
    setRefreshing(false);
  };

  const isSearching = Boolean(debouncedQuery) || selectedTag !== "All";

  const handleSearch = (searchQuery = query, tag = selectedTag) => {
    setQuery(searchQuery);
    setDebouncedQuery(searchQuery);
    setSelectedTag(tag ?? "All");
    setActiveTab("search");
  };

  const handleStationPress = (station: RadioStation) => {
    router.push({
      pathname: "/cast",
      params: { name: station.name, url: station.url_resolved || station.url },
    });
  };

  const renderStationRow = ({ item }: { item: RadioStation }) => {
    const isFav = favorites.some((fav) => fav.stationuuid === item.stationuuid);

    return (
      <ListRow
        title={item.name}
        subtitle={stationDetail(item)}
        artworkUri={item.favicon || null}
        fallbackIcon={icons.radio}
        onPress={() => {
          handleStationPress(item);
        }}
        trailing={
          <IconButton
            icon={isFav ? icons.starFilled : icons.star}
            accessibilityLabel={
              isFav ? "Remove from favorites" : "Add to favorites"
            }
            tint={isFav ? "accent" : "textSecondary"}
            onPress={() => {
              toggleFavorite({ station: item, isFavorite: isFav });
            }}
          />
        }
      />
    );
  };

  const renderBrowseEmpty = () => {
    if (isLoading) {
      return (
        <View style={$loading}>
          <ActivityIndicator size="small" color={color.textSecondary} />
          <Text variant="subhead" color="textSecondary">
            Fetching stations…
          </Text>
        </View>
      );
    }
    if (isError) {
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
                void queryClient.refetchQueries({
                  queryKey: ["radio-stations"],
                });
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
        description="Try a different search term or genre tag."
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={$tags}
      >
        {GENRE_TAGS.map((tag) => (
          <Chip
            key={tag}
            label={tag}
            selected={selectedTag === tag}
            onPress={() => {
              const nextTag = selectedTag === tag ? "All" : tag;
              searchBarRef.current?.clearText();
              handleSearch("", nextTag);
            }}
          />
        ))}
      </ScrollView>
      {favorites.length > 0 && !isSearching && (
        <Shelf title="Your favorites">
          {favorites.map((station) => (
            <Tile
              key={station.stationuuid}
              title={station.name}
              subtitle={station.country || undefined}
              artworkUri={station.favicon || null}
              fallbackIcon={icons.radio}
              onPress={() => {
                handleStationPress(station);
              }}
            />
          ))}
        </Shelf>
      )}
      {!isLoading && !isError && stations && stations.length > 0 && (
        <SectionHeader title={isSearching ? "Search results" : "Trending"} />
      )}
    </>
  );

  return (
    <Screen footer={<NowPlayingBar />}>
      <Stack.SearchBar
        ref={searchBarRef}
        placeholder="Search stations"
        autoCapitalize="none"
        onChangeText={(event) => {
          const text = event.nativeEvent.text;
          setQuery(text);
          // Clearing the field (including `clearText()` when a genre is
          // picked) keeps the genre; typing a query searches all genres.
          if (text !== "") {
            setSelectedTag("All");
            setActiveTab("search");
          }
        }}
        onSearchButtonPress={(event) => {
          handleSearch(event.nativeEvent.text, "All");
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
          data={isLoading || isError ? [] : (stations ?? [])}
          keyExtractor={(item) => item.stationuuid}
          renderItem={renderStationRow}
          ListHeaderComponent={browseHeader}
          ListEmptyComponent={renderBrowseEmpty()}
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
  gap: space.xs,
  paddingHorizontal: space.screen,
  paddingVertical: space.sm,
};

const $listContent: ViewStyle = {
  paddingBottom: space.xl,
};

const $loading: ViewStyle = {
  alignItems: "center",
  gap: space.sm,
  paddingVertical: space.xxxl,
};
