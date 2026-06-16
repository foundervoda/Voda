import { api } from "./client";

export async function requestTnbChange(productId, requestedEligible, note) {
  const { data } = await api.post("/tnb/requests", {
    productId,
    requestedEligible,
    ...(note ? { note } : {}),
  });
  return data.data.request;
}

export async function fetchTnbRequests(status) {
  const { data } = await api.get("/tnb/requests", { params: status ? { status } : {} });
  return data.data.requests;
}

export async function resolveTnbRequest(id, decision) {
  const { data } = await api.put(`/tnb/requests/${id}/resolve`, { decision });
  return data.data.request;
}

// ── Admin direct-control ──────────────────────────────────────────────────────

export async function fetchTnbProducts() {
  const { data } = await api.get("/tnb/products");
  return data.data.products;
}

export async function setProductTnb(id, eligible) {
  const { data } = await api.put(`/tnb/products/${id}`, { eligible });
  return data.data.product;
}

export async function fetchTnbCategories() {
  const { data } = await api.get("/tnb/categories");
  return data.data.categories;
}

export async function setCategoryTnb(name, eligible) {
  const { data } = await api.put(`/tnb/categories/${encodeURIComponent(name)}`, { eligible });
  return data.data;
}

export async function fetchTnbStoreOverrides() {
  const { data } = await api.get("/tnb/stores");
  return data.data.stores;
}

export async function setStoreTnbOverride(id, override) {
  const { data } = await api.put(`/tnb/stores/${id}`, { override });
  return data.data.store;
}
