import { useEffect, useRef, useState } from "react";
import { socket } from "../api/socket";
import { fetchStoreOrders } from "../api/orders";
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
  ARRIVED:          { label: "Arrived",           bg: "bg-emerald-100", text: "text-emerald-800" },
  DELIVERED:        { label: "Delivered",         bg: "bg-emerald-200", text: "text-emerald-900" },
  RETURNING:        { label: "Returning",         bg: "bg-gray-100",    text: "text-gray-500" },
  RETURNED:         { label: "Returned",          bg: "bg-gray-100",    text: "text-gray-500" },
  REFUNDED:         { label: "Refunded",          bg: "bg-gray-100",    text: "text-gray-500" },
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const ACTIVE_STATUSES = new Set(["RUNNER_ASSIGNED", "COLLECTED", "HANDED_TO_RIDER", "OUT_FOR_DELIVERY", "ARRIVED"]);
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
      <td className="px-4 py-3 text-sm text-gray-400">{timeAgo(order.createdAt)}</td>
      <td className="px-4 py-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
          {meta.label}
        </span>
      </td>
    </tr>
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

export default function OrdersBoard({ storeId }) {
  const [orders, setOrders]          = useState([]);
  const [filter, setFilter]          = useState("all");
  const [loading, setLoading]        = useState(true);
  const [error, setError]            = useState(null);
  const [selectedOrder, setSelected] = useState(null);
  const [view, setView]              = useState("grid"); // "grid" | "list"
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

  const handleUpdated    = (updated) => setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
  const visible          = applyFilter(orders, filter);
  const pendingCount     = orders.filter((o) => o.status === "PENDING").length;

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <audio ref={audioRef} src="/chime.mp3" preload="none" />

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 gap-3">
        {/* Filter tabs */}
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

          {/* View toggle */}
          <div className="flex gap-0.5 bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setView("grid")}
              title="Card view"
              className={`p-1.5 rounded-lg transition ${view === "grid" ? "bg-navy text-cream" : "text-gray-400 hover:text-navy"}`}
            >
              <GridIcon />
            </button>
            <button
              onClick={() => setView("list")}
              title="List view"
              className={`p-1.5 rounded-lg transition ${view === "list" ? "bg-navy text-cream" : "text-gray-400 hover:text-navy"}`}
            >
              <ListIcon />
            </button>
          </div>
        </div>
      </div>

      {/* States */}
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

      {/* Card grid */}
      {!loading && !error && visible.length > 0 && view === "grid" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((order) => (
            <OrderCard key={order.id} order={order} onUpdated={handleUpdated} onClick={() => setSelected(order)} />
          ))}
        </div>
      )}

      {/* List view */}
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

      {/* Order detail modal */}
      {selectedOrder && (
        <OrderModal order={selectedOrder} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
