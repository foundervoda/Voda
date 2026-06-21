import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveOrder } from "../hooks/useActiveOrder";
import { navigationRef } from "../navigation/navigationRef";

const STATUS_TEXT = {
  PENDING:              "Finding a runner for your order…",
  RUNNER_ASSIGNED:      "Runner heading to the store",
  COLLECTED:            "Runner has your order",
  HANDED_TO_RIDER:      "Delivery agent en route",
  OUT_FOR_DELIVERY:     "On the way to you",
  ARRIVED:              "Your order has arrived!",
  TRY_BUY_IN_PROGRESS: "Try & Buy active — tap to decide",
};

const ARRIVED_STATUS = "ARRIVED";
const TAB_BAR_HEIGHT = 60;
const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;
const BANNER_HEIGHT = 58; // approximate banner height including handle
const BANNER_PEEK = 52;  // visible strip when minimized

export default function ActiveOrderBanner() {
  const order = useActiveOrder();
  const insets = useSafeAreaInsets();

  // Vertical slide-in / slide-out animation (shows/hides the banner)
  const slideAnim = useRef(new Animated.Value(80)).current;
  // Horizontal minimize animation
  const slideX = useRef(new Animated.Value(0)).current;
  // User drag offset (Y axis — up to move banner higher on screen)
  const dragY = useRef(new Animated.Value(0)).current;
  // Composed vertical transform: slideAnim + dragY
  const totalY = useRef(Animated.add(slideAnim, dragY)).current;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isOnTrackScreen, setIsOnTrackScreen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [mounted, setMounted] = useState(false);
  const prevOrderId = useRef(null);

  // Persist drag offset between gesture sessions
  const dragYAccum = useRef(0);
  // Ref so PanResponder closure always has current insets
  const insetRef = useRef({ bottom: insets.bottom, top: insets.top });
  useEffect(() => {
    insetRef.current = { bottom: insets.bottom, top: insets.top };
  }, [insets]);

  const panResponder = useRef(
    PanResponder.create({
      // Don't steal taps — only claim when user clearly drags (>6px movement)
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dy) > 6 || Math.abs(dx) > 6,
      onPanResponderMove: (_, { dy }) => {
        // Manual setValue avoids the Animated.event / Fabric incompatibility
        dragY.setValue(dragYAccum.current + dy);
      },
      onPanResponderRelease: (_, { dy }) => {
        const rawVal = dragYAccum.current + dy;
        const bottomOff = insetRef.current.bottom + TAB_BAR_HEIGHT;
        const maxUp = -(SCREEN_H - bottomOff - BANNER_HEIGHT - insetRef.current.top - 16);
        const clamped = Math.max(maxUp, Math.min(0, rawVal));
        dragYAccum.current = clamped;
        if (clamped !== rawVal) {
          Animated.spring(dragY, {
            toValue: clamped,
            useNativeDriver: false,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
    })
  ).current;

  // Show banner only when a genuinely new order arrives; reset position
  useEffect(() => {
    if (order?.id && order.id !== prevOrderId.current) {
      prevOrderId.current = order.id;
      setMinimized(false);
      slideX.setValue(0);
      dragY.setValue(0);
      dragYAccum.current = 0;
      setMounted(true);
    }
  }, [order?.id]);

  useEffect(() => {
    const checkRoute = () => {
      const name = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : null;
      setIsOnTrackScreen(name === "TrackOrder" || name === "TryBuy");
    };
    checkRoute();
    const unsub = navigationRef.addListener("state", checkRoute);
    return () => unsub();
  }, []);

  const isVisible = mounted && !!order && !isOnTrackScreen;
  const isArrived = order?.status === ARRIVED_STATUS;

  // Vertical slide-in / slide-out
  useEffect(() => {
    if (!mounted) return;
    Animated.spring(slideAnim, {
      toValue: isVisible ? 0 : 80,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start(({ finished }) => {
      if (finished && !isVisible && !order) setMounted(false);
    });
  }, [isVisible, mounted]);

  // Horizontal minimize / restore
  const toggleMinimize = () => {
    const going = !minimized;
    setMinimized(going);
    Animated.spring(slideX, {
      toValue: going ? SCREEN_W - 24 - BANNER_PEEK : 0,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
    // Snap back to bottom when restoring
    if (!going) {
      dragYAccum.current = 0;
      Animated.spring(dragY, {
        toValue: 0,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }).start();
    }
  };

  useEffect(() => {
    if (!isArrived) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isArrived]);

  if (!mounted || !order || isOnTrackScreen) return null;

  const label = STATUS_TEXT[order.status] ?? order.status.replace(/_/g, " ");
  const bottomOffset = insets.bottom + TAB_BAR_HEIGHT;

  const isTnbActive = order?.status === "TRY_BUY_IN_PROGRESS";

  const handlePress = () => {
    if (!navigationRef.isReady()) return;
    if (minimized) {
      toggleMinimize();
      return;
    }
    if (isTnbActive) {
      navigationRef.navigate("TryBuy", { order });
    } else {
      navigationRef.navigate("TrackOrder", { order });
    }
  };

  return (
    <Animated.View
      style={[
        styles.banner,
        { bottom: bottomOffset, transform: [{ translateY: totalY }, { translateX: slideX }] },
        isArrived && styles.bannerArrived,
      ]}
      {...panResponder.panHandlers}
    >
      {/* Drag handle — visual cue that the banner is repositionable */}
      <View style={styles.dragHandle}>
        <View style={[styles.dragPill, isArrived && styles.dragPillArrived]} />
      </View>

      <View style={styles.inner}>
        {/* Minimize / restore arrow — LEFT side so it stays visible when banner slides right */}
        <Pressable style={styles.arrowBtn} onPress={toggleMinimize} hitSlop={8}>
          <Ionicons
            name={minimized ? "chevron-back" : "chevron-forward"}
            size={18}
            color={isArrived ? S : "rgba(255,255,255,0.75)"}
          />
        </Pressable>

        {/* Main track area — disabled when minimized so the off-screen area can't intercept taps */}
        <Pressable
          style={styles.trackArea}
          onPress={handlePress}
          android_ripple={{ color: "rgba(255,255,255,0.1)" }}
          disabled={minimized}
        >
          <Animated.View
            style={[styles.dot, isArrived && styles.dotArrived, { opacity: isArrived ? pulseAnim : 1 }]}
          />
          <Text style={[styles.label, isArrived && styles.labelArrived]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={[styles.cta, isArrived && styles.ctaArrived]}>
            {isTnbActive ? "Decide →" : "Track →"}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const S = "#012a62";
const Y = "#fdde59";

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 12,
    right: 12,
    borderRadius: 14,
    backgroundColor: S,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  bannerArrived: {
    backgroundColor: Y,
  },
  dragHandle: {
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 2,
  },
  dragPill: {
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  dragPillArrived: {
    backgroundColor: "rgba(1,42,98,0.2)",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
  },
  trackArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Y,
  },
  dotArrived: {
    backgroundColor: S,
  },
  label: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  labelArrived: {
    color: S,
  },
  cta: {
    fontSize: 12,
    fontWeight: "700",
    color: Y,
  },
  ctaArrived: {
    color: S,
  },
  arrowBtn: {
    width: BANNER_PEEK,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
});
