import { useEffect, useRef, useState } from "react";
import {
  fetchAdminOverview,
  fetchAdminOrders,
  fetchAdminCustomers,
  fetchAdminStores,
  fetchAdminTbProducts,
  updateAdminProductTb,
  updateAdminStoreTb,
  bulkUpdateCategoryTb,
  approveManagerTbRequest,
  denyManagerTbRequest,
  fetchAdminReturnAnalytics,
} from "../api/admin";

// ── shared helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL = {
  PENDING:          "Pending",
  RUNNER_ASSIGNED:  "Runner Assigned",
  COLLECTED:        "Collected",
  HANDED_TO_RIDER:  "With Rider",
  OUT_FOR_DELIVERY: "Out for Delivery",
  ARRIVED:          "Arrived",
  DELIVERED:        "Delivered",
  RETURNING:        "Returning",
  RETURNED:         "Returned",
  REFUNDED:         "Refunded",
};

const STATUS_STYLE = {
  PENDING:          "bg-yellow text-navy",
  RUNNER_ASSIGNED:  "bg-blue-100 text-blue-800",
  COLLECTED:        "bg-indigo-100 text-indigo-800",
  HANDED_TO_RIDER:  "bg-indigo-100 text-indigo-800",
  OUT_FOR_DELIVERY: "bg-indigo-200 text-indigo-900",
  ARRIVED:          "bg-emerald-100 text-emerald-800",
  DELIVERED:        "bg-emerald-200 text-emerald-900",
  RETURNING:        "bg-gray-100 text-gray-500",
  RETURNED:         "bg-gray-100 text-gray-500",
  REFUNDED:         "bg-gray-100 text-gray-500",
};

function StatusBadge({ status }) {
  const cls = STATUS_STYLE[status] ?? "bg-gray-100 text-gray-500";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef(null);

  function handleMouseEnter(e) {
    const rect = ref.current?.getBoundingClientRect();
    setPos({ x: rect ? rect.left : e.clientX, y: rect ? rect.bottom + 6 : e.clientY + 12 });
    setVisible(true);
  }

  return (
    <span
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
      className="cursor-default"
    >
      {children}
      {visible && (
        <div
          className="fixed z-50 bg-navy text-cream text-xs rounded-lg px-3 py-2 shadow-lg max-w-xs whitespace-pre-wrap pointer-events-none"
          style={{ top: pos.y, left: pos.x }}
        >
          {text}
        </div>
      )}
    </span>
  );
}

// ── AdminOrderModal ───────────────────────────────────────────────────────────

