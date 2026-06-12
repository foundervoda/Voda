import { api } from "./client";

export async function fetchStoreProducts(storeId) {
  const { data } = await api.get("/products", { params: { storeId } });
  return data.data.products;
}

export async function bulkUpdateStock(updates) {
  const { data } = await api.put("/products/stock", { updates });
  return data.data;
}
