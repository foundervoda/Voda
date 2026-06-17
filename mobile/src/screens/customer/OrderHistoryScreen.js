import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useSocket } from "../../api/SocketContext";

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const formatRupeePrice = (amount) => {
  const rounded = Math.round(amount);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const formatDate = (dateStr) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch (e) {
    return dateStr;
  }
};

const getStatusColor = (status) => {
  switch (status?.toUpperCase()) {
    case "DELIVERED":
      return { bg: "#dcfce7", text: "#15803d" };
    case "PENDING":
    case "RUNNER_ASSIGNED":
    case "COLLECTED":
    case "HANDED_TO_RIDER":
    case "OUT_FOR_DELIVERY":
    case "ARRIVED":
      return { bg: "#fef3c7", text: "#b45309" };
    case "RETURNING":
      return { bg: "#ffedd5", text: "#ea580c" };
    case "RETURNED":
    case "REFUNDED":
      return { bg: "#f1f5f9", text: "#475569" };
    default:
      return { bg: "#e2e8f0", text: "#1e293b" };
  }
};

export default function OrderHistoryScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const socket = useSocket();

  const [orders, setOrders] = useState(route.params?.orders || []);
  const [loading, setLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      loadOrders();
    };
    socket.on("order_update", handleUpdate);
    return () => {
      socket.off("order_update", handleUpdate);
    };
  }, [socket]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get("/orders");
      const list = res.data?.data?.orders || res.data?.orders || [];
      const completedList = list.filter(
        (o) =>
          o.status === "RETURNED" ||
          o.status === "REFUNDED" ||
          (o.status === "DELIVERED" && (!o.tryTimerRemainingMs || o.tryTimerRemainingMs <= 0))
      );
      setOrders(completedList);
    } catch (err) {
      console.warn("Could not fetch orders in OrderHistoryScreen:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderExpand = (orderId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable
          style={({ pressed }) => [s.backBtn, pressed && s.backBtnPressed]}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={22} color="#012a62" />
        </Pressable>
        <Text style={s.headerTitle}>Order History</Text>
        <Pressable onPress={loadOrders} style={s.refreshHeaderBtn} hitSlop={12}>
          <Ionicons name="refresh" size={18} color="#012a62" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading && orders.length === 0 ? (
          <ActivityIndicator color="#012a62" style={{ marginVertical: 40 }} />
        ) : orders.length === 0 ? (
          <View style={s.emptyOrdersCard}>
            <Ionicons name="receipt-outline" size={44} color="#012a6230" style={{ marginBottom: 12 }} />
            <Text style={s.emptyOrdersText}>No past orders found.</Text>
          </View>
        ) : (
          <View style={s.listContainer}>
            {orders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const statusColors = getStatusColor(order.status);
              const totalItemsCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
              const subtotal = (order.totalAmount ?? 0) - (order.deliveryFee ?? 0) - (order.tryAndBuyFee ?? 0);

              return (
                <Pressable
                  key={order.id}
                  style={s.orderCard}
                  onPress={() => toggleOrderExpand(order.id)}
                >
                  {/* Order Card Header */}
                  <View style={s.orderCardHeader}>
                    <View>
                      <Text style={s.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
                      <Text style={s.orderDate}>{formatDate(order.createdAt)}</Text>
                    </View>
                    <View style={s.orderCardHeaderRight}>
                      <View style={[s.statusPill, { backgroundColor: statusColors.bg }]}>
                        <Text style={[s.statusPillText, { color: statusColors.text }]}>
                          {order.status}
                        </Text>
                      </View>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color="#012a6260"
                        style={{ marginLeft: 8 }}
                      />
                    </View>
                  </View>

                  {/* Summary Details */}
                  <View style={s.orderSummaryRow}>
                    <Text style={s.orderSummaryText}>
                      {totalItemsCount} {totalItemsCount === 1 ? "item" : "items"} • ₹{formatRupeePrice(order.totalAmount)}
                    </Text>
                    {order.isTryAndBuy && (
                      <View style={s.tbBadge}>
                        <Ionicons name="shirt-outline" size={10} color="#012a62" style={{ marginRight: 3 }} />
                        <Text style={s.tbBadgeText}>Try & Buy</Text>
                      </View>
                    )}
                  </View>

                  {/* Expanded Receipt Breakdown */}
                  {isExpanded && (
                    <View style={s.expandedContent}>
                      <View style={s.receiptTitleContainer}>
                        <Text style={s.receiptTitle}>Receipt Summary</Text>
                      </View>
                      
                      {/* Items List */}
                      {order.items?.map((item) => (
                        <View key={item.id} style={s.receiptItemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.receiptItemName}>{item.product?.name}</Text>
                            {item.variant?.size && (
                              <Text style={s.receiptItemSub}>Size: {item.variant.size}</Text>
                            )}
                          </View>
                          <Text style={s.receiptItemQty}>× {item.quantity}</Text>
                          <Text style={s.receiptItemPrice}>
                            ₹{formatRupeePrice((item.product?.price ?? 0) * item.quantity)}
                          </Text>
                        </View>
                      ))}

                      <View style={s.expandedDivider} />

                      {/* Pricing Table */}
                      <View style={s.receiptPriceRow}>
                        <Text style={s.receiptPriceLabel}>Subtotal</Text>
                        <Text style={s.receiptPriceVal}>₹{formatRupeePrice(subtotal)}</Text>
                      </View>

                      <View style={s.receiptPriceRow}>
                        <Text style={s.receiptPriceLabel}>Delivery Fee</Text>
                        <Text style={order.deliveryFee === 0 ? s.receiptPriceFree : s.receiptPriceVal}>
                          {order.deliveryFee === 0 ? "FREE" : `₹${formatRupeePrice(order.deliveryFee)}`}
                        </Text>
                      </View>

                      {order.isTryAndBuy && (
                        <View style={s.receiptPriceRow}>
                          <Text style={s.receiptPriceLabel}>Try & Buy Fee</Text>
                          <Text style={order.tryAndBuyFee === 0 ? s.receiptPriceFree : s.receiptPriceVal}>
                            {order.tryAndBuyFee === 0 ? "FREE" : `₹${formatRupeePrice(order.tryAndBuyFee)}`}
                          </Text>
                        </View>
                      )}

                      <View style={[s.expandedDivider, { marginVertical: 6 }]} />

                      <View style={s.receiptPriceRow}>
                        <Text style={s.receiptTotalLabel}>Total Amount</Text>
                        <Text style={s.receiptTotalVal}>₹{formatRupeePrice(order.totalAmount)}</Text>
                      </View>

                      {/* Address */}
                      <View style={s.receiptAddressBox}>
                        <Ionicons name="location-outline" size={13} color="#012a6280" style={{ marginRight: 6 }} />
                        <Text style={s.receiptAddressText} numberOfLines={2}>
                          Delivered to: {order.deliveryAddr}
                        </Text>
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fdf9ea",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: "rgba(253, 249, 234, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(1, 42, 98, 0.05)",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(1, 42, 98, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnPressed: {
    backgroundColor: "rgba(1, 42, 98, 0.05)",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#012a62",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  refreshHeaderBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
  },
  listContainer: {
    gap: 12,
  },
  emptyOrdersCard: {
    backgroundColor: "#fffef5",
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#012a6208",
    marginTop: 40,
  },
  emptyOrdersText: {
    color: "#012a6260",
    fontSize: 14,
    fontWeight: "600",
  },
  orderCard: {
    backgroundColor: "#fffef5",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#012a6208",
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
  },
  orderCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderId: {
    fontSize: 14,
    fontWeight: "800",
    color: "#012a62",
  },
  orderDate: {
    fontSize: 11,
    color: "#012a6260",
    fontWeight: "600",
    marginTop: 2,
  },
  orderCardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  orderSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  orderSummaryText: {
    fontSize: 13,
    color: "#012a62a0",
    fontWeight: "600",
  },
  tbBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#012a6208",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tbBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#012a62",
  },
  expandedContent: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#012a6208",
    paddingTop: 14,
  },
  receiptTitleContainer: {
    marginBottom: 10,
  },
  receiptTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#012a62",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  receiptItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  receiptItemName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#012a62",
  },
  receiptItemSub: {
    fontSize: 11,
    color: "#012a6250",
    fontWeight: "500",
    marginTop: 1,
  },
  receiptItemQty: {
    fontSize: 12,
    color: "#012a6270",
    fontWeight: "600",
    marginRight: 12,
  },
  receiptItemPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#012a62",
  },
  expandedDivider: {
    height: 1,
    backgroundColor: "#012a6208",
    marginVertical: 10,
  },
  receiptPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  receiptPriceLabel: {
    fontSize: 12,
    color: "#012a6270",
    fontWeight: "600",
  },
  receiptPriceVal: {
    fontSize: 12,
    color: "#012a62",
    fontWeight: "700",
  },
  receiptPriceFree: {
    fontSize: 12,
    color: "#16a34a",
    fontWeight: "800",
  },
  receiptTotalLabel: {
    fontSize: 13,
    color: "#012a62",
    fontWeight: "800",
  },
  receiptTotalVal: {
    fontSize: 14,
    color: "#012a62",
    fontWeight: "900",
  },
  receiptAddressBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#012a6203",
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  receiptAddressText: {
    fontSize: 11,
    color: "#012a6270",
    fontWeight: "600",
    flex: 1,
    lineHeight: 14,
  },
});
