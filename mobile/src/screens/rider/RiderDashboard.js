import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, RefreshControl, FlatList, ActivityIndicator, Modal, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../../api/client";
import { useSocket } from "../../api/SocketContext";
import { useAuthStore } from "../../store/useAuthStore";

export default function RiderDashboard({ navigation }) {
  const insets = useSafeAreaInsets();
  const socket = useSocket();
  const { logout } = useAuthStore();
  const [claimTarget, setClaimTarget] = useState(null); // order being claimed
  const [claimOtp, setClaimOtp] = useState("");
  const [claiming, setClaiming] = useState(false);

  const {
    data: available = [],
    refetch: refetchAvailable,
    isFetching: loadingAvailable,
  } = useQuery({
    queryKey: ["rider-available"],
    queryFn: () => api.get("/rider/orders").then((r) => r.data.data.orders),
  });

  const { data: mine = [], refetch: refetchMine } = useQuery({
    queryKey: ["rider-mine"],
    queryFn: () => api.get("/rider/orders/mine").then((r) => r.data.data.orders),
  });

  const refetchAll = useCallback(() => {
    refetchAvailable();
    refetchMine();
  }, [refetchAvailable, refetchMine]);

  useFocusEffect(
    useCallback(() => {
      refetchAll();
    }, [refetchAll])
  );

  const activeOrder = mine[0] ?? null;

  useEffect(() => {
    if (!socket || !activeOrder) return;
    socket.emit("join_order_room", activeOrder.id);
  }, [socket, activeOrder?.id]);

  useEffect(() => {
    if (!socket) return;
    socket.on("new_order", refetchAll);
    socket.on("order_update", refetchAll);
    return () => {
      socket.off("new_order", refetchAll);
      socket.off("order_update", refetchAll);
    };
  }, [socket, refetchAll]);

  const openClaimModal = (order) => {
    setClaimTarget(order);
    setClaimOtp("");
  };

  const submitClaim = async () => {
    if (!claimTarget || claimOtp.trim().length !== 6) return;
    setClaiming(true);
    try {
      const { data } = await api.post(`/rider/orders/${claimTarget.id}/assign`, { otp: claimOtp.trim() });
      setClaimTarget(null);
      refetchAll();
      navigation.navigate("RiderDelivery", { order: data.data.order });
    } catch (err) {
      alert(err.response?.data?.error?.message ?? "Could not accept order");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Modal visible={!!claimTarget} transparent animationType="fade" onRequestClose={() => setClaimTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Enter Runner OTP</Text>
            <Text style={styles.modalHint}>Ask the runner for the 6-digit code to claim this package.</Text>
            <TextInput
              style={styles.modalOtpInput}
              placeholder="______"
              placeholderTextColor="#012a6240"
              keyboardType="number-pad"
              maxLength={6}
              value={claimOtp}
              onChangeText={setClaimOtp}
              autoFocus
            />
            <Pressable
              style={[styles.modalBtn, (claimOtp.trim().length !== 6 || claiming) && styles.btnDisabled]}
              onPress={submitClaim}
              disabled={claimOtp.trim().length !== 6 || claiming}
            >
              {claiming ? <ActivityIndicator color={S} /> : <Text style={styles.modalBtnText}>Claim Order</Text>}
            </Pressable>
            <Pressable onPress={() => setClaimTarget(null)} style={{ marginTop: 10, alignItems: "center" }}>
              <Text style={{ color: S, opacity: 0.5, fontSize: 13 }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <View style={styles.header}>
        <Text style={styles.title}>Delivery Agent</Text>
        <View style={styles.headerRight}>
          <Pressable onPress={() => navigation.navigate("RiderHistory")} hitSlop={8} style={styles.historyBtn}>
            <Text style={styles.historyBtnText}>History</Text>
          </Pressable>
          <Pressable onPress={logout} hitSlop={8}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </View>

      {activeOrder && (
        <Pressable
          style={styles.activeBanner}
          onPress={() => navigation.navigate("RiderDelivery", { order: activeOrder })}
        >
          <Text style={styles.bannerLabel}>ACTIVE DELIVERY</Text>
          <Text style={styles.bannerAddr} numberOfLines={1}>
            {activeOrder.deliveryAddr}
          </Text>
          <Text style={styles.bannerStatus}>
            {activeOrder.status.replace(/_/g, " ")} — tap to continue →
          </Text>
        </Pressable>
      )}

      <FlatList
        data={available}
        keyExtractor={(o) => o.id}
        refreshControl={
          <RefreshControl refreshing={loadingAvailable} onRefresh={refetchAll} tintColor="#012a62" />
        }
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={<Text style={styles.sectionLabel}>Available for Delivery</Text>}
        ListEmptyComponent={<Text style={styles.empty}>No packages waiting at handover right now</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => openClaimModal(item)}>
            <Text style={styles.cardAddr} numberOfLines={1}>{item.deliveryAddr}</Text>
            <Text style={styles.cardMeta}>
              {item.items.length} item{item.items.length !== 1 ? "s" : ""} ·{" "}
              {item.isTryAndBuy ? "Try & Buy active" : "Standard Delivery"}
            </Text>
            <Text style={styles.cardCta}>Accept Delivery & Depart →</Text>
          </Pressable>
        )}
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
  title: { fontSize: 20, fontWeight: "700", color: S },
  logoutText: { fontSize: 14, color: S, opacity: 0.45 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  historyBtn: {},
  historyBtnText: { fontSize: 14, fontWeight: "600", color: S },
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
  cardCta: { fontSize: 13, fontWeight: "700", color: S, textAlign: "right" },
  empty: { textAlign: "center", color: "#aaa", marginTop: 16, marginBottom: 8, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalBox: { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 360 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: S, marginBottom: 6, textAlign: "center" },
  modalHint: { fontSize: 13, color: "#666", textAlign: "center", marginBottom: 18, lineHeight: 18 },
  modalOtpInput: {
    borderWidth: 1.5,
    borderColor: S,
    borderRadius: 10,
    paddingVertical: 12,
    fontSize: 28,
    color: S,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 10,
    backgroundColor: BG,
    marginBottom: 14,
  },
  modalBtn: { backgroundColor: Y, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  modalBtnText: { fontSize: 16, fontWeight: "700", color: S },
  btnDisabled: { opacity: 0.45 },
});
