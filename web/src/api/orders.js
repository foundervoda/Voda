import { api } from "./client";

export async function fetchStoreOrders(storeId) {
  const { data } = await api.get("/orders", { params: { storeId } });
  return data.data.orders;
}

export async function fetchStoreOrdersExport(storeId, from, to) {
  const params = { storeId };
  if (from) params.from = from;
  if (to)   params.to   = to;
  const { data } = await api.get("/orders", { params });
  return data.data.orders;
}

export async function updateOrderStatus(orderId, status) {
  const { data } = await api.put(`/orders/${orderId}/status`, { status });
  return data.data.order;
}
