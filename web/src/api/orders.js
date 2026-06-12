import { api } from "./client";

export async function fetchStoreOrders(storeId) {
  const { data } = await api.get("/orders", { params: { storeId } });
  return data.data.orders;
}

export async function updateOrderStatus(orderId, status) {
  const { data } = await api.put(`/orders/${orderId}/status`, { status });
  return data.data.order;
}
