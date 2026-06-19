import { api } from "./client";

export const fetchStoreTbProducts = () =>
  api.get("/store/products/tb").then((r) => r.data.data);

export const submitStoreTbRequest = (productId, requestType) =>
  api.post(`/store/products/${productId}/tb-request`, { requestType }).then((r) => r.data.data.product);
