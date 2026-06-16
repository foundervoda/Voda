import { useCallback, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, RefreshControl, SectionList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../../api/client";
import { useSocket } from "../../api/SocketContext";
import { useAuthStore } from "../../store/useAuthStore";

const STATUS_SCREEN = {
  OUT_FOR_DELIVERY: "RiderDelivery",
  ARRIVED:          "RiderArrived",
  DELIVERED:        "RiderTnbTimer",
  RETURNING:        "RiderReturn",
};

export default function RiderDashboard({ navigation }) {
  const insets = useSafeAreaInsets();
  const socket = useSocket();
  const { logout } = useAuthStore();

  const { data: available = [], refetch: refetchAvailable, isFetching } = useQuery({
    queryKey: ["rider-available"],
    queryFn: () => api.get("/rider/orders").then((r) => r.data.data.orders),
  });

  const { data: mine = [], refetch: refetchMine } = useQuery({
    queryKey: ["rider-mine"],
    queryFn: () => api.get("/rider/orders/mine").then((r) => r.data.data.orders),
  });

  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ["rider-history"],
    queryFn: () => api.get("/rider/orders/history").then((r) => r.data.data.orders),
  });

  const refetchAll = useCallback(() => {
    refetchAvailable();
    refetchMine();
    refetchHistory();
  }, [refetchAvailable, refetchMine, refetchHistory]);

  useFocusEffect(useCallback(() => { refetchAll(); }, [refetchAll]));

  const activeOrder = mine[0] ?? null;

  useEffect(() => {
    if (!socket || !activeOrder) return;
    socket.emit("join_order_room", activeOrder.id);
  }, [socket, activeOrder?.id]);

  useEffect(() => {
    if (!socket) return;
    socket.on("order_update", refetchAll);
    return () => { socket.off("order_update", refetchAll); };
  }, [socket, refetchAll]);

  function resumeActive() {
    if (!activeOrder) return;
    const screen = STATUS_SCREEN[activeOrder.status];
    if (!screen) return;
    // RiderArrived needs the otp — rider will re-enter from the screen; pass null for otp
    navigation.navigate(screen, { order: activeOrder, otp: null });
  }

  function statusLabel(status) {
    switch (status) {
      case "OUT_FOR_DELIVERY": return "En route to customer";
      case "ARRIVED":          return "Arrived — awaiting OTP";
      case "DELIVERED":        return "T&B timer running";
      case "RETURNING":        return "Return in progress";
      default:                 return status.replace(/_/g, " ");
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Rider</Text>
        <Pressable onPress={logout} hitSlop={8}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      {activeOrder && (
        <Pressable style={styles.activeBanner} onPress={resumeActive}>
          <Text style={styles.bannerLabel}>ACTIVE DELIVERY</Text>
          <Text style={styles.bannerAddr} numberOfLines={1}>{activeOrder.deliveryAddr}</Text>
          <Text style={styles.bannerStatus}>{statusLabel(activeOrder.status)} — tap to continue →</Text>
        </Pressable>
      )}

      <SectionList
        sections={[
          { title: "Ready for Pickup", data: available },
          { title: "Past Deliveries", data: history },
        ]}
        keyExtractor={(o) => o.id}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetchAll} tintColor={S} />
        }
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionLabel}>{section.title}</Text>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? (
            <Text style={styles.empty}>
              {section.title === "Ready for Pickup"
                ? "No orders ready for pickup"
                : "No past deliveries yet"}
            </Text>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item, section }) => {
          if (section.title === "Ready for Pickup") {
            const store = item.items[0]?.product?.store?.name ?? "Store";
            return (
              <Pressable
                style={styles.card}
                onPress={() => navigation.navigate("RiderDelivery", { order: item })}
              >
                <Text style={styles.cardAddr} numberOfLines={1}>{item.deliveryAddr}</Text>
                <Text style={styles.cardMeta}>
                  {store} · {item.items.length} item{item.items.length !== 1 ? "s" : ""} ·{" "}
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
                <View style={styles.cardItemList}>
                  {item.items.map((i) => (
                    <Text key={i.id} style={styles.cardItemText} numberOfLines={1}>
                      {i.quantity}× {i.product.name} ({i.variant.size}{i.variant.color ? `, ${i.variant.color}` : ""})
                    </Text>
                  ))}
                </View>
                <Text style={styles.cardCta}>Accept Delivery →</Text>
              </Pressable>
            );
          }

          return (
            <View style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyAddr} numberOfLines={1}>{item.deliveryAddr}</Text>
                <Text style={styles.historyMeta}>
                  {item.items.length} item{item.items.length !== 1 ? "s" : ""} ·{" "}
                  {new Date(item.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                </Text>
              </View>
              <Text style={styles.historyStatus}>{item.status.replace(/_/g, " ")}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const S = "#012a62";
const Y = "#fdde59";
const BG = "#fdf9ea";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#e8e0cc",
  },
  title: { fontSize: 22, fontWeight: "700", color: S },
  logoutText: { fontSize: 14, color: S, opacity: 0.45 },
  activeBanner: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: S,
    borderRadius: 10,
    padding: 14,
  },
  bannerLabel: { fontSize: 10, fontWeight: "700", color: Y, letterSpacing: 1, marginBottom: 4 },
  bannerAddr: { fontSize: 16, fontWeight: "600", color: "#fff", marginBottom: 4 },
  bannerStatus: { fontSize: 13, color: "#ffffff99" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: S,
    letterSpacing: 0.8,
    opacity: 0.5,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
    textTransform: "uppercase",
  },
  list: { paddingHorizontal: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e8e0cc",
  },
  cardAddr: { fontSize: 15, fontWeight: "600", color: S, marginBottom: 3 },
  cardMeta: { fontSize: 12, color: "#888", marginBottom: 8 },
  cardItemList: { marginBottom: 10 },
  cardItemText: { fontSize: 13, color: S, marginBottom: 2 },
  cardCta: { fontSize: 13, fontWeight: "700", color: S, textAlign: "right" },
  empty: { textAlign: "center", color: "#aaa", marginTop: 16, marginBottom: 8, fontSize: 14 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e8e0cc",
  },
  historyAddr: { fontSize: 14, fontWeight: "600", color: S, marginBottom: 2 },
  historyMeta: { fontSize: 12, color: "#888" },
  historyStatus: { fontSize: 11, fontWeight: "700", color: S, opacity: 0.45, textAlign: "right", maxWidth: 110 },
});
