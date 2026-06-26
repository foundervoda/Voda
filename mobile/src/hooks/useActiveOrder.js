import { useState, useEffect, useCallback } from "react";
import { useSocket } from "../api/SocketContext";
import { useAuthStore } from "../store/useAuthStore";
import { useOrderStore } from "../store/useOrderStore";
import { api } from "../api/client";
import { navigationRef } from "../navigation/navigationRef";

const ACTIVE_STATUSES = new Set([
  "PENDING",
  "RUNNER_ASSIGNED",
  "COLLECTED",
  "HANDED_TO_RIDER",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
  "TRY_BUY_IN_PROGRESS",
]);

const DONE_STATUSES = new Set(["DELIVERED", "RETURNING", "RETURNED", "REFUNDED"]);

export function useActiveOrder() {
  const [activeOrder, setActiveOrder] = useState(null);
  const socket = useSocket();
  const { user } = useAuthStore();
  // Immediate fallback: the order set by placeOrder() in the store
  const storeActiveOrder = useOrderStore((s) => s.activeOrder);

  const fetchActive = useCallback(async () => {
    if (!user || user.role !== "CUSTOMER") return;
    try {
      const res = await api.get("/orders");
      const orders = res.data.data.orders ?? [];
      const active = orders
        .filter((o) => ACTIVE_STATUSES.has(o.status))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] ?? null;
      setActiveOrder(active);
    } catch {
      // silent
    }
  }, [user]);

  // Initial fetch
  useEffect(() => { fetchActive(); }, [fetchActive]);

  // Refetch whenever the user navigates to a new screen (catches post-order placement)
  useEffect(() => {
    if (!navigationRef.isReady()) return;
    const unsub = navigationRef.addListener("state", fetchActive);
    return () => unsub();
  }, [fetchActive]);

  // Socket-driven updates
  useEffect(() => {
    if (!socket) return;
    const handler = (payload) => {
      const order = payload.order ?? payload;
      setActiveOrder((prev) => {
        if (DONE_STATUSES.has(order.status)) {
          return prev?.id === order.id ? null : prev;
        }
        if (ACTIVE_STATUSES.has(order.status)) {
          if (prev?.id === order.id) return { ...prev, ...order };
          if (!prev || new Date(order.createdAt) > new Date(prev.createdAt)) return order;
        }
        return prev;
      });
    };
    socket.on("order_update", handler);
    socket.on("new_order", handler);
    return () => {
      socket.off("order_update", handler);
      socket.off("new_order", handler);
    };
  }, [socket]);

  // Immediate: if placeOrder() just set an order in the store and we haven't
  // received the socket event yet, use the store value as a fallback
  if (!activeOrder && storeActiveOrder && ACTIVE_STATUSES.has(storeActiveOrder.status)) {
    return storeActiveOrder;
  }

  return activeOrder;
}
