import { View, Text, FlatList, Pressable, Image, StyleSheet } from "react-native";
import { useOrderStore } from "../../store/useOrderStore";

const formatRupeePrice = (amount) => {
  const rounded = Math.round(amount);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export default function CartScreen({ navigation }) {
  const { cart, updateQuantity, removeFromCart } = useOrderStore();

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  if (cart.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>Your cart is empty</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <FlatList
        data={cart}
        keyExtractor={(item) => item.variantId}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={s.row}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={s.thumb} />
            ) : (
              <View style={[s.thumb, s.thumbPlaceholder]} />
            )}
            <View style={s.info}>
              <Text style={s.name}>{item.name}</Text>
              {item.size ? <Text style={s.meta}>Size: {item.size}</Text> : null}
              <Text style={s.price}>₹{formatRupeePrice(item.price * item.quantity)}</Text>
            </View>
            <View style={s.qty}>
              <Pressable style={s.qtyBtn} onPress={() => updateQuantity(item.variantId, item.quantity - 1)}>
                <Text style={s.qtyBtnText}>−</Text>
              </Pressable>
              <Text style={s.qtyNum}>{item.quantity}</Text>
              <Pressable style={s.qtyBtn} onPress={() => updateQuantity(item.variantId, item.quantity + 1)}>
                <Text style={s.qtyBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={s.footer}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalAmt}>₹{formatRupeePrice(total)}</Text>
            </View>
            <Pressable style={s.checkoutBtn} onPress={() => navigation.navigate("Checkout")}>
              <Text style={s.checkoutBtnText}>Proceed to Checkout</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: "#fdf9ea" },
  empty:            { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fdf9ea" },
  emptyText:        { color: "#012a6280", fontSize: 16 },
  row:              { flexDirection: "row", alignItems: "center", backgroundColor: "#fffef5", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#012a6215" },
  thumb:            { width: 64, height: 64, borderRadius: 8, marginRight: 12 },
  thumbPlaceholder: { backgroundColor: "#012a6215" },
  info:             { flex: 1 },
  name:             { color: "#012a62", fontWeight: "600", fontSize: 15, marginBottom: 2 },
  meta:             { color: "#012a6280", fontSize: 13, marginBottom: 2 },
  price:            { color: "#012a62", fontWeight: "700", fontSize: 15 },
  qty:              { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn:           { backgroundColor: "#012a62", borderRadius: 6, width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  qtyBtnText:       { color: "#fdde59", fontSize: 18, fontWeight: "700", lineHeight: 22 },
  qtyNum:           { color: "#012a62", fontWeight: "700", fontSize: 15, minWidth: 20, textAlign: "center" },
  footer:           { paddingTop: 8 },
  totalRow:         { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  totalLabel:       { color: "#012a62", fontSize: 17, fontWeight: "600" },
  totalAmt:         { color: "#012a62", fontSize: 17, fontWeight: "700" },
  checkoutBtn:      { backgroundColor: "#012a62", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  checkoutBtnText:  { color: "#fdde59", fontWeight: "700", fontSize: 16 },
});
