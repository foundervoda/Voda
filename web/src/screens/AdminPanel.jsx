import { useEffect, useRef, useState } from "react";
import {
  fetchAdminOverview,
  fetchAdminOrders,
  fetchAdminCustomers,
  fetchAdminStores,
} from "../api/admin";
import {
  fetchTnbRequests, resolveTnbRequest,
  fetchTnbProducts, setProductTnb,
  fetchTnbCategories, setCategoryTnb,
  fetchTnbStoreOverrides, setStoreTnbOverride,
} from "../api/tnb";

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
                        KES {(Number(item.product.price) * item.quantity).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {total > 0 && (
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                <span className="text-sm font-semibold text-navy">Total</span>
                <span className="text-sm font-bold text-navy">KES {total.toLocaleString()}</span>
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

// ── CSV export helpers ────────────────────────────────────────────────────────

function escapeCSV(v) {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function downloadCSV(rows, filename) {
  const csv = rows.map((r) => r.map(escapeCSV).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function todayRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

function lastNDaysRange(n) {
  const end   = new Date(); end.setHours(23, 59, 59, 999);
  const start = new Date(); start.setDate(start.getDate() - n); start.setHours(0, 0, 0, 0);
  return { from: start.toISOString(), to: end.toISOString() };
}

function lastMonthRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

// ── ExportModal ───────────────────────────────────────────────────────────────

function ExportModal({ store, onClose }) {
  const [from, setFrom]       = useState("");
  const [to, setTo]           = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function applyPreset(range) {
    const f = new Date(range.from);
    const t = new Date(range.to);
    setFrom(f.toISOString().slice(0, 10));
    setTo(t.toISOString().slice(0, 10));
  }

  async function doExport() {
    setLoading(true);
    setError(null);
    try {
      const params = { storeId: store.id };
      if (from) params.from = new Date(from).toISOString();
      if (to)   params.to   = new Date(to + "T23:59:59").toISOString();

      const orders = await fetchAdminOrders(params);

      const header = ["Order ID", "Date", "Customer Email", "Customer Phone", "Items", "Address", "Status", "Runner"];
      const rows = orders.map((o) => [
        o.id.slice(-6).toUpperCase(),
        new Date(o.createdAt).toLocaleString("en-GB"),
        o.customer?.email ?? "",
        o.customer?.phone ?? "",
        o.items.map((i) => `${i.product?.name} x${i.quantity}`).join("; "),
        o.deliveryAddr,
        STATUS_LABEL[o.status] ?? o.status,
        o.runner?.email ?? "",
      ]);

      const label = from && to ? `${from}_to_${to}` : from ? `from_${from}` : to ? `to_${to}` : "all";
      downloadCSV([header, ...rows], `${store.name.replace(/\s+/g, "_")}_orders_${label}.csv`);
      onClose();
    } catch (e) {
      setError("Failed to fetch orders. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const PRESETS = [
    { label: "Today",       fn: () => applyPreset(todayRange()) },
    { label: "Last 7 days", fn: () => applyPreset(lastNDaysRange(7)) },
    { label: "Last month",  fn: () => applyPreset(lastMonthRange()) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="bg-navy px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <p className="text-cream font-bold">Export Orders</p>
            <p className="text-cream/50 text-xs mt-0.5">{store.name}</p>
          </div>
          <button onClick={onClose} className="text-cream/50 hover:text-cream text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Presets */}
          <div>
            <p className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-2">Quick select</p>
            <div className="flex gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={p.fn}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-navy hover:bg-cream hover:border-navy transition"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom range */}
          <div>
            <p className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-2">Custom range</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:border-navy"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:border-navy"
              />
            </div>
            {(!from && !to) && (
              <p className="text-xs text-gray-400 mt-1.5">Leave blank to export all orders</p>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={doExport}
            disabled={loading}
            className="w-full bg-navy text-yellow font-bold py-3 rounded-xl text-sm hover:brightness-110 transition disabled:opacity-50"
          >
            {loading ? "Fetching orders…" : "Download CSV"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stores ────────────────────────────────────────────────────────────────────

function Stores({ onFilterOrders }) {
  const [stores, setStores]       = useState(null);
  const [exportStore, setExport]  = useState(null);

  useEffect(() => {
    fetchAdminStores().then(setStores).catch(console.error);
  }, []);

  return (
    <div>
      {exportStore && <ExportModal store={exportStore} onClose={() => setExport(null)} />}

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
                      <button
                        onClick={() => setExport(s)}
                        className="text-xs font-semibold text-navy bg-yellow px-2.5 py-1 rounded-lg hover:brightness-95 transition"
                      >
                        Export CSV
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

// ── T&B Products ──────────────────────────────────────────────────────────────

function TnbProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    fetchTnbProducts().then(setProducts).finally(() => setLoading(false));
  }, []);

  async function handleToggle(product) {
    setToggling(product.id);
    try {
      await setProductTnb(product.id, !product.tryAndBuyEligible);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, tryAndBuyEligible: !p.tryAndBuyEligible } : p
        )
      );
    } finally {
      setToggling(null);
    }
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      p.store.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by product, category or store…"
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm text-navy
                     placeholder:text-gray-300 focus:outline-none focus:border-navy transition"
        />
        <span className="text-xs text-gray-400 shrink-0">{filtered.length} products</span>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Store</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Product Flag</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Store Override</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Effective</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Toggle</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const effective = p.store.tnbOverride !== null && p.store.tnbOverride !== undefined
                  ? p.store.tnbOverride
                  : p.tryAndBuyEligible;
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-cream/40 transition">
                    <td className="px-5 py-3 font-medium text-navy">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.category}</td>
                    <td className="px-4 py-3 text-gray-500">{p.store.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        p.tryAndBuyEligible ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
                      }`}>
                        {p.tryAndBuyEligible ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.store.tnbOverride == null ? (
                        <span className="text-xs text-gray-300">—</span>
                      ) : (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          p.store.tnbOverride ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-600"
                        }`}>
                          {p.store.tnbOverride ? "Force on" : "Block"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        effective ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
                      }`}>
                        {effective ? "Eligible" : "Not eligible"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle
                        checked={p.tryAndBuyEligible}
                        onChange={() => handleToggle(p)}
                        disabled={toggling !== null}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-12 text-gray-400">No products found</p>}
        </div>
      )}
    </div>
  );
}

// ── T&B Categories ────────────────────────────────────────────────────────────

function TnbCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [toggling, setToggling]     = useState(null);

  useEffect(() => {
    fetchTnbCategories().then(setCategories).finally(() => setLoading(false));
  }, []);

  async function handleToggle(cat) {
    const newEligible = cat.defaultEligible !== true;
    setToggling(cat.category);
    try {
      await setCategoryTnb(cat.category, newEligible);
      setCategories((prev) =>
        prev.map((c) =>
          c.category === cat.category
            ? { ...c, defaultEligible: newEligible, eligibleCount: newEligible ? c.total : 0 }
            : c
        )
      );
    } finally {
      setToggling(null);
    }
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-4">
        Toggling a category sets the default and bulk-updates all products in that category.
      </p>
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Category</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Products</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">T&amp;B Eligible</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Default</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Bulk Toggle</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.category} className="border-b border-gray-50 hover:bg-cream/40 transition">
                  <td className="px-5 py-3 font-medium text-navy">{cat.category}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{cat.total}</td>
                  <td className="px-4 py-3 text-center text-gray-500">
                    {cat.eligibleCount} / {cat.total}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {cat.defaultEligible === null ? (
                      <span className="text-xs text-gray-300">Not set</span>
                    ) : (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        cat.defaultEligible ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
                      }`}>
                        {cat.defaultEligible ? "All eligible" : "None"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Toggle
                      checked={cat.defaultEligible === true}
                      onChange={() => handleToggle(cat)}
                      disabled={toggling !== null}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {categories.length === 0 && <p className="text-center py-12 text-gray-400">No categories found</p>}
        </div>
      )}
    </div>
  );
}

// ── T&B Stores ────────────────────────────────────────────────────────────────

const OVERRIDE_OPTS = [
  {
    value: false,
    label: "Block all",
    desc: "All products in this store will be T&B ineligible, regardless of their individual flags.",
    activeCls: "bg-navy text-cream border-navy",
    inactiveCls: "border-gray-200 text-navy/30 hover:border-navy/40 hover:text-navy",
  },
  {
    value: null,
    label: "No override",
    desc: "Remove the store override. Each product's own T&B flag will apply.",
    activeCls: "bg-cream text-navy border-navy",
    inactiveCls: "border-gray-200 text-navy/30 hover:border-navy/40 hover:text-navy",
  },
  {
    value: true,
    label: "Force all",
    desc: "All products in this store will be T&B eligible, regardless of their individual flags.",
    activeCls: "bg-yellow text-navy border-yellow",
    inactiveCls: "border-gray-200 text-navy/30 hover:border-yellow hover:text-navy",
  },
];

function TnbStores() {
  const [stores, setStores]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [setting, setSetting] = useState(null);
  const [confirm, setConfirm] = useState(null); // { store, opt }

  useEffect(() => {
    fetchTnbStoreOverrides().then(setStores).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!confirm) return;
    const handler = (e) => e.key === "Escape" && setConfirm(null);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [confirm]);

  async function handleConfirm() {
    const { store, opt } = confirm;
    setConfirm(null);
    setSetting(store.id);
    try {
      const updated = await setStoreTnbOverride(store.id, opt.value);
      setStores((prev) =>
        prev.map((s) => (s.id === store.id ? { ...s, tnbOverride: updated.tnbOverride } : s))
      );
    } finally {
      setSetting(null);
    }
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-4">
        Store overrides take highest precedence — they supersede both product flags and category defaults.
      </p>
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Store</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Location</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Products</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Eligible</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Override</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.id} className="border-b border-gray-50 hover:bg-cream/40 transition">
                  <td className="px-5 py-3 font-medium text-navy">{store.name}</td>
                  <td className="px-4 py-3 text-gray-500">{store.location}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{store.totalProducts}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{store.eligibleProducts}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {OVERRIDE_OPTS.map((opt) => {
                        const active = store.tnbOverride === opt.value;
                        return (
                          <button
                            key={String(opt.value)}
                            onClick={() => !active && setConfirm({ store, opt })}
                            disabled={setting === store.id || active}
                            className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition
                              ${active ? opt.activeCls + " cursor-default" : opt.inactiveCls}
                              ${setting === store.id ? "opacity-40 cursor-not-allowed" : ""}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stores.length === 0 && <p className="text-center py-12 text-gray-400">No stores found</p>}
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <div className="relative bg-cream rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
            <h2 className="text-base font-bold text-navy mb-1">
              Set "{confirm.opt.label}" for {confirm.store.name}?
            </h2>
            <p className="text-sm text-navy/50 mb-6">{confirm.opt.desc}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-2.5 text-sm font-semibold text-navy border border-navy/20 rounded-xl hover:bg-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 text-sm font-semibold text-navy bg-yellow hover:brightness-95 rounded-xl transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── T&B Requests ─────────────────────────────────────────────────────────────

function TnbRequests() {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null); // request id being actioned

  async function load(status) {
    setLoading(true);
    try {
      const data = await fetchTnbRequests(status || undefined);
      setRequests(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(statusFilter); }, [statusFilter]);

  async function handleResolve(id, decision) {
    setResolving(id);
    try {
      const updated = await resolveTnbRequest(id, decision);
      setRequests((prev) =>
        statusFilter === "PENDING"
          ? prev.filter((r) => r.id !== id)
          : prev.map((r) => (r.id === id ? { ...r, status: updated.status } : r))
      );
    } finally {
      setResolving(null);
    }
  }

  const pending  = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-navy">Try &amp; Buy Requests</h2>
          {pending > 0 && (
            <span className="text-xs font-semibold bg-yellow text-navy px-2 py-0.5 rounded-full">
              {pending} pending
            </span>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-navy
                     focus:outline-none focus:border-navy bg-white transition"
        >
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="">All</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No requests</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Store</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Current</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Requested</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Note</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Submitted</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Status / Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-cream/40 transition">
                  <td className="px-5 py-3 font-medium text-navy">{r.product.name}</td>
                  <td className="px-4 py-3 text-gray-500">{r.product.store?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r.product.tryAndBuyEligible
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-400"
                    }`}>
                      {r.product.tryAndBuyEligible ? "Eligible" : "Not eligible"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r.requestedEligible
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-600"
                    }`}>
                      {r.requestedEligible ? "Enable" : "Remove"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px]">
                    <span title={r.note ?? ""} className="block truncate">{r.note || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.status === "PENDING" ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleResolve(r.id, "APPROVED")}
                          disabled={resolving === r.id}
                          className="text-xs font-semibold bg-emerald-500 text-white px-3 py-1 rounded-lg
                                     hover:bg-emerald-600 transition disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleResolve(r.id, "REJECTED")}
                          disabled={resolving === r.id}
                          className="text-xs font-semibold border border-gray-200 text-gray-500 px-3 py-1 rounded-lg
                                     hover:bg-gray-50 transition disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        r.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-400"
                      }`}>
                        {r.status === "APPROVED" ? "Approved" : "Rejected"}
                      </span>
                    )}
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

// ── T&B Management wrapper ────────────────────────────────────────────────────

const TNB_SUB_TABS = [
  { key: "products",   label: "Products" },
  { key: "categories", label: "Categories" },
  { key: "stores",     label: "Stores" },
  { key: "requests",   label: "Requests" },
];

function TnbManagement() {
  const [subTab, setSubTab] = useState("products");

  return (
    <div>
      <div className="flex gap-0 border-b border-gray-100 mb-6">
        {TNB_SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition
              ${subTab === t.key
                ? "border-navy text-navy"
                : "border-transparent text-gray-400 hover:text-navy"
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {subTab === "products"   && <TnbProducts />}
      {subTab === "categories" && <TnbCategories />}
      {subTab === "stores"     && <TnbStores />}
      {subTab === "requests"   && <TnbRequests />}
    </div>
  );
}

// ── AdminPanel shell ──────────────────────────────────────────────────────────

const TABS = [
  { key: "overview",   label: "Overview" },
  { key: "orders",     label: "Orders" },
  { key: "customers",  label: "Customers" },
  { key: "stores",     label: "Stores" },
  { key: "tnb",        label: "T&B Requests" },
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
      {tab === "tnb"       && <TnbManagement />}
    </div>
  );
}
