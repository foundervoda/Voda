import { api } from "./client";

export async function fetchStoreProducts(storeId) {
  const { data } = await api.get("/products", { params: { storeId } });
  return data.data.products;
}

export async function bulkUpdateStock(updates) {
  const { data } = await api.put("/products/stock", { updates });
  return data.data;
}

export async function requestProductTbChange(productId, tbRequest) {
  const { data } = await api.post(`/products/${productId}/request-tb`, { tbRequest });
  return data.data;
}

export async function updateProduct(id, updates) {
  const { data } = await api.patch(`/store/products/${id}`, updates);
  return data.data.product;
}

export async function toggleProductActive(id, active) {
  const { data } = await api.patch(`/store/products/${id}/active`, { active });
  return data.data.product;
}

export async function fetchStoreActivity() {
  const { data } = await api.get("/store/activity");
  return data.data;
}
