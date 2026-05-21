import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  FlatList,
  Modal,
  Image,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useBose } from "@/features/speakers/contexts/BoseContext";

interface RadioStation {
  changeid: string;
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  favicon: string;
  tags: string;
  country: string;
  codec: string;
  bitrate: number;
}

const FAVORITES_KEY = "radio_favorites";
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
  const router = useRouter();
  const { speakers, playStream } = useBose();

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "favorites">("search");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [favorites, setFavorites] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(false);

  // Casting state
  const [castingStation, setCastingStation] = useState<RadioStation | null>(
    null,
  );
  const [castModalVisible, setCastModalVisible] = useState(false);
  const [castingToSpeakerId, setCastingToSpeakerId] = useState<string | null>(
    null,
  );

  // Load favorites on mount
  useEffect(() => {
    void loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const stored = await SecureStore.getItemAsync(FAVORITES_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (err) {
      console.warn("Failed to load radio favorites:", err);
    }
  };

  const saveFavorites = async (list: RadioStation[]) => {
    try {
      await SecureStore.setItemAsync(FAVORITES_KEY, JSON.stringify(list));
      setFavorites(list);
    } catch (err) {
      console.warn("Failed to save radio favorites:", err);
      Alert.alert("Error", "Could not save favorite station.");
    }
  };

  const toggleFavorite = (station: RadioStation) => {
    const isFav = favorites.some((f) => f.stationuuid === station.stationuuid);
    let newList: RadioStation[];
    if (isFav) {
      newList = favorites.filter((f) => f.stationuuid !== station.stationuuid);
    } else {
      newList = [...favorites, station];
    }
    void saveFavorites(newList);
  };

  const handleSearch = async (searchQuery = query, tag = selectedTag) => {
    setLoading(true);
    setQuery(searchQuery);
    setSelectedTag(tag);
    setActiveTab("search");

    try {
      let url = "";
      if (tag) {
        url = `https://de1.api.radio-browser.info/json/stations/search?tag=${encodeURIComponent(
          tag.toLowerCase(),
        )}&limit=30&hidebroken=true&order=votes&reverse=true`;
      } else if (searchQuery.trim()) {
        url = `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(
          searchQuery.trim(),
        )}&limit=30&hidebroken=true&order=votes&reverse=true`;
      } else {
        // Default top voted list
        url =
          "https://de1.api.radio-browser.info/json/stations/search?limit=30&hidebroken=true&order=votes&reverse=true";
      }

      const res = await fetch(url, {
        headers: { "User-Agent": "ReviveST/1.0" },
      });
      if (!res.ok) throw new Error("API request failed");
      const data = (await res.json()) as RadioStation[];
      setStations(data);
    } catch (err) {
      console.warn("Failed to fetch radio stations:", err);
      Alert.alert(
        "Search Error",
        "Could not retrieve radio stations. Please check your internet connection.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStationPress = (station: RadioStation) => {
    setCastingStation(station);
    setCastModalVisible(true);
  };

  const handleCastToSpeaker = async (speakerId: string) => {
    if (!castingStation) return;
    const speaker = speakers.find((s) => s.deviceID === speakerId);
    if (!speaker) return;

    setCastingToSpeakerId(speakerId);
    try {
      // Direct stream URL prefers url_resolved, fallback to url
      const streamUrl = castingStation.url_resolved || castingStation.url;
      await playStream(speaker.deviceID, streamUrl, castingStation.name);
      setCastModalVisible(false);
      Alert.alert(
        "Casting Started",
        `Now streaming "${castingStation.name}" to ${speaker.name}.`,
      );
    } catch (err) {
      console.error(err);
      Alert.alert(
        "Casting Failed",
        `Failed to play this stream on ${speaker.name}. Note: SoundTouch speakers prefer direct HTTP MP3/AAC streams.`,
      );
    } finally {
      setCastingToSpeakerId(null);
    }
  };

  const renderStationCard = ({ item }: { item: RadioStation }) => {
    const isFav = favorites.some((f) => f.stationuuid === item.stationuuid);

    return (
      <Pressable
        style={styles.stationCard}
        onPress={() => handleStationPress(item)}
      >
        {/* Favicon / logo */}
        <View style={styles.stationLogoContainer}>
          {item.favicon ? (
            <Image source={{ uri: item.favicon }} style={styles.stationLogo} />
          ) : (
            <Text style={styles.stationFallbackLogo}>📻</Text>
          )}
        </View>

        <View style={styles.stationDetails}>
          <Text style={styles.stationName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.stationSubText} numberOfLines={1}>
            {item.country || "Unknown Country"} • {item.codec || "MP3"}
            {item.bitrate ? ` • ${item.bitrate} kbps` : ""}
          </Text>
        </View>

        <Pressable
          style={styles.favoriteButton}
          onPress={() => toggleFavorite(item)}
        >
          <Text style={styles.favoriteIconText}>{isFav ? "★" : "☆"}</Text>
        </Pressable>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Internet Radio</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs Selector */}
      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.tab, activeTab === "search" && styles.activeTab]}
          onPress={() => setActiveTab("search")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "search" && styles.activeTabText,
            ]}
          >
            Browse & Search
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "favorites" && styles.activeTab]}
          onPress={() => setActiveTab("favorites")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "favorites" && styles.activeTabText,
            ]}
          >
            Favorites ({favorites.length})
          </Text>
        </Pressable>
      </View>

      {activeTab === "search" ? (
        /* Search/Browse Tab View */
        <View style={{ flex: 1 }}>
          {/* Search Box */}
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by station name..."
              placeholderTextColor="#71717a"
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                setSelectedTag(null);
              }}
              onSubmitEditing={() => handleSearch(query, null)}
              returnKeyType="search"
            />
            {query.trim().length > 0 && (
              <Pressable
                onPress={() => {
                  setQuery("");
                  setStations([]);
                }}
                style={styles.clearSearchButton}
              >
                <Text style={styles.clearSearchText}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Quick Genre Tags List */}
          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <FlatList
              data={GENRE_TAGS}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.tagsContent}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.tagPill,
                    selectedTag === item && styles.tagPillActive,
                  ]}
                  onPress={() => {
                    const nextTag = selectedTag === item ? null : item;
                    void handleSearch("", nextTag);
                  }}
                >
                  <Text
                    style={[
                      styles.tagText,
                      selectedTag === item && styles.tagTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              )}
            />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>Fetching stations...</Text>
            </View>
          ) : stations.length === 0 ? (
            <View style={styles.infoContainer}>
              <Text style={styles.infoIcon}>📻</Text>
              <Text style={styles.infoTitle}>Explore Radio Stations</Text>
              <Text style={styles.infoText}>
                Type in the search bar above or select a genre tag to start
                browsing online streams.
              </Text>
              <Pressable
                style={styles.exploreButton}
                onPress={() => handleSearch("", null)}
              >
                <Text style={styles.exploreButtonText}>
                  Browse Top Stations
                </Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={stations}
              keyExtractor={(item) => item.stationuuid}
              renderItem={renderStationCard}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      ) : (
        /* Favorites Tab View */
        <View style={{ flex: 1 }}>
          {favorites.length === 0 ? (
            <View style={styles.infoContainer}>
              <Text style={styles.infoIcon}>★</Text>
              <Text style={styles.infoTitle}>No Favorites Yet</Text>
              <Text style={styles.infoText}>
                Stations you mark with a star will appear here for fast access.
              </Text>
              <Pressable
                style={styles.exploreButton}
                onPress={() => setActiveTab("search")}
              >
                <Text style={styles.exploreButtonText}>Find Stations</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={favorites}
              keyExtractor={(item) => item.stationuuid}
              renderItem={renderStationCard}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      )}

      {/* Speaker Selector Casting Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={castModalVisible}
        onRequestClose={() => setCastModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Speaker</Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setCastModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Which speaker would you like to stream "{castingStation?.name}"
              to?
            </Text>

            {speakers.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyEmoji}>📡</Text>
                <Text style={styles.modalEmptyTitle}>
                  No Speakers Discovered
                </Text>
                <Text style={styles.modalEmptyText}>
                  Please ensure your SoundTouch speaker is online and connected
                  to the same Wi-Fi.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.speakerList}>
                {speakers.map((speaker) => {
                  const isPowerOff =
                    speaker.source === "STANDBY" ||
                    speaker.playStatus === "STANDBY";
                  const isCasting = castingToSpeakerId === speaker.deviceID;

                  return (
                    <Pressable
                      key={speaker.deviceID}
                      style={styles.speakerItem}
                      onPress={() => handleCastToSpeaker(speaker.deviceID)}
                      disabled={isCasting}
                    >
                      <View style={styles.speakerItemLeft}>
                        <Text style={styles.speakerEmoji}>🔊</Text>
                        <View>
                          <Text style={styles.speakerName}>{speaker.name}</Text>
                          <Text style={styles.speakerStatus}>
                            {isPowerOff
                              ? "Standby"
                              : `Playing • Vol ${speaker.volume}%`}
                          </Text>
                        </View>
                      </View>
                      {isCasting ? (
                        <ActivityIndicator size="small" color="#3b82f6" />
                      ) : (
                        <Text style={styles.castPlayIcon}>▶</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090b", // Deep zinc black background
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#18181b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  backButtonText: {
    color: "#fafafa",
    fontSize: 20,
    fontWeight: "bold",
  },
  headerTitle: {
    color: "#fafafa",
    fontSize: 18,
    fontWeight: "bold",
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "rgba(24, 24, 27, 0.4)",
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#18181b",
  },
  activeTab: {
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    borderColor: "#2563eb",
  },
  tabText: {
    color: "#71717a",
    fontSize: 14,
    fontWeight: "600",
  },
  activeTabText: {
    color: "#fafafa",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272a",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: "#fafafa",
    height: 44,
    fontSize: 15,
  },
  clearSearchButton: {
    padding: 6,
  },
  clearSearchText: {
    color: "#71717a",
    fontSize: 16,
  },
  tagsContent: {
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  tagPillActive: {
    backgroundColor: "#f59e0b", // Amber accent for tag selection
    borderColor: "#d97706",
  },
  tagText: {
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "600",
  },
  tagTextActive: {
    color: "#09090b",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  stationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(24, 24, 27, 0.6)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 12,
  },
  stationLogoContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#18181b",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  stationLogo: {
    width: 44,
    height: 44,
  },
  stationFallbackLogo: {
    fontSize: 22,
  },
  stationDetails: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  stationName: {
    color: "#fafafa",
    fontSize: 15,
    fontWeight: "bold",
  },
  stationSubText: {
    color: "#71717a",
    fontSize: 12,
    marginTop: 4,
  },
  favoriteButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  favoriteIconText: {
    color: "#f59e0b",
    fontSize: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    color: "#a1a1aa",
    marginTop: 12,
    fontSize: 15,
  },
  infoContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    marginTop: 20,
  },
  infoIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.5,
  },
  infoTitle: {
    color: "#fafafa",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  infoText: {
    color: "#71717a",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    color: "#fafafa",
    fontWeight: "600",
    fontSize: 14,
  },
  /* Modal Overlay */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#09090b",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    color: "#fafafa",
    fontSize: 18,
    fontWeight: "bold",
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#18181b",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: {
    color: "#a1a1aa",
    fontSize: 14,
  },
  modalSubtitle: {
    color: "#a1a1aa",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  speakerList: {
    marginBottom: 12,
  },
  speakerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  speakerItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  speakerEmoji: {
    fontSize: 24,
  },
  speakerName: {
    color: "#fafafa",
    fontSize: 15,
    fontWeight: "bold",
  },
  speakerStatus: {
    color: "#71717a",
    fontSize: 12,
    marginTop: 2,
  },
  castPlayIcon: {
    color: "#2563eb",
    fontSize: 18,
    fontWeight: "bold",
  },
  modalEmpty: {
    alignItems: "center",
    paddingVertical: 40,
  },
  modalEmptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  modalEmptyTitle: {
    color: "#fafafa",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 6,
  },
  modalEmptyText: {
    color: "#71717a",
    fontSize: 12,
    textAlign: "center",
  },
});
