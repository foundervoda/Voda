import { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "../api/socket";
import { fetchStoreOrders, fetchStoreOrdersExport } from "../api/orders";
import { fetchStoreTbProducts, submitStoreTbRequest } from "../api/store";
import OrderCard from "../components/OrderCard";
import OrderModal from "../components/OrderModal";

const FILTERS = [
  { label: "All",         key: "all" },
  { label: "New",         key: "PENDING" },
  { label: "In Progress", key: "active" },
  { label: "Done",        key: "done" },
];

const STATUS_META = {
  PENDING:          { label: "New Order",        bg: "bg-yellow",      text: "text-navy" },
  RUNNER_ASSIGNED:  { label: "Runner Assigned",  bg: "bg-blue-100",    text: "text-blue-800" },
  COLLECTED:        { label: "Collected",         bg: "bg-indigo-100",  text: "text-indigo-800" },
  HANDED_TO_RIDER:  { label: "With Rider",        bg: "bg-indigo-100",  text: "text-indigo-800" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery",  bg: "bg-indigo-200",  text: "text-indigo-900" },
  ARRIVED:              { label: "Arrived",        bg: "bg-emerald-100", text: "text-emerald-800" },
  TRY_BUY_IN_PROGRESS: { label: "Try & Buy",     bg: "bg-yellow",      text: "text-navy" },
  DELIVERED:            { label: "Delivered",     bg: "bg-emerald-200", text: "text-emerald-900" },
  RETURNING:        { label: "Returning",         bg: "bg-gray-100",    text: "text-gray-500" },
  RETURNED:         { label: "Returned",          bg: "bg-gray-100",    text: "text-gray-500" },
  REFUNDED:         { label: "Refunded",          bg: "bg-gray-100",    text: "text-gray-500" },
};

function smartTime(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const d = new Date(dateStr);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(!sameYear && { year: "numeric" }) });
}

const ACTIVE_STATUSES = new Set(["RUNNER_ASSIGNED", "COLLECTED", "HANDED_TO_RIDER", "OUT_FOR_DELIVERY", "ARRIVED", "TRY_BUY_IN_PROGRESS"]);
const DONE_STATUSES   = new Set(["DELIVERED", "RETURNING", "RETURNED", "REFUNDED"]);

function applyFilter(orders, filter) {
  if (filter === "all")    return orders;
  if (filter === "active") return orders.filter((o) => ACTIVE_STATUSES.has(o.status));
  if (filter === "done")   return orders.filter((o) => DONE_STATUSES.has(o.status));
  return orders.filter((o) => o.status === filter);
}

