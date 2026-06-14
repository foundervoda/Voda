import { useState } from "react";
import { updateOrderStatus } from "../api/orders";

const STATUS_META = {
  PENDING:           { label: "New Order",         bg: "bg-yellow",       text: "text-navy" },
  RUNNER_ASSIGNED:   { label: "Runner Assigned",   bg: "bg-blue-100",     text: "text-blue-800" },
  COLLECTED:         { label: "Collected",          bg: "bg-indigo-100",   text: "text-indigo-800" },
  HANDED_TO_RIDER:   { label: "With Rider",         bg: "bg-indigo-100",   text: "text-indigo-800" },
  OUT_FOR_DELIVERY:  { label: "Out for Delivery",   bg: "bg-indigo-200",   text: "text-indigo-900" },
  ARRIVED:           { label: "Arrived",            bg: "bg-emerald-100",  text: "text-emerald-800" },
  DELIVERED:         { label: "Delivered",          bg: "bg-emerald-200",  text: "text-emerald-900" },
  RETURNING:         { label: "Returning",          bg: "bg-gray-100",     text: "text-gray-600" },
  RETURNED:          { label: "Returned",           bg: "bg-gray-100",     text: "text-gray-600" },
  REFUNDED:          { label: "Refunded",           bg: "bg-gray-100",     text: "text-gray-600" },
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

export default function OrderCard({ order, onUpdated, onClick }) {
  const [loading, setLoading] = useState(false);
  const meta = STATUS_META[order.status] ?? { label: order.status, bg: "bg-gray-100", text: "text-gray-600" };
  const shortId = order.id.slice(-6).toUpperCase();
  const isNew = order.status === "PENDING";

  async function handleConfirm(e) {
    e.stopPropagation();
    setLoading(true);
    try {
      const updated = await updateOrderStatus(order.id, "COLLECTED");
      onUpdated?.(updated);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-2xl shadow-sm border overflow-hidden cursor-pointer
        hover:shadow-md hover:-translate-y-0.5 transition-all duration-150
        ${isNew ? "border-yellow ring-2 ring-yellow/60" : "border-gray-100"}
      `}
    >
      {/* Card header */}
      <div className="bg-navy px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-cream font-mono font-bold text-sm tracking-widest">#{shortId}</span>
          {isNew && (
            <span className="animate-pulse text-yellow text-xs font-semibold uppercase tracking-wide">New</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-cream/60 text-xs">{smartTime(order.createdAt)}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
            {meta.label}
          </span>
        </div>
      </div>

      {/* Items list */}
      <div className="px-4 pt-3 pb-1 space-y-1.5">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-2 text-sm">
            <div className="flex-1">
              <span className="font-medium text-navy">{item.product.name}</span>
              <span className="text-gray-400 ml-1 text-xs">
                {[item.variant.size, item.variant.color].filter(Boolean).join(" · ")}
              </span>
            </div>
            <span className="text-navy font-semibold shrink-0">×{item.quantity}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 mt-1 border-t border-gray-50 flex items-end justify-between gap-4">
        <div className="space-y-0.5 text-xs text-gray-500 min-w-0">
          <p className="truncate"><span className="font-medium text-gray-700">To: </span>{order.deliveryAddr}</p>
          <p><span className="font-medium text-gray-700">ETA: </span>{order.etaMinutes} min</p>
          {order.customer && (
            <p className="truncate">
              <span className="font-medium text-gray-700">Customer: </span>
              {order.customer.phone || order.customer.email}
            </p>
          )}
        </div>
        {isNew && (
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="shrink-0 bg-yellow text-navy text-xs font-bold px-3 py-1.5 rounded-lg
                       hover:brightness-95 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "…" : "Mark as Collected"}
          </button>
        )}
      </div>
    </div>
  );
}