function AdminOrderModal({ order, onClose }) {
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const store = order.items[0]?.product?.store;
  const total = order.items.reduce(
    (sum, i) => sum + (Number(i.product?.price ?? 0) * i.quantity), 0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-navy px-6 py-4 rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-cream font-mono font-bold tracking-widest">
              #{order.id.slice(-6).toUpperCase()}
            </span>
            <StatusBadge status={order.status} />
          </div>
          <button onClick={onClose} className="text-cream/50 hover:text-cream text-xl leading-none transition">✕</button>
        </div>

        <div className="p-6 space-y-6">

          {/* Store */}
          {store && (
            <Section label="Store">
              <Row label="Name">{store.name}</Row>
            </Section>
          )}

          {/* Items */}
          <Section label="Items">
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 bg-cream rounded-xl px-4 py-3">
                  <div className="flex-1">
                    <p className="font-semibold text-navy text-sm">{item.product?.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[item.variant?.size, item.variant?.color].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-navy font-bold text-sm">×{item.quantity}</p>
                    {item.product?.price && (
                      <p className="text-xs text-gray-400">
                        ₹{(Number(item.product.price) * item.quantity).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {total > 0 && (
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                <span className="text-sm font-semibold text-navy">Total</span>
                <span className="text-sm font-bold text-navy">₹{total.toLocaleString()}</span>
              </div>
            )}
          </Section>

          {/* Delivery */}
          <Section label="Delivery">
            <Row label="Address">{order.deliveryAddr}</Row>
            <Row label="ETA">{order.etaMinutes} min</Row>
            <Row label="Placed">{fmt(order.createdAt)}</Row>
          </Section>

          {/* Customer */}
          {order.customer && (
            <Section label="Customer">
              {order.customer.email && <Row label="Email">{order.customer.email}</Row>}
              {order.customer.phone && <Row label="Phone">{order.customer.phone}</Row>}
            </Section>
          )}

          {/* Runner */}
          {order.runner && (
            <Section label="Runner">
              <Row label="Email">{order.runner.email}</Row>
            </Section>
          )}

        </div>
      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{label}</h3>
      <div className="bg-cream rounded-xl px-4 py-3 space-y-2 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 w-20 shrink-0">{label}</span>
      <span className="text-navy font-medium">{children}</span>
    </div>
  );
}

function fmt(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function Spinner() {
  return <div className="text-center py-20 text-gray-400 text-sm">Loading…</div>;
}

function Th({ children, className = "" }) {
  return (
    <th className={`text-left px-4 py-3 text-xs font-semibold text-navy/50 uppercase tracking-wide ${className}`}>
      {children}
    </th>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

const OVERVIEW_STATUSES = [
  "PENDING", "RUNNER_ASSIGNED", "COLLECTED", "HANDED_TO_RIDER",
  "OUT_FOR_DELIVERY", "ARRIVED", "DELIVERED", "RETURNING", "RETURNED", "REFUNDED",
];

function Overview() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchAdminOverview().then(setData).catch(console.error);
  }, []);

  if (!data) return <Spinner />;

  const { totalOrders, totalCustomers, totalStores, statusCounts } = data;
  const stats = [
    { label: "Total Orders",    value: totalOrders },
    { label: "Pending",         value: statusCounts.PENDING ?? 0 },
    { label: "Total Customers", value: totalCustomers },
    { label: "Stores",          value: totalStores },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-navy/40 uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-3xl font-bold text-navy">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <p className="px-5 py-3 text-xs font-semibold text-navy/50 uppercase tracking-wide border-b border-gray-50">
          Order Status Breakdown
        </p>
        <table className="w-full text-sm">
          <tbody>
            {OVERVIEW_STATUSES.filter((s) => (statusCounts[s] ?? 0) > 0).map((s) => (
              <tr key={s} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3"><StatusBadge status={s} /></td>
                <td className="px-4 py-3 text-right font-bold text-navy pr-5">{statusCounts[s]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Orders ────────────────────────────────────────────────────────────────────

export function Orders({ defaultCustomerId, defaultStoreId, onSelectCustomer }) {
  const [orders, setOrders]         = useState(null);
  const [stores, setStores]         = useState([]);
  const [storeId, setStoreId]       = useState(defaultStoreId ?? "");
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [status, setStatus]         = useState("");
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState(null);

  useEffect(() => {
    fetchAdminStores().then(setStores).catch(console.error);
  }, []);

  useEffect(() => {
    setOrders(null);
    fetchAdminOrders({ storeId: storeId || undefined, customerId: customerId || undefined, status: status || undefined })
      .then(setOrders)
      .catch(console.error);
  }, [storeId, customerId, status]);

  const visible = (orders ?? []).filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.customer?.email?.toLowerCase().includes(q) ||
      o.deliveryAddr?.toLowerCase().includes(q) ||
      o.id.includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:border-navy"
        >
          <option value="">All Stores</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:border-navy"
        >
          <option value="">All Statuses</option>
          {OVERVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search email / address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-navy placeholder:text-gray-300 focus:outline-none focus:border-navy flex-1 min-w-[200px]"
        />

        {(storeId || customerId || status || search) && (
          <button
            onClick={() => { setStoreId(""); setCustomerId(""); setStatus(""); setSearch(""); }}
            className="px-3 py-2 text-sm text-gray-400 hover:text-navy border border-gray-200 rounded-xl transition"
          >
            Clear
          </button>
        )}

        <span className="ml-auto self-center text-sm text-gray-400">
          {orders ? `${visible.length} order${visible.length !== 1 ? "s" : ""}` : ""}
        </span>
      </div>

      {/* Table */}
      {selected && <AdminOrderModal order={selected} onClose={() => setSelected(null)} />}

      {!orders ? <Spinner /> : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream border-b border-gray-100">
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Store</Th>
                <Th>Items</Th>
                <Th>Address</Th>
                <Th>Date</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No orders match these filters</td></tr>
              )}
              {visible.map((o) => {
                const store = o.items[0]?.product?.store;
                const summary = o.items.map((i) => `${i.product?.name} ×${i.quantity}`).join(", ");
                const fullItems = o.items
                  .map((i) => `${i.product?.name} ×${i.quantity} (${[i.variant?.size, i.variant?.color].filter(Boolean).join(", ")})`)
                  .join("\n");
                return (
                  <tr
                    key={o.id}
                    className="border-b border-gray-50 hover:bg-cream/40 cursor-pointer transition"
                    onClick={() => setSelected(o)}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-navy">#{o.id.slice(-6).toUpperCase()}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="text-navy hover:underline text-left"
                        onClick={() => onSelectCustomer?.(o.customer?.id)}
                      >
                        {o.customer?.email}
                      </button>
                      <div className="text-xs text-gray-400">{o.customer?.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{store?.name ?? "—"}</td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <Tooltip text={fullItems}>
                        <span className="text-gray-600 text-sm block truncate">{summary}</span>
                      </Tooltip>
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate">{o.deliveryAddr}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt(o.createdAt)}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Customers ─────────────────────────────────────────────────────────────────

function Customers({ onFilterOrders }) {
  const [customers, setCustomers] = useState(null);
  const [search, setSearch]       = useState("");

  useEffect(() => {
    fetchAdminCustomers().then(setCustomers).catch(console.error);
  }, []);

  const visible = (customers ?? []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.email.toLowerCase().includes(q) || c.phone.includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Search by email or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-navy placeholder:text-gray-300 focus:outline-none focus:border-navy flex-1 max-w-sm"
        />
        <span className="text-sm text-gray-400 ml-auto">
          {customers ? `${visible.length} customer${visible.length !== 1 ? "s" : ""}` : ""}
        </span>
      </div>

      {!customers ? <Spinner /> : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream border-b border-gray-100">
              <tr>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Orders</Th>
                <Th>Joined</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No customers found</td></tr>
              )}
              {visible.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-cream/40 transition">
                  <td className="px-4 py-3 font-medium text-navy">{c.email}</td>
                  <td className="px-4 py-3 text-gray-500">{c.phone}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-navy">{c._count.customerOrders}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{fmt(c.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onFilterOrders(c.id)}
                      className="text-xs font-semibold text-navy hover:underline"
                    >
                      View orders →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Stores ────────────────────────────────────────────────────────────────────

function Stores({ onFilterOrders }) {
  const [stores, setStores]       = useState(null);

  useEffect(() => {
    fetchAdminStores().then(setStores).catch(console.error);
  }, []);

  return (
    <div>
      {!stores ? <Spinner /> : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream border-b border-gray-100">
              <tr>
                <Th>Store Name</Th>
                <Th>Location</Th>
                <Th>Products</Th>
                <Th>Orders</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {stores.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No stores yet</td></tr>
              )}
              {stores.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-cream/40 transition last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.location}</td>
                  <td className="px-4 py-3 font-bold text-navy">{s._count.products}</td>
                  <td className="px-4 py-3 font-bold text-navy">{s.orderCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onFilterOrders(s.id)}
                        className="text-xs font-semibold text-navy hover:underline"
                      >
                        View orders →
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── T&B shared ────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none
        ${checked ? "bg-emerald-500" : "bg-gray-200"}
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform
        ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}


function TryBuyToggles() {
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [bulkConfirm, setBulkConfirm] = useState(null);
  const [productConfirm, setProductConfirm] = useState(null); // { id, name, currentVal, newVal }
  const [storeConfirm, setStoreConfirm] = useState(null);    // { id, name, oldVal, newVal }

  const categories = ["Sneakers", "Apparel", "Boots"];

  const OVERRIDE_LABEL = { true: "Force Eligible", false: "Force Ineligible", null: "Category Default" };
  const STORE_LABEL    = { NONE: "No Override", ENABLED: "Force Eligible", DISABLED: "Force Ineligible" };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodList, storeList] = await Promise.all([
        fetchAdminTbProducts(),
        fetchAdminStores()
      ]);
      setProducts(prodList);
      setStores(storeList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleProductToggle = (id, currentVal, productName) => {
    let newVal;
    if (currentVal === true) newVal = false;
    else if (currentVal === false) newVal = null;
    else newVal = true;
    setProductConfirm({ id, name: productName, currentVal, newVal });
  };

  const confirmProductToggle = async () => {
    const { id, newVal } = productConfirm;
    setProductConfirm(null);
    try {
      const updated = await updateAdminProductTb(id, newVal);
      setProducts(prev => prev.map(p => p.id === id ? { ...p, tbEligible: updated.tbEligible } : p));
    } catch (e) {
      console.error(e);
    }
  };

  const handleStoreOverrideChange = (id, val, storeName, oldVal) => {
    setStoreConfirm({ id, name: storeName, oldVal, newVal: val });
  };

  const confirmStoreOverride = async () => {
    const { id, newVal } = storeConfirm;
    setStoreConfirm(null);
    try {
      const updated = await updateAdminStoreTb(id, newVal);
      setStores(prev => prev.map(s => s.id === id ? { ...s, tbOverride: updated.tbOverride } : s));
      const freshProducts = await fetchAdminTbProducts();
      setProducts(freshProducts);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkCategory = (category, eligible) => {
    setBulkConfirm({ category, eligible });
  };

  const confirmBulkCategory = async () => {
    const { category, eligible } = bulkConfirm;
    setBulkConfirm(null);
    try {
      await bulkUpdateCategoryTb(category, eligible);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleApprove = async (id) => {
    try {
      await approveManagerTbRequest(id);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeny = async (id) => {
    try {
      await denyManagerTbRequest(id);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const resolveEligibility = (product, storeOverride) => {
    if (storeOverride === "ENABLED") return { eligible: true, reason: "Store Override: Enabled" };
    if (storeOverride === "DISABLED") return { eligible: false, reason: "Store Override: Disabled" };
    if (product.tbEligible !== null && product.tbEligible !== undefined) {
      return { eligible: product.tbEligible, reason: `Product Override: ${product.tbEligible ? "Yes" : "No"}` };
    }
    const isCategoryDefault = product.category === "Sneakers" || product.category === "Apparel";
    return { eligible: isCategoryDefault, reason: `Category Default: ${isCategoryDefault ? "Yes" : "No"}` };
  };

  const pendingRequests = products.filter(p => p.tbRequest && p.tbRequest !== "NONE");

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.store?.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) return <Spinner />;

  return (
    <div className="space-y-8 text-navy">
      {/* Change Requests Section */}
      <div className="bg-yellow/10 border border-yellow/40 rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-navy text-lg flex items-center gap-2">
          {pendingRequests.length > 0 && (
            <span className="animate-pulse block w-2.5 h-2.5 rounded-full bg-yellow" />
          )}
          Store Manager Change Requests
          {pendingRequests.length > 0 && (
            <span className="ml-1 bg-yellow text-navy text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingRequests.length}
            </span>
          )}
        </h3>
        {pendingRequests.length === 0 ? (
          <p className="text-sm text-gray-400">No pending requests from store managers.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRequests.map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-yellow/25 p-4 flex flex-col justify-between shadow-sm">
                <div>
                  <p className="font-bold text-navy">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.category} • {p.store?.name}</p>
                  <div className="mt-2 inline-block bg-yellow text-navy text-xs px-2.5 py-1 rounded-full font-semibold">
                    Requesting: {p.tbRequest === "PENDING_ELIGIBLE" ? "Eligible" : "Ineligible"}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleApprove(p.id)}
                    className="flex-1 bg-navy text-yellow text-xs font-bold py-2 rounded-lg hover:brightness-110 transition"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDeny(p.id)}
                    className="flex-1 border border-gray-200 text-gray-500 text-xs font-bold py-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Store Overrides Grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-navy text-lg">Store-Level Overrides</h3>
        <p className="text-xs text-gray-400">Setting a store override takes highest precedence and forces all items in that store to be eligible/ineligible.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stores.map(s => (
            <div key={s.id} className="bg-cream rounded-xl p-4 flex flex-col justify-between border border-gray-100 shadow-sm">
              <div>
                <p className="font-bold text-navy">{s.name}</p>
                <p className="text-xs text-gray-400">{s.location}</p>
              </div>
              <div className="mt-4">
                <select
                  value={s.tbOverride || "NONE"}
                  onChange={(e) => handleStoreOverrideChange(s.id, e.target.value, s.name, s.tbOverride || "NONE")}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-navy focus:outline-none focus:border-navy"
                >
                  <option value="NONE">No Override (NONE)</option>
                  <option value="ENABLED">Force Eligible (ENABLED)</option>
                  <option value="DISABLED">Force Ineligible (DISABLED)</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Default Bulk Toggle */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-navy text-lg">Bulk Category Toggles</h3>
        <p className="text-xs text-gray-400">Perform a bulk action to set the Try & Buy flag on all products in a category.</p>
        <div className="flex flex-wrap gap-4">
          {categories.map(cat => (
            <div key={cat} className="flex-1 min-w-[200px] border border-gray-100 rounded-xl p-4 bg-cream flex flex-col justify-between">
              <p className="font-bold text-navy mb-3">{cat}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkCategory(cat, true)}
                  className="flex-1 bg-navy text-yellow text-xs font-bold py-2 rounded-lg hover:brightness-110 transition"
                >
                  Enable All
                </button>
                <button
                  onClick={() => handleBulkCategory(cat, false)}
                  className="flex-1 border border-gray-200 text-gray-500 text-xs font-bold py-2 rounded-lg hover:bg-gray-50 transition"
                >
                  Disable All
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product toggle confirm modal */}
      {productConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-7 max-w-sm w-full mx-4 border border-gray-100">
            <h3 className="font-bold text-navy text-lg mb-2">Change Product Override?</h3>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-semibold text-navy">{productConfirm.name}</span>
            </p>
            <p className="text-sm text-gray-400 mb-6">
              <span className="line-through">{OVERRIDE_LABEL[String(productConfirm.currentVal)]}</span>
              {" → "}
              <span className="font-semibold text-navy">{OVERRIDE_LABEL[String(productConfirm.newVal)]}</span>
            </p>
            <div className="flex gap-3">
              <button onClick={confirmProductToggle} className="flex-1 bg-navy text-yellow font-bold text-sm py-2.5 rounded-xl hover:brightness-110 transition">Confirm</button>
              <button onClick={() => setProductConfirm(null)} className="flex-1 border border-gray-200 text-gray-500 font-bold text-sm py-2.5 rounded-xl hover:bg-gray-50 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Store override confirm modal */}
      {storeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-7 max-w-sm w-full mx-4 border border-gray-100">
            <h3 className="font-bold text-navy text-lg mb-2">Change Store Override?</h3>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-semibold text-navy">{storeConfirm.name}</span>
            </p>
            <p className="text-sm text-gray-400 mb-6">
              <span className="line-through">{STORE_LABEL[storeConfirm.oldVal]}</span>
              {" → "}
              <span className="font-semibold text-navy">{STORE_LABEL[storeConfirm.newVal]}</span>
            </p>
            <div className="flex gap-3">
              <button onClick={confirmStoreOverride} className="flex-1 bg-navy text-yellow font-bold text-sm py-2.5 rounded-xl hover:brightness-110 transition">Confirm</button>
              <button onClick={() => setStoreConfirm(null)} className="flex-1 border border-gray-200 text-gray-500 font-bold text-sm py-2.5 rounded-xl hover:bg-gray-50 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk confirm modal */}
      {bulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-7 max-w-sm w-full mx-4 border border-gray-100">
            <h3 className="font-bold text-navy text-lg mb-2">Bulk Toggle</h3>
            <p className="text-sm text-gray-500 mb-6">
              Set all{" "}
              <span className="font-semibold text-navy">{bulkConfirm.category}</span>{" "}
              products to{" "}
              <span className={`font-semibold ${bulkConfirm.eligible ? "text-emerald-600" : "text-red-600"}`}>
                {bulkConfirm.eligible ? "Eligible" : "Ineligible"}
              </span>
              ? This will override individual product flags.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmBulkCategory}
                className="flex-1 bg-navy text-yellow font-bold text-sm py-2.5 rounded-xl hover:brightness-110 transition"
              >
                Confirm
              </button>
              <button
                onClick={() => setBulkConfirm(null)}
                className="flex-1 border border-gray-200 text-gray-500 font-bold text-sm py-2.5 rounded-xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products Toggle Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="font-bold text-navy text-lg">Product-Level Toggles</h3>
          <div className="flex gap-2 min-w-[300px] flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-navy placeholder:text-gray-300 focus:outline-none"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-2.5 py-2 text-sm text-navy focus:outline-none"
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <table className="w-full text-sm mt-4">
          <thead className="bg-cream border-b border-gray-100">
            <tr>
              <Th>Product</Th>
              <Th>Category</Th>
              <Th>Store</Th>
              <Th>Computed Status</Th>
              <Th>Toggle Product Override</Th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(p => {
              const res = resolveEligibility(p, p.store?.tbOverride);
              return (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-cream/40 transition">
                  <td className="px-4 py-3 font-semibold text-navy">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.category}</td>
                  <td className="px-4 py-3 text-gray-500">{p.store?.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${res.eligible ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                      {res.eligible ? "Eligible" : "Ineligible"}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-2 block italic">({res.reason})</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleProductToggle(p.id, p.tbEligible, p.name)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                        p.tbEligible === true
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : p.tbEligible === false
                          ? "bg-red-500 text-white border-red-500"
                          : "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                    >
                      {p.tbEligible === true ? "Force Eligible" : p.tbEligible === false ? "Force Ineligible" : "Category Default"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Return Analytics ──────────────────────────────────────────────────────────

function ReturnAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchAdminReturnAnalytics().then(setAnalytics).catch(console.error);
  }, []);

  if (!analytics) return <Spinner />;

  const visible = analytics.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.reason.toLowerCase().includes(q) ||
      a.productName.toLowerCase().includes(q) ||
      a.storeName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 text-navy">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Search by reason, product, or store..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-navy placeholder:text-gray-300 focus:outline-none focus:border-navy flex-1 max-w-sm"
        />
        <span className="text-sm text-gray-400 ml-auto">
          {visible.length} patterns surfaced
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream border-b border-gray-100">
            <tr>
              <Th>Return Reason</Th>
              <Th>Product Name</Th>
              <Th>Store Name</Th>
              <Th className="text-right">Return Count</Th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-12 text-gray-400">
                  No return analytics found
                </td>
              </tr>
            )}
            {visible.map((a, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-cream/40 transition">
                <td className="px-4 py-3 font-semibold text-navy">{a.reason}</td>
                <td className="px-4 py-3 text-gray-600">{a.productName}</td>
                <td className="px-4 py-3 text-gray-500">{a.storeName}</td>
                <td className="px-4 py-3 text-right font-bold text-navy pr-6">{a.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── AdminPanel shell ──────────────────────────────────────────────────────────

const TABS = [
  { key: "overview",   label: "Overview" },
  { key: "orders",     label: "Orders" },
  { key: "customers",  label: "Customers" },
  { key: "stores",     label: "Stores" },
  { key: "trybuy",     label: "Try & Buy" },
  { key: "analytics",  label: "Return Analytics" },
];

export default function AdminPanel() {
  const [tab, setTab] = useState("overview");
  // Cross-tab drill-down: Customers → Orders by customer, Stores → Orders by store
  const [ordersFilter, setOrdersFilter] = useState({});

  function drillToOrders(filter) {
    setOrdersFilter(filter);
    setTab("orders");
  }

  return (
    <div className="p-5 max-w-6xl mx-auto">
      {/* Tab bar */}
      <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm mb-6 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition
              ${tab === t.key ? "bg-navy text-cream" : "text-gray-500 hover:text-navy hover:bg-gray-50"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview"  && <Overview />}
      {tab === "orders"    && (
        <Orders
          key={JSON.stringify(ordersFilter)}
          defaultCustomerId={ordersFilter.customerId}
          defaultStoreId={ordersFilter.storeId}
          onSelectCustomer={(id) => drillToOrders({ customerId: id })}
        />
      )}
      {tab === "customers" && (
        <Customers onFilterOrders={(customerId) => drillToOrders({ customerId })} />
      )}
      {tab === "stores"    && (
        <Stores onFilterOrders={(storeId) => drillToOrders({ storeId })} />
      )}
      {tab === "trybuy"    && <TryBuyToggles />}
      {tab === "analytics" && <ReturnAnalytics />}
    </div>
  );
}
