import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/useAuthStore";
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

function ActiveOrderCard({ order, navigation, onRefresh }) {
  const [timeLeft, setTimeLeft] = useState("");
  const isTryBuy = order.isTryAndBuy;
  const showTimer = order.status === "DELIVERED" && order.tryTimerRemainingMs > 0;
  
  const statusColor = getStatusColor(order.status);

  useEffect(() => {
    if (!showTimer || !order.tryTimerRemainingMs) return;
    const startMs = Date.now();
    const remainingMs = order.tryTimerRemainingMs;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startMs;
      const diff = remainingMs - elapsed;
      if (diff <= 0) {
        clearInterval(interval);
        setTimeLeft("00:00");
        onRefresh();
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        const formatNum = (num) => (num < 10 ? `0${num}` : num);
        setTimeLeft(`${formatNum(minutes)}:${formatNum(seconds)}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order.tryTimerRemainingMs, showTimer]);

  const getStatusMessage = (status) => {
    switch (status) {
      case "PENDING": return "Finding a runner in the store...";
      case "RUNNER_ASSIGNED": return "Runner collecting your items...";
      case "COLLECTED": return "Items collected. Preparing for handover...";
      case "HANDED_TO_RIDER": return "Runner handed order to delivery rider.";
      case "OUT_FOR_DELIVERY": return "Rider is en route to your location!";
      case "ARRIVED": return "Rider has arrived at your door!";
      case "DELIVERED": return isTryBuy ? "Try & Buy active!" : "Order delivered.";
      default: return status.replace(/_/g, " ");
    }
  };

  return (
    <View style={s.activeCard}>
      <View style={s.activeCardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={s.pulseContainer}>
            <View style={[s.pulseDot, { backgroundColor: statusColor.text }]} />
          </View>
          <Text style={s.activeCardLabel}>Active Tracking</Text>
        </View>
        <View style={[s.statusPill, { backgroundColor: statusColor.bg }]}>
          <Text style={[s.statusPillText, { color: statusColor.text, textTransform: "uppercase" }]}>
            {order.status.replace(/_/g, " ")}
          </Text>
        </View>
      </View>

      <Text style={s.activeStatusMsg}>{getStatusMessage(order.status)}</Text>
      
      {order.status === "ARRIVED" && order.deliveryOtp && (
        <View style={s.otpBox}>
          <Text style={s.otpLabel}>SHARE HANDOVER OTP</Text>
          <Text style={s.otpText}>{order.deliveryOtp}</Text>
          <Text style={s.otpHint}>
            Provide this code to the rider to start your 10-minute trial.
          </Text>
        </View>
      )}

      {showTimer && (
        <View style={s.timerBox}>
          <Ionicons name="timer" size={24} color="#012a62" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.timerBoxTitle}>Try & Buy Timer Active</Text>
            <Text style={s.timerBoxClock}>{timeLeft || "--:--"}</Text>
          </View>
          <Pressable 
            style={s.tbPortalBtn}
            onPress={() => navigation.navigate("TryBuy", { order })}
          >
            <Text style={s.tbPortalBtnText}>Open Portal</Text>
          </Pressable>
        </View>
      )}

      {(order.status === "OUT_FOR_DELIVERY" || order.status === "ARRIVED") && (
        <Pressable 
          style={s.mapTrackBtn}
          onPress={() => navigation.navigate("TrackOrder", { order })}
        >
          <Ionicons name="map" size={16} color="#012a62" style={{ marginRight: 6 }} />
          <Text style={s.mapTrackBtnText}>Track Order on Map</Text>
        </Pressable>
      )}

      <View style={s.activeCardFooter}>
        <Text style={s.activeAddress} numberOfLines={1}>
          Delivering to: {order.deliveryAddr}
        </Text>
        <Text style={s.activeFooterOrderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
        <Pressable onPress={onRefresh} style={s.activeRefreshBtn}>
          <Ionicons name="refresh" size={14} color="#012a62" />
        </Pressable>
      </View>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, address: savedAddress, updateProfile, updateAddress, logout } = useAuthStore();
  const socket = useSocket();

  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setLocalAddress] = useState(savedAddress || "");
  const [password, setPassword] = useState("");

  // Sync inputs with the auth store user state (e.g. standard/gold downgrades & updates)
  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      setPhone(user.phone || "");
    }
  }, [user]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Past Orders State
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const isGoldSubscriber = user?.email?.toLowerCase().includes("gold");

  // Fetch customer orders on mount
  useEffect(() => {
    loadOrders();
  }, []);

  // Socket updates for real time status tracking
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

  // Identify active order and join its room
  const activeOrder = orders.find(
    (o) =>
      o.status !== "RETURNED" &&
      o.status !== "REFUNDED" &&
      (o.status !== "DELIVERED" || (o.tryTimerRemainingMs && o.tryTimerRemainingMs > 0))
  );

  const completedOrders = orders.filter(
    (o) =>
      o.status === "RETURNED" ||
      o.status === "REFUNDED" ||
      (o.status === "DELIVERED" && (!o.tryTimerRemainingMs || o.tryTimerRemainingMs <= 0))
  );

  useEffect(() => {
    if (!socket || !activeOrder) return;
    socket.emit("join_order_room", activeOrder.id);
  }, [socket, activeOrder?.id]);

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await api.get("/orders");
      const list = res.data?.data?.orders || res.data?.orders || [];
      setOrders(list);
    } catch (err) {
      console.warn("Could not fetch customer orders in ProfileScreen:", err.message);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleToggleSubscription = async () => {
    setLoading(true);
    try {
      let currentEmail = user?.email || "";
      const isCurrentlyGold = currentEmail.toLowerCase().includes("gold");
      
      let newEmail;
      if (isCurrentlyGold) {
        newEmail = currentEmail.replace(/_gold/gi, "").replace(/gold/gi, "");
      } else {
        const parts = currentEmail.split("@");
        newEmail = `${parts[0]}_gold@${parts[1]}`;
      }
      
      const payload = {
        email: newEmail,
        phone: phone.trim() || user?.phone || "1234567890",
      };
      
      await updateProfile(payload);
      setEmail(newEmail);
      Alert.alert(
        "Success", 
        `Subscription tier updated! You are now a ${!isCurrentlyGold ? "Gold Member" : "Standard Tier customer"}.`
      );
      // Reload orders to reflect updated subscription price rules
      loadOrders();
    } catch (err) {
      Alert.alert("Error", err?.message || "Could not update subscription tier");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!email.trim() || !phone.trim()) {
      setError("Email and Phone are required");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const payload = {
        email: email.trim(),
        phone: phone.trim(),
      };
      if (password.trim()) {
        payload.password = password.trim();
      }
      await updateProfile(payload);
      await updateAddress(address.trim());
      setPassword("");
      Alert.alert("Success", "Profile updated successfully!");
    } catch (err) {
      setError(err?.response?.data?.error?.message || "Could not update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: () => logout() },
      ]
    );
  };

  const toggleOrderExpand = (orderId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(orderId);
    }
  };

  const initials = (user?.email || "U").substring(0, 2).toUpperCase();

  return (
    <View style={[s.root, { paddingTop: Math.max(insets.top, 12) }]}>
      {/* Custom Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Account Settings</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Profile Avatar Card */}
        <View style={s.avatarCard}>
          <View style={[s.avatarCircle, isGoldSubscriber && s.avatarCircleGold]}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.userEmail}>{user?.email}</Text>
          <View style={[s.roleBadge, isGoldSubscriber && s.roleBadgeGold]}>
            <Text style={[s.roleText, isGoldSubscriber && s.roleTextGold]}>
              {isGoldSubscriber ? "Voda Gold VIP" : (user?.role || "Customer")}
            </Text>
          </View>
        </View>

        {/* Active Order Card */}
        {activeOrder && (
          <ActiveOrderCard
            order={activeOrder}
            navigation={navigation}
            onRefresh={loadOrders}
          />
        )}

        {/* Subscription Tier Toggle */}
        <Pressable style={s.formCard} onPress={() => navigation.navigate("VodaGold")}>
          <Text style={s.formTitle}>Subscription Tier</Text>
          <View style={s.tierRow}>
            <View style={s.tierInfo}>
              <Text style={s.tierName}>{isGoldSubscriber ? "Voda Gold Member" : "Standard Tier"}</Text>
              <Text style={s.tierDesc}>
                {isGoldSubscriber 
                  ? "Enjoy free delivery and unlimited Try & Buy on all orders!"
                  : "Upgrade to Voda Gold for free delivery & unlimited Try & Buy."}
              </Text>
            </View>
            <View style={[s.toggleBtn, isGoldSubscriber ? s.toggleBtnActive : s.toggleBtnInactive]}>
              <Text style={[s.toggleBtnText, isGoldSubscriber ? s.toggleBtnTextActive : s.toggleBtnTextInactive]}>
                {isGoldSubscriber ? "Gold Active" : "Upgrade"}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Edit Form */}
        <View style={s.formCard}>
          <Text style={s.formTitle}>Edit Details</Text>

          <Text style={s.label}>Email Address</Text>
          <View style={s.inputContainer}>
            <Ionicons name="mail-outline" size={18} color="#012a6260" style={s.inputIcon} />
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Text style={s.label}>Phone Number</Text>
          <View style={s.inputContainer}>
            <Ionicons name="call-outline" size={18} color="#012a6260" style={s.inputIcon} />
            <TextInput
              style={s.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone"
              keyboardType="phone-pad"
            />
          </View>

          <Text style={s.label}>Default Delivery Address</Text>
          <View style={[s.inputContainer, { minHeight: 60, alignItems: "flex-start", paddingTop: 10 }]}>
            <Ionicons name="location-outline" size={18} color="#012a6260" style={[s.inputIcon, { marginTop: 2 }]} />
            <TextInput
              style={[s.input, { height: "100%", textAlignVertical: "top" }]}
              value={address}
              onChangeText={setLocalAddress}
              placeholder="Saved Delivery Address"
              multiline
            />
          </View>

          <Text style={s.label}>New Password (Optional)</Text>
          <View style={s.inputContainer}>
            <Ionicons name="lock-closed-outline" size={18} color="#012a6260" style={s.inputIcon} />
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Leave blank to keep current"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {/* Save profile Button */}
        <Pressable
          style={[s.saveBtn, loading && s.btnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fdde59" />
          ) : (
            <Text style={s.saveBtnText}>Save Profile</Text>
          )}
        </Pressable>

        {/* Order History Section */}
        <View style={s.ordersHeaderRow}>
          <Text style={s.ordersHeaderTitle}>Order History</Text>
          <Pressable onPress={loadOrders} style={s.refreshBtn}>
            <Ionicons name="refresh" size={16} color="#012a62" />
          </Pressable>
        </View>

        {ordersLoading && completedOrders.length === 0 ? (
          <ActivityIndicator color="#012a62" style={{ marginVertical: 20 }} />
        ) : completedOrders.length === 0 ? (
          <View style={s.emptyOrdersCard}>
            <Ionicons name="receipt-outline" size={36} color="#012a6240" style={{ marginBottom: 8 }} />
            <Text style={s.emptyOrdersText}>No past orders found.</Text>
          </View>
        ) : (
          <View style={{ marginBottom: 16 }}>
            {/* Display only the most recent completed order */}
            {(() => {
              const order = completedOrders[0];
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
            })()}

            {/* View All Orders Button */}
            {completedOrders.length > 1 && (
              <Pressable
                style={({ pressed }) => [
                  s.viewAllOrdersBtn,
                  pressed && s.viewAllOrdersBtnPressed,
                ]}
                onPress={() => navigation.navigate("OrderHistory", { orders: completedOrders })}
              >
                <Text style={s.viewAllOrdersBtnText}>
                  View All Orders ({completedOrders.length})
                </Text>
                <Ionicons name="arrow-forward" size={15} color="#012a62" />
              </Pressable>
            )}
          </View>
        )}

        {/* Logout Button */}
        <Pressable style={s.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#dc2626" style={{ marginRight: 6 }} />
          <Text style={s.logoutBtnText}>Logout</Text>
        </Pressable>
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
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#012a6210",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#012a62",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarCard: {
    backgroundColor: "#fffef5",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#012a6208",
    marginBottom: 20,
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#012a62",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: "#fdde59",
    fontSize: 24,
    fontWeight: "900",
  },
  userEmail: {
    fontSize: 16,
    fontWeight: "700",
    color: "#012a62",
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: "#012a6210",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#012a62",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  avatarCircleGold: {
    borderColor: "#fdde59",
    borderWidth: 2,
  },
  roleBadgeGold: {
    backgroundColor: "#fdde5940",
    borderColor: "#fdde59",
    borderWidth: 1.5,
  },
  roleTextGold: {
    color: "#012a62",
  },
  formCard: {
    backgroundColor: "#fffef5",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#012a6208",
    marginBottom: 16,
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#012a62",
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#012a6280",
    marginBottom: 6,
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#012a6220",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: "#012a62",
    fontWeight: "600",
  },
  error: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: "#012a62",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 24,
  },
  saveBtnText: {
    color: "#fdde59",
    fontWeight: "800",
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#dc262620",
    borderRadius: 12,
    backgroundColor: "#fffef5",
    marginTop: 8,
  },
  logoutBtnText: {
    color: "#dc2626",
    fontWeight: "800",
    fontSize: 15,
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tierInfo: {
    flex: 1,
    marginRight: 12,
  },
  tierName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#012a62",
  },
  tierDesc: {
    fontSize: 12,
    color: "#012a6260",
    marginTop: 4,
    fontWeight: "600",
    lineHeight: 16,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleBtnActive: {
    backgroundColor: "#fdde59",
    borderColor: "#012a62",
  },
  toggleBtnInactive: {
    backgroundColor: "#ffffff",
    borderColor: "#012a6220",
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: "900",
  },
  toggleBtnTextActive: {
    color: "#012a62",
  },
  toggleBtnTextInactive: {
    color: "#012a6280",
  },
  // Order History Styles
  ordersHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  ordersHeaderTitle: {
    fontSize: 16,
    fontWeight: "850",
    color: "#012a62",
  },
  refreshBtn: {
    padding: 6,
  },
  emptyOrdersCard: {
    backgroundColor: "#fffef5",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#012a6208",
    marginBottom: 24,
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
    marginBottom: 12,
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
  // Collapsible Expanded Content
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
  activeCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "#fdde59",
    marginBottom: 20,
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  activeCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  activeCardLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#012a62",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  activeOrderId: {
    fontSize: 11,
    fontWeight: "700",
    color: "#012a6250",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  activeStatusMsg: {
    fontSize: 16,
    fontWeight: "800",
    color: "#012a62",
    marginBottom: 14,
  },
  otpBox: {
    backgroundColor: "#012a6208",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#012a6210",
  },
  otpLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#012a6280",
    letterSpacing: 1,
    marginBottom: 4,
  },
  otpText: {
    fontSize: 26,
    fontWeight: "900",
    color: "#012a62",
    letterSpacing: 6,
    marginVertical: 4,
  },
  otpHint: {
    fontSize: 11,
    color: "#012a6260",
    textAlign: "center",
    fontWeight: "600",
  },
  timerBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffdf0",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fdde5960",
    marginBottom: 14,
  },
  timerBoxTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#012a6270",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timerBoxClock: {
    fontSize: 20,
    fontWeight: "900",
    color: "#012a62",
    fontVariant: ["tabular-nums"],
  },
  tbPortalBtn: {
    backgroundColor: "#fdde59",
    borderColor: "#012a62",
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tbPortalBtnText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#012a62",
  },
  mapTrackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fdde59",
    borderColor: "#012a62",
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 12,
  },
  mapTrackBtnText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#012a62",
  },
  activeCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#012a6208",
    paddingTop: 12,
  },
  activeFooterOrderId: {
    fontSize: 11,
    fontWeight: "700",
    color: "#012a6250",
    marginRight: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  activeAddress: {
    fontSize: 12,
    color: "#012a6260",
    fontWeight: "600",
    flex: 1,
    marginRight: 10,
  },
  viewAllOrdersBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderColor: "rgba(1, 42, 98, 0.1)",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 12,
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
  },
  viewAllOrdersBtnPressed: {
    backgroundColor: "rgba(1, 42, 98, 0.05)",
  },
  viewAllOrdersBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#012a62",
    marginRight: 6,
  },
  activeRefreshBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#012a6208",
    alignItems: "center",
    justifyContent: "center",
  },
  pulseContainer: {
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
});
