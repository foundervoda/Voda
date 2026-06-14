import { api } from "./client";

export const fetchAdminOverview = () =>
  api.get("/admin/overview").then((r) => r.data.data);

export const fetchAdminOrders = (params = {}) =>
  api.get("/admin/orders", { params }).then((r) => r.data.data.orders);

export const fetchAdminCustomers = () =>
  api.get("/admin/customers").then((r) => r.data.data.customers);

export const fetchAdminStores = () =>
  api.get("/admin/stores").then((r) => r.data.data.stores);
