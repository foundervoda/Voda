import { useCallback } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../../api/client";

const STATUS_LABEL = {
  HANDED_TO_RIDER:  "Handed to Rider",
  OUT_FOR_DELIVERY: "Out for Delivery",
  ARRIVED:          "Arrived",
  DELIVERED:        "Delivered",
  RETURNING:        "Returning",
  RETURNED:         "Returned",
  REFUNDED:         "Refunded",
};

const STATUS_COLOR = {
  HANDED_TO_RIDER:  "#1565c0",
  OUT_FOR_DELIVERY: "#1565c0",
  ARRIVED:          "#2e7d32",
  DELIVERED:        "#2e7d32",
  RETURNING:        "#e65100",
  RETURNED:         "#e65100",
  REFUNDED:         "#555",
};

function smartDate(dateStr) {
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export default function RunnerHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const { data: history = [], refetch, isFetching } = useQuery({
    queryKey: ["runner-history"],
    queryFn: () => api.get("/runner/orders/history").then((r) => r.data.data.orders),
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const renderItem = ({ item }) => {
    const statusColor = STATUS_COLOR[item.status] ?? "#555";
    const statusLabel = STATUS_LABEL[item.status] ?? item.status.replace(/_/g, " ");
    const displayAddr = item.deliveryAddr?.replace(" | Try & Buy", "").trim();

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.cardId}>#{item.id.slice(-6).toUpperCase()}</Text>
          <View style={[styles.badge, { backgroundColor: statusColor + "18", borderColor: statusColor + "40" }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <Text style={styles.cardAddr} numberOfLines={1}>{displayAddr}</Text>

        <View style={styles.itemList}>
          {item.items.map((i) => (
            <Text key={i.id} style={styles.itemText} numberOfLines={1}>
              {i.quantity}× {i.product?.name}
              {i.variant?.size ? ` · ${i.variant.size}` : ""}
            </Text>
          ))}
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.cardDate}>{smartDate(item.createdAt)}</Text>
          <Text style={styles.storeText}>
            {item.items[0]?.product?.store?.name ?? ""}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Collection History</Text>
        <View style={{ width: 60 }} />
      </View>

      {isFetching && history.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={S} />
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(o) => o.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={S} />}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>🏃</Text>
              <Text style={styles.emptyTitle}>No collections yet</Text>
              <Text style={styles.emptySub}>Orders you collect will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const S  = "#012a62";
const Y  = "#fdde59";
const BG = "#fdf9ea";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#e8e0cc",
  },
  back:  { fontSize: 14, color: S, width: 60 },
  title: { fontSize: 17, fontWeight: "700", color: S },
  list:  { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  emptyIcon:  { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: S, marginBottom: 6 },
  emptySub:   { fontSize: 13, color: "#888", textAlign: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e8e0cc",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardId:   { fontSize: 13, fontWeight: "700", color: S, fontVariant: ["tabular-nums"] },
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  cardAddr: { fontSize: 14, fontWeight: "600", color: S, marginBottom: 8 },
  itemList: { marginBottom: 10 },
  itemText: { fontSize: 12, color: "#555", marginBottom: 2 },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#f0ebe0",
    paddingTop: 8,
  },
  cardDate:  { fontSize: 11, color: "#aaa", fontWeight: "500" },
  storeText: { fontSize: 11, color: "#888", fontWeight: "500" },
});
