import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  FlatList,
  Modal,
  Image,
  Alert,
  ScrollView,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  useRadioFavorites,
  useRadioToggleFavorite,
} from "@/features/radio/hooks/useRadioFavorites";
import {
  useRadioStations,
  type RadioStation,
} from "@/features/radio/hooks/useRadioStations";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import { logger } from "@/lib/logger";

const GENRE_TAGS = [
  "Jazz",
  "Classical",
  "Rock",
  "Pop",
  "80s",
  "90s",
  "News",
  "Ambient",
];

export default function RadioBrowser() {
  const { speakers, playStreamMutation } = useBose();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "favorites">("search");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

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
  } = useRadioStations(debouncedQuery, selectedTag);

  const [castingStation, setCastingStation] = useState<RadioStation | null>(
    null,
  );
  const [castModalVisible, setCastModalVisible] = useState(false);
  const [castingToSpeakerId, setCastingToSpeakerId] = useState<string | null>(
    null,
  );

  const handleSearch = (searchQuery = query, tag = selectedTag) => {
    setQuery(searchQuery);
    setDebouncedQuery(searchQuery);
    setSelectedTag(tag);
    setActiveTab("search");
  };

  const handleStationPress = (station: RadioStation) => {
    setCastingStation(station);
    setCastModalVisible(true);
  };

  const handleCastToSpeaker = async (speakerId: string) => {
    if (!castingStation) {
      return;
    }
    const speaker = speakers.find((spk) => spk.deviceID === speakerId);
    if (!speaker) {
      return;
    }

    setCastingToSpeakerId(speakerId);
    try {
      const streamUrl = castingStation.url_resolved ?? castingStation.url;
      await playStreamMutation.mutateAsync({
        host: speaker.host,
        uri: streamUrl,
        name: castingStation.name,
      });
      setCastModalVisible(false);
      Alert.alert(
        "Casting Started",
        `Now streaming "${castingStation.name}" to ${speaker.name}.`,
      );
    } catch (err) {
      logger.error(err);
      Alert.alert(
        "Casting Failed",
        `Failed to play this stream on ${speaker.name}. Note: SoundTouch speakers prefer direct HTTP MP3/AAC streams.`,
      );
    } finally {
      setCastingToSpeakerId(null);
    }
  };

  const renderStationCard = ({ item }: { item: RadioStation }) => {
    const isFav = favorites.some((fav) => fav.stationuuid === item.stationuuid);

    const handleToggle = () => {
      toggleFavorite({ station: item, isFavorite: isFav });
    };

    return (
      <Pressable
        style={$stationCard}
        onPress={() => {
          handleStationPress(item);
        }}
      >
        <View style={$stationLogoContainer}>
          {item.favicon ? (
            <Image source={{ uri: item.favicon }} style={$stationLogo} />
          ) : (
            <Text style={$stationFallbackLogo}>📻</Text>
          )}
        </View>

        <View style={$stationDetails}>
          <Text style={$stationName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={$stationSubText} numberOfLines={1}>
            {item.country ?? "Unknown Country"} • {item.codec ?? "MP3"}
            {item.bitrate ? ` • ${item.bitrate} kbps` : ""}
          </Text>
        </View>

        <Pressable style={$favoriteButton} onPress={handleToggle}>
          <Text style={$favoriteIconText}>{isFav ? "★" : "☆"}</Text>
        </Pressable>
      </Pressable>
    );
  };

  const renderSearchResults = () => {
    if (isLoading) {
      return (
        <View style={$centerState}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={$loadingText}>Fetching stations...</Text>
        </View>
      );
    }
    if (isError) {
      return (
        <View style={$infoContainer}>
          <Text style={$infoIcon}>⚠</Text>
          <Text style={$infoTitle}>Search Failed</Text>
          <Text style={$infoText}>
            {error instanceof Error
              ? error.message
              : "Could not retrieve radio stations. Please check your internet connection."}
          </Text>
          <Pressable
            style={$exploreButton}
            onPress={() => {
              void queryClient.refetchQueries({
                queryKey: ["radio-stations"],
              });
            }}
          >
            <Text style={$exploreButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    if (!stations || stations.length === 0) {
      return (
        <View style={$infoContainer}>
          <Text style={$infoIcon}>📻</Text>
          <Text style={$infoTitle}>No Stations Found</Text>
          <Text style={$infoText}>
            Try a different search term or genre tag.
          </Text>
        </View>
      );
    }
    return (
      <FlatList
        data={stations}
        keyExtractor={(item) => item.stationuuid}
        renderItem={renderStationCard}
        contentContainerStyle={$listContent}
      />
    );
  };

  return (
    <SafeAreaView style={$container}>
      <View style={$header}>
        <Text style={$appTitle}>Radio</Text>
      </View>

      <View style={$tabsContainer}>
        <Pressable
          style={[$tab, activeTab === "search" && $activeTab]}
          onPress={() => {
            setActiveTab("search");
          }}
        >
          <Text style={[$tabText, activeTab === "search" && $activeTabText]}>
            Browse
          </Text>
        </Pressable>
        <Pressable
          style={[$tab, activeTab === "favorites" && $activeTab]}
          onPress={() => {
            setActiveTab("favorites");
          }}
        >
          <Text style={[$tabText, activeTab === "favorites" && $activeTabText]}>
            Favorites ({favorites.length})
          </Text>
        </Pressable>
      </View>

      {activeTab === "search" ? (
        <View style={{ flex: 1 }}>
          <View style={$searchBox}>
            <TextInput
              style={$searchInput}
              placeholder="Search by station name..."
              placeholderTextColor="#71717a"
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                setSelectedTag(null);
              }}
              onSubmitEditing={() => {
                handleSearch(query, null);
              }}
              returnKeyType="search"
            />
            {query.trim().length > 0 && (
              <Pressable
                onPress={() => {
                  setQuery("");
                }}
                style={$clearSearchButton}
              >
                <Text style={$clearSearchText}>✕</Text>
              </Pressable>
            )}
          </View>

          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <FlatList
              data={GENRE_TAGS}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item}
              contentContainerStyle={$tagsContent}
              renderItem={({ item }) => (
                <Pressable
                  style={[$tagPill, selectedTag === item && $tagPillActive]}
                  onPress={() => {
                    const nextTag = selectedTag === item ? null : item;
                    handleSearch("", nextTag);
                  }}
                >
                  <Text
                    style={[$tagText, selectedTag === item && $tagTextActive]}
                  >
                    {item}
                  </Text>
                </Pressable>
              )}
            />
          </View>

          {renderSearchResults()}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {favorites.length === 0 ? (
            <View style={$infoContainer}>
              <Text style={$infoIcon}>★</Text>
              <Text style={$infoTitle}>No Favorites Yet</Text>
              <Text style={$infoText}>
                Stations you mark with a star will appear here for fast access.
              </Text>
              <Pressable
                style={$exploreButton}
                onPress={() => {
                  setActiveTab("search");
                }}
              >
                <Text style={$exploreButtonText}>Find Stations</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={favorites}
              keyExtractor={(item) => item.stationuuid}
              renderItem={renderStationCard}
              contentContainerStyle={$listContent}
            />
          )}
        </View>
      )}

      <Modal
        animationType="slide"
        transparent
        visible={castModalVisible}
        onRequestClose={() => {
          setCastModalVisible(false);
        }}
      >
        <View style={$modalOverlay}>
          <View style={$modalContent}>
            <View style={$modalHeader}>
              <Text style={$modalTitle}>Select Speaker</Text>
              <Pressable
                style={$modalCloseButton}
                onPress={() => {
                  setCastModalVisible(false);
                }}
              >
                <Text style={$modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <Text style={$modalSubtitle}>
              Which speaker would you like to stream{" "}
              {`"${castingStation?.name}"`} to?
            </Text>

            {speakers.length === 0 ? (
              <View style={$modalEmpty}>
                <Text style={$modalEmptyEmoji}>📡</Text>
                <Text style={$modalEmptyTitle}>No Speakers Discovered</Text>
                <Text style={$modalEmptyText}>
                  Please ensure your SoundTouch speaker is online and connected
                  to the same Wi-Fi.
                </Text>
              </View>
            ) : (
              <ScrollView style={$speakerList}>
                {speakers.map((speaker) => {
                  const isPowerOff =
                    speaker.source === "STANDBY" ||
                    speaker.playStatus === "STANDBY";
                  const isCasting = castingToSpeakerId === speaker.deviceID;

                  return (
                    <Pressable
                      key={speaker.deviceID}
                      style={$speakerItem}
                      onPress={() => {
                        void handleCastToSpeaker(speaker.deviceID);
                      }}
                      disabled={isCasting}
                    >
                      <View style={$speakerItemLeft}>
                        <Text style={$speakerEmoji}>🔊</Text>
                        <View>
                          <Text style={$speakerName}>{speaker.name}</Text>
                          <Text style={$speakerStatus}>
                            {isPowerOff
                              ? "Standby"
                              : `Playing • Vol ${speaker.volume}%`}
                          </Text>
                        </View>
                      </View>
                      {isCasting ? (
                        <ActivityIndicator size="small" color="#3b82f6" />
                      ) : (
                        <Text style={$castPlayIcon}>▶</Text>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: "#09090b",
};

const $header: ViewStyle = {
  paddingHorizontal: 20,
  paddingBottom: 8,
};

const $appTitle: TextStyle = {
  fontSize: 28,
  color: "#fafafa",
  fontWeight: "800",
  letterSpacing: -0.5,
};

const $tabsContainer: ViewStyle = {
  flexDirection: "row",
  paddingHorizontal: 16,
  paddingVertical: 12,
  gap: 12,
};

const $tab: ViewStyle = {
  flex: 1,
  paddingVertical: 10,
  backgroundColor: "rgba(24, 24, 27, 0.4)",
  borderRadius: 10,
  alignItems: "center",
  borderWidth: 1,
  borderColor: "#18181b",
};

const $activeTab: ViewStyle = {
  backgroundColor: "rgba(37, 99, 235, 0.1)",
  borderColor: "#2563eb",
};

const $tabText: TextStyle = {
  color: "#71717a",
  fontSize: 14,
  fontWeight: "600",
};

const $activeTabText: TextStyle = {
  color: "#fafafa",
};

const $searchBox: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#18181b",
  borderRadius: 12,
  borderWidth: 1,
  borderColor: "#27272a",
  marginHorizontal: 16,
  marginBottom: 12,
  paddingHorizontal: 12,
};

const $searchInput: TextStyle = {
  flex: 1,
  color: "#fafafa",
  height: 44,
  fontSize: 15,
};

const $clearSearchButton: ViewStyle = {
  padding: 6,
};

const $clearSearchText: TextStyle = {
  color: "#71717a",
  fontSize: 16,
};

const $tagsContent: ViewStyle = {
  gap: 8,
};

const $tagPill: ViewStyle = {
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 20,
  backgroundColor: "#18181b",
  borderWidth: 1,
  borderColor: "#27272a",
};

const $tagPillActive: ViewStyle = {
  backgroundColor: "#f59e0b",
  borderColor: "#d97706",
};

const $tagText: TextStyle = {
  color: "#a1a1aa",
  fontSize: 13,
  fontWeight: "600",
};

const $tagTextActive: TextStyle = {
  color: "#09090b",
};

const $listContent: ViewStyle = {
  paddingHorizontal: 16,
  paddingBottom: 24,
  gap: 8,
};

const $stationCard: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "rgba(24, 24, 27, 0.6)",
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#27272a",
  padding: 12,
};

const $stationLogoContainer: ViewStyle = {
  width: 44,
  height: 44,
  borderRadius: 8,
  backgroundColor: "#18181b",
  justifyContent: "center",
  alignItems: "center",
  overflow: "hidden",
};

const $stationLogo: ImageStyle = {
  width: 44,
  height: 44,
};

const $stationFallbackLogo: TextStyle = {
  fontSize: 22,
};

const $stationDetails: ViewStyle = {
  flex: 1,
  marginLeft: 12,
  marginRight: 8,
};

const $stationName: TextStyle = {
  color: "#fafafa",
  fontSize: 15,
  fontWeight: "bold",
};

const $stationSubText: TextStyle = {
  color: "#71717a",
  fontSize: 12,
  marginTop: 4,
};

const $favoriteButton: ViewStyle = {
  width: 36,
  height: 36,
  justifyContent: "center",
  alignItems: "center",
};

const $favoriteIconText: TextStyle = {
  color: "#f59e0b",
  fontSize: 24,
};

const $centerState: ViewStyle = {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  paddingVertical: 60,
};

const $loadingText: TextStyle = {
  color: "#a1a1aa",
  marginTop: 12,
  fontSize: 15,
};

const $infoContainer: ViewStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  padding: 32,
  marginTop: 20,
};

const $infoIcon: TextStyle = {
  fontSize: 64,
  marginBottom: 16,
  opacity: 0.5,
};

const $infoTitle: TextStyle = {
  color: "#fafafa",
  fontSize: 18,
  fontWeight: "bold",
  marginBottom: 8,
  textAlign: "center",
};

const $infoText: TextStyle = {
  color: "#71717a",
  fontSize: 14,
  textAlign: "center",
  lineHeight: 20,
  marginBottom: 24,
};

const $exploreButton: ViewStyle = {
  backgroundColor: "#2563eb",
  paddingHorizontal: 24,
  paddingVertical: 12,
  borderRadius: 8,
};

const $exploreButtonText: TextStyle = {
  color: "#fafafa",
  fontWeight: "600",
  fontSize: 14,
};

const $modalOverlay: ViewStyle = {
  flex: 1,
  backgroundColor: "rgba(0, 0, 0, 0.75)",
  justifyContent: "flex-end",
};

const $modalContent: ViewStyle = {
  backgroundColor: "#09090b",
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  borderWidth: 1,
  borderColor: "#27272a",
  padding: 24,
  maxHeight: "80%",
};

const $modalHeader: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};

const $modalTitle: TextStyle = {
  color: "#fafafa",
  fontSize: 18,
  fontWeight: "bold",
};

const $modalCloseButton: ViewStyle = {
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: "#18181b",
  justifyContent: "center",
  alignItems: "center",
};

const $modalCloseText: TextStyle = {
  color: "#a1a1aa",
  fontSize: 14,
};

const $modalSubtitle: TextStyle = {
  color: "#a1a1aa",
  fontSize: 14,
  lineHeight: 20,
  marginBottom: 20,
};

const $speakerList: ViewStyle = {
  marginBottom: 12,
};

const $speakerItem: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "#18181b",
  borderWidth: 1,
  borderColor: "#27272a",
  borderRadius: 16,
  padding: 16,
  marginBottom: 10,
};

const $speakerItemLeft: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
};

const $speakerEmoji: TextStyle = {
  fontSize: 24,
};

const $speakerName: TextStyle = {
  color: "#fafafa",
  fontSize: 15,
  fontWeight: "bold",
};

const $speakerStatus: TextStyle = {
  color: "#71717a",
  fontSize: 12,
  marginTop: 2,
};

const $castPlayIcon: TextStyle = {
  color: "#2563eb",
  fontSize: 18,
  fontWeight: "bold",
};

const $modalEmpty: ViewStyle = {
  alignItems: "center",
  paddingVertical: 40,
};

const $modalEmptyEmoji: TextStyle = {
  fontSize: 48,
  marginBottom: 12,
};

const $modalEmptyTitle: TextStyle = {
  color: "#fafafa",
  fontSize: 16,
  fontWeight: "bold",
  marginBottom: 6,
};

const $modalEmptyText: TextStyle = {
  color: "#71717a",
  fontSize: 12,
  textAlign: "center",
};
