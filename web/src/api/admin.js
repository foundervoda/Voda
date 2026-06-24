import { api } from "./client";

export const fetchAdminOverview = () =>
  api.get("/admin/overview").then((r) => r.data.data);

export const fetchAdminOrders = (params = {}) =>
  api.get("/admin/orders", { params }).then((r) => r.data.data.orders);

export const fetchAdminCustomers = () =>
  api.get("/admin/customers").then((r) => r.data.data.customers);

export const fetchAdminStores = () =>
  api.get("/admin/stores").then((r) => r.data.data.stores);

export const fetchAdminTbProducts = () =>
  api.get("/admin/tb/products").then((r) => r.data.data.products);

export const updateAdminProductTb = (id, tbEligible) =>
  api.post(`/admin/tb/product/${id}`, { tbEligible }).then((r) => r.data.data.product);

export const updateAdminStoreTb = (id, tbOverride) =>
  api.post(`/admin/tb/store/${id}`, { tbOverride }).then((r) => r.data.data.store);

export const bulkUpdateCategoryTb = (category, eligible) =>
  api.post(`/admin/tb/bulk-category`, { category, eligible }).then((r) => r.data.data);

export const approveManagerTbRequest = (id) =>
  api.post(`/admin/tb/request/${id}/approve`).then((r) => r.data.data.product);

export const denyManagerTbRequest = (id) =>
  api.post(`/admin/tb/request/${id}/deny`).then((r) => r.data.data.product);

export const fetchAdminInventory = () =>
  api.get("/admin/inventory").then((r) => r.data.data.inventory);

export const fetchAdminRunners = () =>
  api.get("/admin/runners").then((r) => r.data.data.runners);

export const fetchAdminRiders = () =>
  api.get("/admin/riders").then((r) => r.data.data.riders);

export const fetchRunnerOrders = (id) =>
  api.get(`/admin/runners/${id}/orders`).then((r) => r.data.data.orders);

export const fetchRiderOrders = (id) =>
  api.get(`/admin/riders/${id}/orders`).then((r) => r.data.data.orders);

export const createPartner = (data) =>
  api.post("/admin/partners", data).then((r) => r.data.data.user);
