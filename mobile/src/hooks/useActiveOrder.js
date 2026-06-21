import { useState, useEffect, useCallback } from "react";
import { useSocket } from "../api/SocketContext";
import { useAuthStore } from "../store/useAuthStore";
import { api } from "../api/client";

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

  const fetchActive = useCallback(async () => {
    if (!user || user.role !== "CUSTOMER") return;
    try {
      const res = await api.get("/orders");
      const orders = res.data.data.orders ?? [];
      // Most recently created active order
      const active = orders
        .filter((o) => ACTIVE_STATUSES.has(o.status))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] ?? null;
      setActiveOrder(active);
    } catch {
      // silent
    }
  }, [user]);

  useEffect(() => { fetchActive(); }, [fetchActive]);

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
          // Replace if this order is newer than the current one
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

  return activeOrder;
}
