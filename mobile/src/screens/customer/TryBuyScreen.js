import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";

const formatRupeePrice = (amount) => {
  const rounded = Math.round(amount);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export default function TryBuyScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { order } = route.params;

  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [selections, setSelections] = useState({}); // variantId -> 'KEEP' or 'RETURN'

  // Initialize all eligible items as 'KEEP' by default
  useEffect(() => {
    const initial = {};
    order.items.forEach((item) => {
      const isEligible =
        item.product.category === "Sneakers" || item.product.category === "Apparel";
      // Only show keeps/returns selector for eligible categories
      if (isEligible) {
        initial[item.variantId] = "KEEP";
      }
    });
    setSelections(initial);
  }, [order]);

  // Synchronized countdown timer logic
  useEffect(() => {
    if (!order.tryTimerEnd) return;

    const endTime = new Date(order.tryTimerEnd).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = endTime - now;

      if (diff <= 0) {
        clearInterval(interval);
        setTimeLeft("00:00");
        Alert.alert(
          "Time Expired",
          "Your 10-minute Try & Buy trial has ended. All items are confirmed as Kept.",
          [{ text: "OK", onPress: () => handleAutoFinalize() }]
        );
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        const formatNum = (num) => (num < 10 ? `0${num}` : num);
        setTimeLeft(`${formatNum(minutes)}:${formatNum(seconds)}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order.tryTimerEnd]);

  const toggleSelection = (variantId, choice) => {
    setSelections((prev) => ({
      ...prev,
      [variantId]: choice,
    }));
  };

  // Compute Keep Subtotal, Return Refund, and final total
  const items = order.items || [];
  let keepsSubtotal = 0;
  let returnsTotal = 0;

  items.forEach((item) => {
    const choice = selections[item.variantId] || "KEEP";
    const cost = Number(item.product.price) * item.quantity;
    if (choice === "KEEP") {
      keepsSubtotal += cost;
    } else {
      returnsTotal += cost;
    }
  });

  const deliveryFee = order.deliveryFee ?? 0;
  const tryAndBuyFee = order.tryAndBuyFee ?? 0;
  const finalTotalAmount = keepsSubtotal + deliveryFee + tryAndBuyFee;

  const handleAutoFinalize = async () => {
    setLoading(true);
    try {
      await api.post(`/orders/${order.id}/confirm-tb-keeps`);
      navigation.popToTop();
    } catch (err) {
      console.warn("Auto-finalize error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Send Keeps & Returns selections to backend
      await api.post(`/orders/${order.id}/confirm-tb-keeps`, {
        selections,
      });
      Alert.alert("Success", "Try & Buy selection confirmed! Receipt updated.");
      navigation.popToTop();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error?.message ?? "Failed to save selections");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={s.headerTitle}>Try & Buy Portal</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}>
        {/* Timer Card */}
        <View style={s.timerCard}>
          <Ionicons name="timer-outline" size={24} color="#012a62" />
          <Text style={s.timerTitle}>Trial Time Remaining</Text>
          <Text style={s.timerClock}>{timeLeft || "--:--"}</Text>
          <Text style={s.timerSubtitle}>
            Try your items at your doorstep. Select what you want to return before the timer expires.
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
        <Pressable
          style={[s.submitBtn, loading && s.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#012a62" />
          ) : (
            <Text style={s.submitBtnText}>Confirm Selection • ₹{formatRupeePrice(finalTotalAmount)}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fdf9ea",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#012a6210",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#012a62",
  },
  content: {
    padding: 20,
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
  btnDisabled: {
    opacity: 0.5,
  },
});
