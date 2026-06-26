import { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSocket } from "../../api/SocketContext";
import { api } from "../../api/client";
import { useAuthStore } from "../../store/useAuthStore";
import { useSizingStore } from "../../store/useSizingStore";

const RETURN_REASONS = [
  "Wrong size received",
  "Item looks different from photos",
  "Poor quality / not as described",
  "Damaged or defective item",
  "Changed my mind",
  "Wrong item delivered",
  "Colour different from what was shown",
  "Fit doesn't suit me (despite correct size)",
  "Missing parts or accessories",
  "Ordered by mistake"
];

// Server sets tryTimerEnd = now + 5 min; display window = 1 min.
// Offset between them = 4 min. Both screens derive from the same server timestamp.
const DISPLAY_OFFSET_MS = 4 * 60 * 1000;

function calcDisplaySecs(tryTimerEnd) {
  if (!tryTimerEnd) return 0;
  const displayEnd = new Date(tryTimerEnd).getTime() - DISPLAY_OFFSET_MS;
  return Math.max(0, Math.floor((displayEnd - Date.now()) / 1000));
}

const formatRupeePrice = (amount) => {
  const rounded = Math.round(amount);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

function pad(n) { return String(n).padStart(2, "0"); }

export default function TryBuyScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { order: initialOrder } = route.params;
  const socket = useSocket();

  const [order, setOrder] = useState(initialOrder);
  const [loading, setLoading] = useState(false);
  const [secs, setSecs] = useState(() => calcDisplaySecs(initialOrder.tryTimerEnd));
  const [expired, setExpired] = useState(() => calcDisplaySecs(initialOrder.tryTimerEnd) === 0);
  const [returnOtp, setReturnOtp] = useState(null); // customer→rider OTP after request-return
  const [selections, setSelections] = useState(() => {
    const initial = {};
    initialOrder.items.forEach((item) => {
      initial[item.variantId] = "KEEP";
    });
    return initial;
  });

  const user = useAuthStore((state) => state.user);
  const [showReasonsModal, setShowReasonsModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState(null);
  const [returnComment, setReturnComment] = useState("");
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  // Countdown derived from server tryTimerEnd — stays in sync with rider screen
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = calcDisplaySecs(order.tryTimerEnd);
      setSecs(remaining);
      if (remaining === 0) setExpired(true);
    }, 500);
    return () => clearInterval(interval);
  }, [order.tryTimerEnd]);

  // Listen for order updates from rider (e.g. rider force-navigates)
  useEffect(() => {
    if (!socket) return;
    socket.emit("join_order_room", order.id);
    const handler = ({ order: updated }) => {
      if (updated.id === order.id) {
        setOrder(updated);
        if (updated.status === "RETURNING" || updated.status === "RETURNED") {
          fetchPostReturnSuggestions(updated);
        }
      }
    };
    socket.on("order_update", handler);
    return () => socket.off("order_update", handler);
  }, [socket, order.id]);

  const toggleSelection = (variantId, choice) => {
    setSelections((prev) => ({ ...prev, [variantId]: choice }));
  };

  const items = order.items || [];
  let keepsSubtotal = 0;
  let returnsTotal = 0;
  items.forEach((item) => {
    const choice = selections[item.variantId] ?? "KEEP";
    const cost = Number(item.product.price) * item.quantity;
    if (choice === "KEEP") keepsSubtotal += cost;
    else returnsTotal += cost;
  });

  const deliveryFee = order.deliveryFee ?? 0;
  const tryAndBuyFee = order.tryAndBuyFee ?? 0;
  const finalTotalAmount = keepsSubtotal + deliveryFee + tryAndBuyFee;
  const anyReturns = Object.values(selections).some((v) => v === "RETURN");

  const handleKeepAll = async () => {
    setLoading(true);
    try {
      await api.post(`/orders/${order.id}/confirm-tb-keeps`, { selections });
      Alert.alert("Confirmed!", "Your items are confirmed as kept. Enjoy!");
      navigation.popToTop();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error?.message ?? "Failed to confirm");
    } finally {
      setLoading(false);
    }
  };

  const fetchPostReturnSuggestions = async (currentOrder) => {
    try {
      const activeOrder = currentOrder || order;
      // Use isReturned flag from backend order items (reliable even when rider changes status)
      const returnedItems = activeOrder.items.filter(item => item.isReturned === true);
      // Fall back to local selections state if no backend-flagged returns yet
      const fallbackItems = returnedItems.length === 0
        ? activeOrder.items.filter(item => selections[item.variantId] === "RETURN")
        : returnedItems;
      const categories = [...new Set(fallbackItems.map(item => item.product?.category).filter(Boolean))];
      let categoryFilter = categories[0] || "Sneakers";

      const { data } = await api.get("/products", {
        params: { category: categoryFilter }
      });

      let prodList = data?.data?.products || [];
      const orderedProductIds = activeOrder.items.map(item => item.productId);
      let filtered = prodList.filter(p => !orderedProductIds.includes(p.id));

      if (filtered.length === 0) {
        const allProdsResponse = await api.get("/products");
        filtered = (allProdsResponse?.data?.data?.products || []).filter(p => !orderedProductIds.includes(p.id));
      }

      // Filter by size profile if available in useSizingStore
      const savedSizes = useSizingStore.getState();
      const sizingInput = categoryFilter === "Sneakers" ? savedSizes.sizeSneakers : savedSizes.sizeApparel;
      const cleanSize = (sz) => String(sz).toLowerCase().replace(/^(uk|us)\s*/i, "").trim();

      if (sizingInput) {
        const targetSize = cleanSize(sizingInput);
        const sizedList = filtered.filter((p) =>
          p.variants?.some((v) => cleanSize(v.size) === targetSize)
        );
        if (sizedList.length > 0) {
          filtered = sizedList;
        }
      }

      setSuggestions(filtered.slice(0, 4));
      setShowSuggestionsModal(true);
    } catch (err) {
      console.log("Failed to fetch return suggestions:", err);
    }
  };

  const confirmReturn = async () => {
    if (!selectedReason) {
      Alert.alert("Error", "Please select a reason for the return.");
      return;
    }
    setLoading(true);
    setShowReasonsModal(false);
    try {
      const { data } = await api.post(`/orders/${order.id}/request-return`, {
        selections,
        returnReason: selectedReason,
        returnComment
      });
      setReturnOtp(data.data.returnOtp);
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error?.message ?? "Failed to initiate return");
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = () => {
    setShowReasonsModal(true);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#012a62" />
        </Pressable>
        <Text style={s.headerTitle}>Try & Buy Portal</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}>
        {/* Timer Card */}
        <View style={[s.timerCard, expired && s.timerCardExpired]}>
          <Ionicons name="timer-outline" size={24} color={expired ? "#dc2626" : "#012a62"} />
          <Text style={[s.timerTitle, expired && s.timerTitleExpired]}>
            {expired ? "Time's Up — Choose Now" : "Trial Time Remaining"}
          </Text>
          <Text style={[s.timerClock, expired && s.timerClockExpired]}>
            {expired ? "00:00" : `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`}
          </Text>
          <Text style={s.timerSubtitle}>
            {expired
              ? "Your 1-minute trial has ended. Please confirm your decision."
              : "You have 1 minute to try your items. Select what you want to return."}
          </Text>
        </View>

        {/* Product Items List */}
        <Text style={s.sectionLabel}>Select Kept vs Returned Items</Text>
        {items.map((item) => {
          const isEligible =
            item.product.category === "Sneakers" || item.product.category === "Apparel";
          const choice = selections[item.variantId] || "KEEP";

          return (
            <View key={item.id} style={s.itemCard}>
              <View style={s.itemDetails}>
                <Text style={s.itemName}>{item.product.name}</Text>
                <Text style={s.itemSub}>
                  {item.quantity}× • Size: {item.variant.size}
                  {item.variant.color ? ` • ${item.variant.color}` : ""}
                </Text>
                <Text style={s.itemPrice}>₹{formatRupeePrice(item.product.price * item.quantity)}</Text>
              </View>

              {isEligible ? (
                <View style={s.choiceRow}>
                  <Pressable
                    onPress={() => toggleSelection(item.variantId, "KEEP")}
                    style={[s.choiceBtn, choice === "KEEP" && s.choiceBtnKeep]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={choice === "KEEP" ? "#ffffff" : "#012a6260"}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[s.choiceText, choice === "KEEP" && s.choiceTextActive]}>Keep</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => toggleSelection(item.variantId, "RETURN")}
                    style={[s.choiceBtn, choice === "RETURN" && s.choiceBtnReturn]}
                  >
                    <Ionicons
                      name="arrow-undo"
                      size={16}
                      color={choice === "RETURN" ? "#ffffff" : "#012a6260"}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[s.choiceText, choice === "RETURN" && s.choiceTextActive]}>Return</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={s.ineligibleTag}>
                  <Ionicons name="lock-closed-outline" size={13} color="#ea580c" style={{ marginRight: 4 }} />
                  <Text style={s.ineligibleText}>Ineligible Category (Boots)</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Live Calculation receipt card */}
        <View style={s.receiptCard}>
          <Text style={s.receiptTitle}>Dynamic Receipt Summary</Text>
          <View style={s.receiptRow}>
            <Text style={s.receiptLabel}>Keep Subtotal</Text>
            <Text style={s.receiptVal}>₹{formatRupeePrice(keepsSubtotal)}</Text>
          </View>
          <View style={s.receiptRow}>
            <Text style={s.receiptLabel}>Delivery Fee</Text>
            <Text style={deliveryFee === 0 ? s.freeText : s.receiptVal}>
              {deliveryFee === 0 ? "FREE" : `₹${formatRupeePrice(deliveryFee)}`}
            </Text>
          </View>
          <View style={s.receiptRow}>
            <Text style={s.receiptLabel}>Try & Buy Fee</Text>
            <Text style={tryAndBuyFee === 0 ? s.freeText : s.receiptVal}>
              {tryAndBuyFee === 0 ? "FREE" : `₹${formatRupeePrice(tryAndBuyFee)}`}
            </Text>
          </View>
          <View style={[s.receiptRow, { marginTop: 4 }]}>
            <Text style={[s.receiptLabel, { color: "#ea580c", fontWeight: "700" }]}>Return Refund</Text>
            <Text style={s.refundVal}>- ₹{formatRupeePrice(returnsTotal)}</Text>
          </View>
          <View style={s.receiptDivider} />
          <View style={s.receiptRow}>
            <Text style={s.totalLabel}>Adjusted Payment Total</Text>
            <Text style={s.totalVal}>₹{formatRupeePrice(finalTotalAmount)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Actions */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        {returnOtp ? (
          <>
            <View style={s.otpCard}>
              <Text style={s.otpTitle}>Show this code to the rider</Text>
              <Text style={s.otpCode}>{returnOtp}</Text>
              <Text style={s.otpHint}>The rider will enter this code to confirm the return pickup.</Text>
            </View>
            <Pressable onPress={() => setReturnOtp(null)} style={s.cancelLink}>
              <Text style={s.cancelLinkText}>Changed my mind — go back</Text>
            </Pressable>
          </>
        ) : (
          <>
            {anyReturns ? (
              <Pressable
                style={[s.returnBtn, loading && s.btnDisabled]}
                onPress={handleReturn}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.returnBtnText}>Return Selected Items — Refund ₹{formatRupeePrice(returnsTotal)}</Text>}
              </Pressable>
            ) : null}
            <Pressable
              style={[s.submitBtn, loading && s.btnDisabled]}
              onPress={handleKeepAll}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#012a62" />
                : <Text style={s.submitBtnText}>Keep All Items • Pay ₹{formatRupeePrice(finalTotalAmount)}</Text>}
            </Pressable>
          </>
        )}
      </View>

      {/* Return Reason Modal */}
      <Modal
        visible={showReasonsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReasonsModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.reasonsSheet}>
            <View style={s.grabHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Why are you returning?</Text>
              <Pressable onPress={() => setShowReasonsModal(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color="#012a62" />
              </Pressable>
            </View>

            <ScrollView style={s.reasonsList} showsVerticalScrollIndicator={false}>
              <Text style={s.modalSubtitle}>Please select the primary reason for returning the selected items.</Text>
              {RETURN_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <Pressable
                    key={reason}
                    onPress={() => setSelectedReason(reason)}
                    style={[s.reasonItem, isSelected && s.reasonItemActive]}
                  >
                    <View style={[s.radioCircle, isSelected && s.radioCircleActive]}>
                      {isSelected && <View style={s.radioInnerCircle} />}
                    </View>
                    <Text style={[s.reasonText, isSelected && s.reasonTextActive]}>{reason}</Text>
                  </Pressable>
                );
              })}

              <Text style={s.commentLabel}>Additional Comments (Optional)</Text>
              <TextInput
                style={s.commentInput}
                placeholder="Tell us more about the fit or quality issues..."
                placeholderTextColor="#012a6240"
                value={returnComment}
                onChangeText={setReturnComment}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={s.modalFooter}>
              <Pressable
                style={[s.modalConfirmBtn, !selectedReason && s.modalConfirmBtnDisabled]}
                onPress={confirmReturn}
                disabled={!selectedReason}
              >
                <Text style={s.modalConfirmBtnText}>Confirm Return</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Post-Return Suggestions Modal */}
      <Modal
        visible={showSuggestionsModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSuggestionsModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.suggestionsCard}>
            <View style={s.grabHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>We're sorry you didn't find the right one for you, here's what else you might love</Text>
              <Pressable onPress={() => setShowSuggestionsModal(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color="#012a62" />
              </Pressable>
            </View>

            <ScrollView style={s.suggestionsScroll} showsVerticalScrollIndicator={false}>
              <Text style={s.suggestionsIntro}>
                We want to make sure you find the perfect style and fit. Based on your return, here are some recommendations you might love:
              </Text>

              {suggestions.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suggestionsHorizontal}>
                  {suggestions.map((product) => {
                    const isAvailable = product.variants?.some(v => v.stock > 0);

                    return (
                      <Pressable
                        key={product.id}
                        style={s.suggestionProdCard}
                        onPress={() => {
                          setShowSuggestionsModal(false);
                          navigation.navigate("ProductDetail", { productId: product.id, id: product.id });
                        }}
                      >
                        <View style={s.suggestionImgPlaceholder}>
                          {product.images?.[0] ? (
                            <Image
                              source={{ uri: product.images[0].startsWith("http") ? product.images[0] : `http://localhost:3001${product.images[0]}` }}
                              style={s.suggestionImg}
                              resizeMode="cover"
                            />
                          ) : (
                            <Ionicons
                              name={product.category === "Sneakers" ? "footsteps-outline" : "shirt-outline"}
                              size={32}
                              color="#012a6240"
                            />
                          )}
                        </View>
                        <View style={s.suggestionDetails}>
                          <Text style={s.suggestionProdName} numberOfLines={1}>
                            {product.name}
                          </Text>
                          <Text style={s.suggestionProdStore} numberOfLines={1}>
                            {product.store?.name || "Voda Partner Store"}
                          </Text>
                          <Text style={s.suggestionProdPrice}>
                            ₹{formatRupeePrice(product.price)}
                          </Text>

                          {isAvailable ? (
                            <View style={s.sizeBadge}>
                              <Text style={s.sizeBadgeText}>✨ In Stock</Text>
                            </View>
                          ) : (
                            <View style={[s.sizeBadge, s.sizeBadgeOut]}>
                              <Text style={s.sizeBadgeTextOut}>Out of Stock</Text>
                            </View>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={s.emptySuggestions}>
                  <Ionicons name="sparkles-outline" size={32} color="#012a6230" />
                  <Text style={s.emptySuggestionsText}>No other recommendations in this category right now.</Text>
                </View>
              )}

              <Pressable
                style={s.suggestionsCloseBtn}
                onPress={() => setShowSuggestionsModal(false)}
              >
                <Text style={s.suggestionsCloseBtnText}>Browse More Products</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f2f2f7",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60, 60, 67, 0.29)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f2f2f7",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    letterSpacing: -0.4,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
  },
  timerCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fdde59",
    marginBottom: 24,
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 3,
  },
  timerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#012a62a0",
    marginTop: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timerClock: {
    fontSize: 44,
    fontWeight: "900",
    color: "#012a62",
    marginVertical: 8,
    fontVariant: ["tabular-nums"],
  },
  timerSubtitle: {
    fontSize: 12,
    color: "#012a6270",
    textAlign: "center",
    lineHeight: 17,
    fontWeight: "600",
  },
  timerCardExpired: {
    borderColor: "#dc2626",
    backgroundColor: "#fff5f5",
  },
  timerTitleExpired: {
    color: "#dc2626",
  },
  timerClockExpired: {
    color: "#dc2626",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#012a6270",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#012a6206",
  },
  itemDetails: {
    marginBottom: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#012a62",
    marginBottom: 2,
  },
  itemSub: {
    fontSize: 12,
    color: "#012a6260",
    fontWeight: "600",
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#012a62",
  },
  choiceRow: {
    flexDirection: "row",
    gap: 8,
  },
  choiceBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#012a6205",
    borderRadius: 10,
    paddingVertical: 10,
    borderColor: "#012a6210",
    borderWidth: 1,
  },
  choiceBtnKeep: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  choiceBtnReturn: {
    backgroundColor: "#dc2626",
    borderColor: "#dc2626",
  },
  choiceText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#012a62b0",
  },
  choiceTextActive: {
    color: "#ffffff",
  },
  ineligibleTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ea580c10",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  ineligibleText: {
    color: "#ea580c",
    fontSize: 12,
    fontWeight: "700",
  },
  receiptCard: {
    backgroundColor: "#fffef5",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#012a6208",
    marginTop: 12,
  },
  receiptTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#012a62",
    marginBottom: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  receiptLabel: {
    color: "#012a6270",
    fontSize: 13,
    fontWeight: "600",
  },
  receiptVal: {
    color: "#012a62",
    fontSize: 13,
    fontWeight: "700",
  },
  freeText: {
    color: "#16a34a",
    fontSize: 13,
    fontWeight: "800",
  },
  refundVal: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "800",
  },
  receiptDivider: {
    height: 1,
    backgroundColor: "#012a620c",
    marginVertical: 10,
  },
  totalLabel: {
    color: "#012a62",
    fontSize: 14,
    fontWeight: "800",
  },
  totalVal: {
    color: "#012a62",
    fontSize: 16,
    fontWeight: "950",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderColor: "#012a620c",
  },
  submitBtn: {
    backgroundColor: "#fdde59",
    borderColor: "#012a62",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    color: "#012a62",
    fontWeight: "900",
    fontSize: 16,
  },
  returnBtn: {
    backgroundColor: "#dc2626",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  returnBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  otpCard: {
    backgroundColor: "#012a62",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  otpTitle: {
    color: "#fdde59",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  otpCode: {
    color: "#ffffff",
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: 10,
    fontVariant: ["tabular-nums"],
    marginBottom: 8,
  },
  otpHint: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
  cancelLink: {
    alignItems: "center",
    paddingVertical: 12,
  },
  cancelLinkText: {
    color: "#012a62",
    opacity: 0.45,
    fontSize: 13,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(1, 42, 98, 0.4)",
    justifyContent: "flex-end",
  },
  reasonsSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: "85%",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#012a6260",
    fontWeight: "600",
    marginBottom: 16,
  },
  reasonsList: {
    marginBottom: 16,
  },
  reasonItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#012a6204",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#012a6208",
  },
  reasonItemActive: {
    backgroundColor: "#fdde5915",
    borderColor: "#fdde59",
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#012a6240",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  radioCircleActive: {
    borderColor: "#012a62",
  },
  radioInnerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#012a62",
  },
  reasonText: {
    fontSize: 14,
    color: "#012a62a0",
    fontWeight: "600",
  },
  reasonTextActive: {
    color: "#012a62",
    fontWeight: "700",
  },
  commentLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#012a6270",
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  commentInput: {
    backgroundColor: "#012a6204",
    borderWidth: 1,
    borderColor: "#012a6210",
    borderRadius: 12,
    padding: 12,
    color: "#012a62",
    fontSize: 14,
    fontWeight: "600",
    textAlignVertical: "top",
    minHeight: 80,
    marginBottom: 20,
  },
  modalFooter: {
    paddingBottom: 24,
  },
  modalConfirmBtn: {
    backgroundColor: "#fdde59",
    borderColor: "#012a62",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmBtnDisabled: {
    backgroundColor: "#012a6210",
    borderColor: "#012a6220",
    opacity: 0.5,
  },
  modalConfirmBtnText: {
    color: "#012a62",
    fontWeight: "900",
    fontSize: 16,
  },
  suggestionsCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: "85%",
    marginTop: "auto",
  },
  suggestionsIntro: {
    fontSize: 13,
    color: "#012a6280",
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 16,
  },
  suggestionsScroll: {
    marginBottom: 24,
  },
  suggestionsHorizontal: {
    paddingRight: 16,
    flexDirection: "row",
    gap: 12,
    paddingBottom: 8,
  },
  suggestionProdCard: {
    width: 150,
    backgroundColor: "#012a6204",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#012a6208",
    padding: 8,
  },
  suggestionImgPlaceholder: {
    width: "100%",
    height: 100,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    overflow: "hidden",
  },
  suggestionImg: {
    width: "100%",
    height: "100%",
  },
  suggestionDetails: {
    paddingHorizontal: 4,
  },
  suggestionProdName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#012a62",
  },
  suggestionProdStore: {
    fontSize: 11,
    color: "#012a6250",
    fontWeight: "600",
    marginTop: 2,
  },
  suggestionProdPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#012a62",
    marginTop: 4,
  },
  sizeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#16a34a12",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 6,
  },
  sizeBadgeText: {
    color: "#16a34a",
    fontSize: 9,
    fontWeight: "700",
  },
  sizeBadgeOut: {
    backgroundColor: "#012a620a",
  },
  sizeBadgeTextOut: {
    color: "#012a6250",
    fontSize: 9,
    fontWeight: "700",
  },
  emptySuggestions: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptySuggestionsText: {
    fontSize: 12,
    color: "#012a6240",
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },
  suggestionsCloseBtn: {
    backgroundColor: "#012a6208",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#012a6210",
  },
  suggestionsCloseBtnText: {
    color: "#012a62",
    fontWeight: "800",
    fontSize: 14,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#012a62",
  },
  grabHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(1, 42, 98, 0.12)",
    alignSelf: "center",
    marginBottom: 16,
  },
});
