import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  Dimensions,
  Platform,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { useSocket } from "../../api/SocketContext";
import { api } from "../../api/client";

const { width, height } = Dimensions.get("window");

const STORE_COORDS = { latitude: 12.9716, longitude: 77.5946 };
const CUSTOMER_COORDS = { latitude: 12.9810, longitude: 77.6030 };

const mapStyle = []; // Light theme default style

export default function TrackOrderScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const socket = useSocket();
  const mapRef = useRef(null);

  const [order, setOrder] = useState(route.params.order);
  const [riderCoords, setRiderCoords] = useState(STORE_COORDS);
  const [eta, setEta] = useState(order.etaMinutes || 30);

  // Auto-focus camera region on mount or when coordinates update
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.fitToCoordinates(
        [STORE_COORDS, CUSTOMER_COORDS, riderCoords],
        {
          edgePadding: { top: 120, right: 50, bottom: 220, left: 50 },
          animated: true,
        }
      );
    }
  }, [riderCoords]);

  // Listen to Socket.io for live updates
  useEffect(() => {
    if (!socket) return;

    socket.emit("join_order_room", order.id);

    const handleLocationUpdate = ({ lat, lng }) => {
      if (lat && lng) {
        setRiderCoords({ latitude: lat, longitude: lng });
        
        // Dynamically compute remaining ETA based on distance remaining
        const totalDist = Math.hypot(CUSTOMER_COORDS.latitude - STORE_COORDS.latitude, CUSTOMER_COORDS.longitude - STORE_COORDS.longitude);
        const remainingDist = Math.hypot(CUSTOMER_COORDS.latitude - lat, CUSTOMER_COORDS.longitude - lng);
        const initialEta = order.etaMinutes || 30;
        const currentEta = Math.max(Math.round(initialEta * (remainingDist / totalDist)), 1);
        setEta(currentEta);
      }
    };

    const handleOrderUpdate = ({ order: updatedOrder }) => {
      if (updatedOrder && updatedOrder.id === order.id) {
        setOrder(updatedOrder);
        if (updatedOrder.status === "TRY_BUY_IN_PROGRESS") {
          navigation.replace("TryBuy", { order: updatedOrder });
        }
      }
    };

    socket.on("rider_location_update", handleLocationUpdate);
    socket.on("order_update", handleOrderUpdate);

    return () => {
      socket.off("rider_location_update", handleLocationUpdate);
      socket.off("order_update", handleOrderUpdate);
    };
  }, [socket, order.id, order.etaMinutes]);

  const displayStatus = () => {
    switch (order.status) {
      case "OUT_FOR_DELIVERY":     return "Rider is on the way";
      case "ARRIVED":              return "Rider has arrived!";
      case "TRY_BUY_IN_PROGRESS": return "Try & Buy in progress";
      case "DELIVERED":            return "Order Delivered";
      default:                     return order.status.replace(/_/g, " ");
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

      {/* Map Element */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        customMapStyle={mapStyle}
        style={s.map}
        initialRegion={{
          latitude: (STORE_COORDS.latitude + CUSTOMER_COORDS.latitude) / 2,
          longitude: (STORE_COORDS.longitude + CUSTOMER_COORDS.longitude) / 2,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
      >
        {/* Store Marker */}
        <Marker coordinate={STORE_COORDS} title={order.items[0]?.product?.store?.name || "Zara Luxe Hub"} description="Mall Origin">
          <View style={[s.markerCircle, s.storeMarkerBg]}>
            <Ionicons name="business" size={16} color="#ffffff" />
          </View>
        </Marker>

        {/* Customer Home Marker */}
        <Marker coordinate={CUSTOMER_COORDS} title="Your Location" description={order.deliveryAddr}>
          <View style={[s.markerCircle, s.customerMarkerBg]}>
            <Ionicons name="home" size={16} color="#012a62" />
          </View>
        </Marker>

        {/* Live Rider Marker */}
        <Marker coordinate={riderCoords} title="Your Rider" description="Delivering your Voda order">
          <View style={[s.markerCircle, s.riderMarkerBg]}>
            <Ionicons name="bicycle" size={18} color="#000000" />
          </View>
        </Marker>
      </MapView>

      {/* Floating Header */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable
          style={({ pressed }) => [s.backBtn, pressed && s.backBtnPressed]}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={22} color="#012a62" />
        </Pressable>
        <Text style={s.headerTitle}>Live Tracking</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Floating Bottom Card */}
      <View style={[s.bottomCard, { paddingBottom: Math.max(insets.bottom, 20) + 10 }]}>
        <View style={s.cardHeader}>
          <View style={s.statusContainer}>
            <View style={s.pulseDot} />
            <Text style={s.statusText}>{displayStatus()}</Text>
          </View>
          <Text style={s.etaText}>
            {order.status === "ARRIVED" ? "OTP handback" : `${eta} mins ETA`}
          </Text>
        </View>

        <View style={s.divider} />

        <View style={s.riderInfoSection}>
          <View style={s.avatarContainer}>
            <Ionicons name="person" size={24} color="#012a62" />
          </View>
          <View style={s.riderTextWrap}>
            <Text style={s.riderName}>Voda Agent</Text>
            <Text style={s.riderSub}>Delivering #{order.id.slice(0, 8).toUpperCase()}</Text>
          </View>
          {order.status === "ARRIVED" && order.deliveryOtp && (
            <Pressable
              style={s.otpBadge}
              onPress={() =>
                Alert.alert(
                  "Handover OTP",
                  `${order.deliveryOtp.split("").join("  ")}\n\nShow this to your delivery agent.`,
                  [{ text: "OK" }]
                )
              }
            >
              <Text style={s.otpLabel}>OTP</Text>
              <Text style={s.otpVal}>{order.deliveryOtp}</Text>
            </Pressable>
          )}
        </View>

        <View style={s.addressBlock}>
          <Ionicons name="location-sharp" size={16} color="#012a62" style={{ marginRight: 6 }} />
          <Text style={s.addressText} numberOfLines={1}>
            {order.deliveryAddr}
          </Text>
        </View>

        {order.items?.length > 0 && (
          <>
            <View style={s.divider} />
            <Text style={s.itemsLabel}>Order Items</Text>
            <ScrollView style={s.itemsScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {order.items.map((item, idx) => (
                <View key={idx} style={s.itemRow}>
                  <Text style={s.itemName} numberOfLines={1}>{item.product?.name ?? "Item"}</Text>
                  <Text style={s.itemQty}>×{item.quantity}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  map: {
    width: width,
    height: height,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
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
  markerCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  storeMarkerBg: {
    backgroundColor: "#012a62",
  },
  customerMarkerBg: {
    backgroundColor: "#fdde59",
  },
  riderMarkerBg: {
    backgroundColor: "#fdde59",
    borderColor: "#012a62",
  },
  bottomCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(1, 42, 98, 0.05)",
    ...Platform.select({
      ios: {
        shadowColor: "#012a62",
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16a34a",
    marginRight: 8,
  },
  statusText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#012a62",
    textTransform: "capitalize",
  },
  etaText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#16a34a",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(1, 42, 98, 0.06)",
    marginVertical: 12,
  },
  riderInfoSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(1, 42, 98, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  riderTextWrap: {
    flex: 1,
  },
  riderName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#012a62",
  },
  riderSub: {
    fontSize: 12,
    color: "rgba(1, 42, 98, 0.5)",
    marginTop: 2,
    fontWeight: "600",
  },
  otpBadge: {
    backgroundColor: "#fdde59",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  otpLabel: {
    fontSize: 9,
    color: "#012a62",
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  otpVal: {
    fontSize: 20,
    color: "#012a62",
    fontWeight: "900",
    letterSpacing: 4,
  },
  addressBlock: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fdf9ea",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addressText: {
    fontSize: 13,
    color: "#012a62",
    fontWeight: "600",
    flex: 1,
  },
  itemsLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(1, 42, 98, 0.5)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  itemsScroll: {
    maxHeight: 90,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(1, 42, 98, 0.04)",
  },
  itemName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#012a62",
    flex: 1,
    marginRight: 12,
  },
  itemQty: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(1, 42, 98, 0.5)",
  },
});