// Compact row for list view
function OrderRow({ order, onClick }) {
  const meta     = STATUS_META[order.status] ?? { label: order.status, bg: "bg-gray-100", text: "text-gray-500" };
  const shortId  = order.id.slice(-6).toUpperCase();
  const isNew    = order.status === "PENDING";
  const summary  = order.items.map((i) => `${i.product?.name} ×${i.quantity}`).join(", ");

  return (
    <tr
      onClick={onClick}
      className={`border-b border-gray-50 hover:bg-cream/60 cursor-pointer transition
        ${isNew ? "bg-yellow/5" : ""}`}
    >
      <td className="px-5 py-3">
        <span className="font-mono font-bold text-navy text-sm">#{shortId}</span>
        {isNew && <span className="ml-2 text-[10px] font-bold text-yellow bg-navy rounded px-1.5 py-0.5 animate-pulse">NEW</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{summary}</td>
      <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[140px]">{order.deliveryAddr}</td>
      <td className="px-4 py-3 text-sm text-gray-400">{smartTime(order.createdAt)}</td>
      <td className="px-4 py-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
          {meta.label}
        </span>
      </td>
    </tr>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────

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
  const s = new Date(); s.setHours(0, 0, 0, 0);
  const e = new Date(); e.setHours(23, 59, 59, 999);
  return { from: s.toISOString().slice(0, 10), to: e.toISOString().slice(0, 10) };
}
function last7Range() {
  const e = new Date(); e.setHours(23, 59, 59, 999);
  const s = new Date(); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0);
  return { from: s.toISOString().slice(0, 10), to: e.toISOString().slice(0, 10) };
}
function lastMonthRange() {
  const now = new Date();
  const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { from: s.toISOString().slice(0, 10), to: e.toISOString().slice(0, 10) };
}

function ExportModal({ storeId, onClose }) {
  const [from, setFrom]       = useState("");
  const [to, setTo]           = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function doExport() {
    setLoading(true);
    setError(null);
    try {
      const fromISO = from ? new Date(from).toISOString() : undefined;
      const toISO   = to   ? new Date(to + "T23:59:59").toISOString() : undefined;
      const orders  = await fetchStoreOrdersExport(storeId, fromISO, toISO);

      const header = ["Order ID", "Date", "Customer Email", "Customer Phone", "Items", "Address", "Status"];
      const rows = orders.map((o) => [
        o.id.slice(-6).toUpperCase(),
        new Date(o.createdAt).toLocaleString("en-GB"),
        o.customer?.email ?? "",
        o.customer?.phone ?? "",
        o.items.map((i) => `${i.product?.name} x${i.quantity}`).join("; "),
        o.deliveryAddr,
        STATUS_META[o.status]?.label ?? o.status,
      ]);

      const label = from && to ? `${from}_to_${to}` : from ? `from_${from}` : to ? `to_${to}` : "all";
      downloadCSV([header, ...rows], `orders_${label}.csv`);
      onClose();
    } catch {
      setError("Failed to fetch orders. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const PRESETS = [
    { label: "Today",       fn: () => { const r = todayRange();      setFrom(r.from); setTo(r.to); } },
    { label: "Last 7 days", fn: () => { const r = last7Range();      setFrom(r.from); setTo(r.to); } },
    { label: "Last month",  fn: () => { const r = lastMonthRange();  setFrom(r.from); setTo(r.to); } },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="bg-navy px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <p className="text-cream font-bold">Export Orders</p>
          <button onClick={onClose} className="text-cream/50 hover:text-cream text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-5">
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
            {!from && !to && (
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

// Icons
const GridIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
    <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
  </svg>
);
const ListIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <rect x="1" y="2" width="14" height="2.5" rx="1"/><rect x="1" y="6.75" width="14" height="2.5" rx="1"/>
    <rect x="1" y="11.5" width="14" height="2.5" rx="1"/>
  </svg>
);

// ── Try & Buy product view for store managers ─────────────────────────────────

const REQUEST_LABEL = {
  PENDING_ELIGIBLE:   "Pending: Request Eligible",
  PENDING_INELIGIBLE: "Pending: Request Ineligible",
};

export function StoreTbTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(null); // productId being submitted

  const load = useCallback(() => {
    setLoading(true);
    fetchStoreTbProducts()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const request = async (productId, requestType) => {
    setActing(productId);
    try {
      const updated = await submitStoreTbRequest(productId, requestType);
      setData((prev) => ({
        ...prev,
        products: prev.products.map((p) => p.id === productId ? { ...p, tbRequest: updated.tbRequest } : p),
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setActing(null);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (!data)   return <div className="text-center py-20 text-red-500">Could not load products.</div>;

  const storeOverrideActive = data.store?.tbOverride !== "NONE";

  return (
    <div className="space-y-5">
      {storeOverrideActive && (
        <div className="bg-yellow/20 border border-yellow/40 rounded-xl px-5 py-3 text-sm text-navy font-medium">
          Admin has set a store-wide override:{" "}
          <span className="font-bold">
            {data.store.tbOverride === "ENABLED" ? "All products forced Eligible" : "All products forced Ineligible"}
          </span>
          . Individual product flags are ignored while this is active.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-cream border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Product</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Category</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">T&B Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Request</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.products.map((p) => {
              const isPending = p.tbRequest && p.tbRequest !== "NONE";
              const isActing  = acting === p.id;
              return (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-cream/40 transition">
                  <td className="px-5 py-3 font-semibold text-navy">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.category}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
                      ${p.effective ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                      {p.effective ? "Eligible" : "Not Eligible"}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-2">({p.reason})</span>
                  </td>
                  <td className="px-4 py-3">
                    {isPending ? (
                      <span className="text-xs font-semibold text-yellow-700 bg-yellow/30 px-2.5 py-1 rounded-full">
                        {REQUEST_LABEL[p.tbRequest] ?? p.tbRequest}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isPending ? (
                      <button
                        onClick={() => request(p.id, null)}
                        disabled={isActing}
                        className="text-xs font-semibold text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition disabled:opacity-40"
                      >
                        {isActing ? "…" : "Cancel Request"}
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => request(p.id, "PENDING_ELIGIBLE")}
                          disabled={isActing || p.effective}
                          className="text-xs font-bold bg-navy text-yellow px-3 py-1.5 rounded-lg hover:brightness-110 transition disabled:opacity-30"
                        >
                          {isActing ? "…" : "Request Eligible"}
                        </button>
                        <button
                          onClick={() => request(p.id, "PENDING_INELIGIBLE")}
                          disabled={isActing || !p.effective}
                          className="text-xs font-bold border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition disabled:opacity-30"
                        >
                          {isActing ? "…" : "Request Ineligible"}
                        </button>
                      </div>
                    )}
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

// ── OrdersBoard ───────────────────────────────────────────────────────────────

export default function OrdersBoard({ storeId }) {
  const [orders, setOrders]          = useState([]);
  const [filter, setFilter]          = useState("all");
  const [loading, setLoading]        = useState(true);
  const [error, setError]            = useState(null);
  const [selectedOrder, setSelected] = useState(null);
  const [view, setView]              = useState("grid"); // "grid" | "list"
  const [showExport, setShowExport]  = useState(false);
  const audioRef                     = useRef(null);

  useEffect(() => {
    fetchStoreOrders(storeId)
      .then(setOrders)
      .catch(() => setError("Could not load orders — is the backend running?"))
      .finally(() => setLoading(false));
  }, [storeId]);

  useEffect(() => {
    const joinRoom = () => socket.emit("join_store_room", storeId);
    if (socket.connected) joinRoom();
    else socket.once("connect", joinRoom);

    const handleNewOrder = (payload) => {
      const order = payload.order ?? payload;
      setOrders((prev) => prev.find((o) => o.id === order.id) ? prev : [order, ...prev]);
      audioRef.current?.play().catch(() => {});
    };

    const handleOrderUpdate = (payload) => {
      const order = payload.order ?? payload;
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...order } : o)));
    };

    socket.on("new_order",    handleNewOrder);
    socket.on("order_update", handleOrderUpdate);

    return () => {
      socket.off("connect",      joinRoom);
      socket.off("new_order",    handleNewOrder);
      socket.off("order_update", handleOrderUpdate);
    };
  }, [storeId]);

  const visible          = applyFilter(orders, filter);
  const pendingCount     = orders.filter((o) => o.status === "PENDING").length;

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <audio ref={audioRef} src="/chime.mp3" preload="none" />
      {showExport && <ExportModal storeId={storeId} onClose={() => setShowExport(false)} />}

      <div>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-5 gap-3">
            <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`relative px-3 py-1.5 text-sm font-medium rounded-lg transition
                    ${filter === f.key ? "bg-navy text-cream" : "text-gray-500 hover:text-navy hover:bg-gray-50"}`}
                >
                  {f.label}
                  {f.key === "PENDING" && pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-yellow text-navy text-[10px] font-bold
                                     w-4 h-4 rounded-full flex items-center justify-center leading-none">
                      {pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">{visible.length} order{visible.length !== 1 ? "s" : ""}</span>
              <button
                onClick={() => setShowExport(true)}
                className="px-3 py-1.5 text-sm font-semibold bg-yellow text-navy rounded-lg hover:brightness-95 transition"
              >
                Export CSV
              </button>
              <div className="flex gap-0.5 bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
                <button onClick={() => setView("grid")} title="Card view"
                  className={`p-1.5 rounded-lg transition ${view === "grid" ? "bg-navy text-cream" : "text-gray-400 hover:text-navy"}`}>
                  <GridIcon />
                </button>
                <button onClick={() => setView("list")} title="List view"
                  className={`p-1.5 rounded-lg transition ${view === "list" ? "bg-navy text-cream" : "text-gray-400 hover:text-navy"}`}>
                  <ListIcon />
                </button>
              </div>
            </div>
          </div>

          {loading && <div className="text-center py-20 text-gray-400">Loading orders…</div>}
          {error   && <div className="text-center py-20 text-red-500 font-medium">{error}</div>}

          {!loading && !error && visible.length === 0 && (
            <div className="text-center py-24 text-gray-400">
              <p className="text-4xl mb-3">🛍</p>
              <p className="font-medium">
                {filter === "all" ? "No orders yet — waiting for your first customer" : "No orders in this category"}
              </p>
            </div>
          )}

          {!loading && !error && visible.length > 0 && view === "grid" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((order) => (
                <OrderCard key={order.id} order={order} onClick={() => setSelected(order)} />
              ))}
            </div>
          )}

          {!loading && !error && visible.length > 0 && view === "list" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Order</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Items</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Deliver To</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Time</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-navy/60 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((order) => (
                    <OrderRow key={order.id} order={order} onClick={() => setSelected(order)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedOrder && (
            <OrderModal order={selectedOrder} onClose={() => setSelected(null)} />
          )}
        </div>
    </div>
  );
}
