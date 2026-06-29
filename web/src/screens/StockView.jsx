import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchStoreProducts, bulkUpdateStock, requestProductTbChange,
  updateProduct, toggleProductActive, fetchStoreActivity,
} from "../api/products";
import { requestTnbChange } from "../api/tnb";

const CATEGORIES = ["Sneakers", "Apparel", "Boots", "Accessories", "Other"];

// ── Utils ──────────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

function resolveEffective(store, product) {
  if (store?.tbOverride === "ENABLED")  return true;
  if (store?.tbOverride === "DISABLED") return false;
  if (product.tbEligible != null)       return product.tbEligible;
  return product.category === "Sneakers" || product.category === "Apparel";
}

function productSku(product) {
  return product.id.slice(0, 8).toUpperCase();
}

function totalStock(product) {
  return product.variants.reduce((s, v) => s + v.stock, 0);
}

// ── Small shared UI ────────────────────────────────────────────────────────────

function MetricCard({ label, value, warn = false }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
      <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-black ${warn ? "text-red-500" : "text-navy"}`}>{value}</p>
    </div>
  );
}

function Sel({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:border-navy"
    >
      {children}
    </select>
  );
}

// ── Alerts Panel ───────────────────────────────────────────────────────────────

function AlertsPanel({ outOfStock, lowStock, threshold, onChangeThreshold }) {
  const [open, setOpen] = useState(true);
  if (outOfStock.length === 0 && lowStock.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-amber-100/50 transition text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-amber-700 font-black text-sm">⚠ Stock Alerts</span>
          {outOfStock.length > 0 && (
            <span className="bg-red-100 text-red-600 text-[11px] font-bold px-2 py-0.5 rounded-full">
              {outOfStock.length} out of stock
            </span>
          )}
          {lowStock.length > 0 && (
            <span className="bg-yellow text-navy text-[11px] font-bold px-2 py-0.5 rounded-full">
              {lowStock.length} low stock
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <label
            className="flex items-center gap-1.5 text-[11px] text-amber-700 font-semibold"
            onClick={(e) => e.stopPropagation()}
          >
            Threshold:
            <input
              type="number"
              value={threshold}
              onChange={(e) => onChangeThreshold(Math.max(1, Number(e.target.value) || 1))}
              className="w-12 border border-amber-300 rounded-lg px-1.5 py-0.5 text-xs bg-white text-navy focus:outline-none"
              min={1}
            />
          </label>
          <span className="text-amber-400 text-sm">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 grid grid-cols-2 gap-6">
          {outOfStock.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-red-600 uppercase tracking-widest mb-2">Out of Stock</p>
              <div className="space-y-1">
                {outOfStock.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-navy font-medium truncate mr-2">{p.name}</span>
                    <span className="text-[11px] text-red-400 font-semibold shrink-0">
                      {p.variants.filter((v) => v.stock === 0).map((v) => v.size).join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {lowStock.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest mb-2">
                Low Stock (≤ {threshold})
              </p>
              <div className="space-y-1">
                {lowStock.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-navy font-medium truncate mr-2">{p.name}</span>
                    <span className="text-[11px] text-amber-600 font-semibold shrink-0">
                      {p.variants
                        .filter((v) => v.stock > 0 && v.stock <= threshold)
                        .map((v) => `${v.size}(${v.stock})`)
                        .join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Product thumbnail ──────────────────────────────────────────────────────────

function Thumb({ product }) {
  const [imgErr, setImgErr] = useState(false);
  const src = !imgErr && product.images?.[0];
  const initials = product.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt={product.name}
        onError={() => setImgErr(true)}
        className="w-10 h-10 rounded-lg object-cover border border-gray-100 shrink-0"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-navy/10 flex items-center justify-center shrink-0">
      <span className="text-navy text-xs font-black">{initials}</span>
    </div>
  );
}

// ── Variant stock chips ────────────────────────────────────────────────────────

function VariantChips({ product, threshold, editingId, editValue, onStart, onChange, onCommit, onCancel }) {
  return (
    <div className="flex flex-wrap gap-1">
      {product.variants.map((v) => {
        if (editingId === v.id) {
          return (
            <div key={v.id} className="flex items-center gap-1">
              <span className="text-[11px] text-navy/50 font-medium">{v.size}·</span>
              <input
                autoFocus
                type="number"
                value={editValue}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => onCommit(v.id, editValue)}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  onCommit(v.id, editValue);
                  if (e.key === "Escape") onCancel();
                }}
                className="w-14 border border-navy rounded-lg px-1.5 py-0.5 text-xs font-bold text-navy focus:outline-none"
              />
            </div>
          );
        }
        const cls =
          v.stock === 0         ? "bg-red-100 text-red-700" :
          v.stock <= threshold  ? "bg-yellow text-navy" :
                                  "bg-emerald-100 text-emerald-700";
        return (
          <button
            key={v.id}
            onClick={() => onStart(v.id, v.stock)}
            title="Click to update stock"
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full cursor-pointer hover:ring-1 hover:ring-navy/30 transition ${cls}`}
          >
            {v.size}{v.color ? `/${v.color}` : ""} · {v.stock}
          </button>
        );
      })}
    </div>
  );
}

// ── Product row ────────────────────────────────────────────────────────────────

function ProductRow({ product, threshold, selected, onSelect, onEdit, onToggleActive, onTnbModal, editingVariantId, editValue, onStart, onChange, onCommit, onCancel }) {
  const effective     = resolveEffective(product.store, product);
  const hasPendingTnb = product.tnbRequests?.[0] != null;
  const hasPendingTb  = product.tbRequest && product.tbRequest !== "NONE";
  const isActive      = product.active !== false;

  return (
    <tr className={`border-b border-gray-50 transition hover:bg-cream/30 ${!isActive ? "opacity-55" : ""}`}>
      <td className="pl-4 pr-2 py-3 w-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(product.id)}
          className="w-4 h-4 accent-navy rounded cursor-pointer"
        />
      </td>

      <td className="px-2 py-3 w-12">
        <Thumb product={product} />
      </td>

      <td className="px-3 py-3 min-w-[140px]">
        <p className="font-bold text-navy text-sm leading-tight">{product.name}</p>
        <p className="text-[11px] font-mono text-gray-400 mt-0.5">#{productSku(product)}</p>
      </td>

      <td className="px-3 py-3 w-28">
        <span className="text-[11px] font-semibold text-navy/60 bg-navy/8 px-2 py-0.5 rounded-full">
          {product.category}
        </span>
      </td>

      <td className="px-3 py-3 w-24 text-sm font-bold text-navy whitespace-nowrap">
        ₹{Number(product.price).toLocaleString()}
      </td>

      <td className="px-3 py-3">
        <VariantChips
          product={product}
          threshold={threshold}
          editingId={editingVariantId}
          editValue={editValue}
          onStart={onStart}
          onChange={onChange}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      </td>

      <td className="px-3 py-3 w-28 text-center">
        {hasPendingTnb || hasPendingTb ? (
          <span className="text-[11px] font-bold bg-yellow text-navy px-2 py-0.5 rounded-full">Pending</span>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              effective ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
            }`}>
              {effective ? "Eligible" : "Ineligible"}
            </span>
            <button
              onClick={() => onTnbModal(product)}
              className="text-[11px] text-navy/40 hover:text-navy underline transition"
            >
              {effective ? "Remove" : "Request"}
            </button>
          </div>
        )}
      </td>

      <td className="px-3 py-3 w-24 text-center">
        <button
          onClick={() => onToggleActive(product)}
          title={isActive ? "Click to deactivate" : "Click to activate"}
          className={`text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer transition hover:opacity-75 ${
            isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {isActive ? "Active" : "Inactive"}
        </button>
      </td>

      <td className="px-3 py-3 w-10 text-center">
        <button
          onClick={() => onEdit(product)}
          className="text-navy/30 hover:text-navy transition"
          title="Edit product"
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.586 3.586a2 2 0 112.828 2.828l-10 10a2 2 0 01-.707.464l-3 1a1 1 0 01-1.262-1.263l1-3a2 2 0 01.464-.707l10-10z"/>
          </svg>
        </button>
      </td>
    </tr>
  );
}

// ── Edit Product Modal ─────────────────────────────────────────────────────────

function EditModal({ product, onSave, onClose }) {
  const [form, setForm] = useState({
    name:     product.name,
    price:    String(product.price),
    category: product.category,
    images:   (product.images || []).join("\n"),
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(product.id, {
        name:     form.name,
        price:    parseFloat(form.price),
        category: form.category,
        images:   form.images.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-navy text-base">Edit Product</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-navy text-xl">✕</button>
        </div>
        <div>
          <p className="text-[11px] font-bold text-navy/40 uppercase tracking-widest mb-1">Product Name</p>
          <input value={form.name} onChange={set("name")}
            className="w-full border border-navy/15 rounded-xl px-4 py-2.5 text-sm text-navy focus:outline-none focus:border-navy" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] font-bold text-navy/40 uppercase tracking-widest mb-1">Price (₹)</p>
            <input type="number" value={form.price} onChange={set("price")}
              className="w-full border border-navy/15 rounded-xl px-4 py-2.5 text-sm text-navy focus:outline-none focus:border-navy" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-navy/40 uppercase tracking-widest mb-1">Category</p>
            <select value={form.category} onChange={set("category")}
              className="w-full border border-navy/15 rounded-xl px-4 py-2.5 text-sm text-navy bg-white focus:outline-none focus:border-navy">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold text-navy/40 uppercase tracking-widest mb-1">Image URLs (one per line)</p>
          <textarea value={form.images} onChange={set("images")} rows={3} placeholder="https://…"
            className="w-full border border-navy/15 rounded-xl px-4 py-2.5 text-sm text-navy resize-none focus:outline-none focus:border-navy" />
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-navy/20 text-navy font-bold rounded-xl py-2.5 text-sm hover:bg-navy/5">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name || !form.price}
            className="flex-1 bg-navy text-yellow font-black rounded-xl py-2.5 text-sm disabled:opacity-40">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Order Activity Panel ───────────────────────────────────────────────────────

function ActivityPanel({ activity }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-bold text-navy/40 uppercase tracking-widest mb-4">Order Activity</p>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: "Sold Today",       value: activity.soldToday    },
          { label: "Sold This Week",   value: activity.soldThisWeek },
          { label: "In Active Orders", value: activity.reserved     },
        ].map((s) => (
          <div key={s.label} className="text-center bg-cream rounded-2xl py-4">
            <p className="text-2xl font-black text-navy">{s.value}</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      {activity.mostReturned.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-navy/40 uppercase tracking-widest mb-2">Most Returned</p>
          <div className="space-y-2">
            {activity.mostReturned.map((item) => (
              <div key={item.id} className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{item.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {Object.entries(item.reasons).map(([r, c]) => `${r} (${c}×)`).join(" · ")}
                  </p>
                </div>
                <span className="text-sm font-black text-red-500 shrink-0">{item.count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── T&B Request Modal ──────────────────────────────────────────────────────────

function TnbModal({ product, note, onNoteChange, onSubmit, onClose, saving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-cream rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="w-12 h-12 rounded-full bg-navy flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-yellow" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
          </svg>
        </div>
        <h2 className="text-base font-bold text-navy text-center mb-1">
          {product.tryAndBuyEligible ? "Request T&B Removal" : "Request T&B Eligibility"}
        </h2>
        <p className="text-sm text-navy/50 text-center mb-5">
          <span className="font-semibold text-navy">{product.name}</span>
          {" — "}
          {product.tryAndBuyEligible ? "Remove from Try & Buy." : "Request T&B eligibility."}
          <br /><span className="text-xs">An admin will review this request.</span>
        </p>
        <label className="block text-xs font-semibold text-navy mb-1.5">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Add context for the admin…"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-navy placeholder:text-gray-300 focus:outline-none focus:border-navy resize-none mb-5"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-navy border border-navy/20 rounded-xl hover:bg-white transition">Cancel</button>
          <button onClick={onSubmit} disabled={saving} className="flex-1 py-2.5 text-sm font-semibold text-navy bg-yellow hover:brightness-95 rounded-xl transition disabled:opacity-50">
            {saving ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function StockView({ storeId }) {
  const [products, setProducts]   = useState([]);
  const [activity, setActivity]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [threshold, setThreshold] = useState(5);

  // Filters
  const [search,       setSearch]       = useState("");
  const [catFilter,    setCatFilter]    = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tbFilter,     setTbFilter]     = useState("all");
  const [stockFilter,  setStockFilter]  = useState("all");
  const [sortBy,       setSortBy]       = useState("name");

  // Bulk
  const [selected,       setSelected]       = useState(new Set());
  const [bulkStockModal, setBulkStockModal] = useState(false);
  const [bulkStockValue, setBulkStockValue] = useState("");
  const [bulkSaving,     setBulkSaving]     = useState(false);

  // Inline variant edit
  const [editingVariantId, setEditingVariantId] = useState(null);
  const [editValue,        setEditValue]         = useState("");

  // Modals + CSV
  const [editModal, setEditModal] = useState(null);
  const [tnbModal,  setTnbModal]  = useState(null);
  const [tnbNote,   setTnbNote]   = useState("");
  const [tnbSaving, setTnbSaving] = useState(false);
  const [preview,   setPreview]   = useState(null);
  const [csvSaving, setCsvSaving] = useState(false);
  const [toast,     setToast]     = useState(null);

  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const prods = await fetchStoreProducts(storeId);
      setProducts(prods);
    } finally {
      setLoading(false);
    }
    fetchStoreActivity().then(setActivity).catch(() => {});
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // ── Computed ────────────────────────────────────────────────────────────────

  const categories         = [...new Set(products.map((p) => p.category))].sort();
  const outOfStockVariants = products.reduce((s, p) => s + p.variants.filter((v) => v.stock === 0).length, 0);
  const lowStockVariants   = products.reduce((s, p) => s + p.variants.filter((v) => v.stock > 0 && v.stock <= threshold).length, 0);
  const tbEligibleCount    = products.filter((p) => resolveEffective(p.store, p)).length;
  const inactiveCount      = products.filter((p) => p.active === false).length;
  const outOfStockProducts = products.filter((p) => p.variants.some((v) => v.stock === 0));
  const lowStockProducts   = products.filter((p) =>
    !p.variants.some((v) => v.stock === 0) && p.variants.some((v) => v.stock > 0 && v.stock <= threshold)
  );

  // ── Filtering + sorting ─────────────────────────────────────────────────────

  const filtered = products
    .filter((p) => {
      const q         = search.toLowerCase();
      const matchQ    = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      const matchCat  = catFilter === "all" || p.category === catFilter;
      const matchStat = statusFilter === "all" || (statusFilter === "active" ? p.active !== false : p.active === false);
      const eff       = resolveEffective(p.store, p);
      const matchTb   = tbFilter === "all" || (tbFilter === "eligible" ? eff : !eff);
      const matchStk  = stockFilter === "all"
        || (stockFilter === "out" && p.variants.some((v) => v.stock === 0))
        || (stockFilter === "low" && p.variants.some((v) => v.stock > 0 && v.stock <= threshold));
      return matchQ && matchCat && matchStat && matchTb && matchStk;
    })
    .sort((a, b) => {
      if (sortBy === "price") return Number(b.price) - Number(a.price);
      if (sortBy === "stock") return totalStock(a) - totalStock(b);
      return a.name.localeCompare(b.name);
    });

  const allSelected  = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const someSelected = selected.size > 0;

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map((p) => p.id)));
  }
  function toggleSelect(id) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // ── Inline stock edit ───────────────────────────────────────────────────────

  function startEdit(variantId, stock) { setEditingVariantId(variantId); setEditValue(String(stock)); }
  function cancelEdit()                { setEditingVariantId(null); setEditValue(""); }

  async function commitEdit(variantId, value) {
    const stock = parseInt(value, 10);
    cancelEdit();
    if (isNaN(stock) || stock < 0) return;
    try {
      await bulkUpdateStock([{ variantId, stock }]);
      setProducts((prev) => prev.map((p) => ({
        ...p,
        variants: p.variants.map((v) => v.id === variantId ? { ...v, stock } : v),
      })));
      showToast("Stock updated");
    } catch { showToast("Failed to update stock"); }
  }

  // ── Toggle active ───────────────────────────────────────────────────────────

  async function handleToggleActive(product) {
    const newActive = product.active === false;
    try {
      await toggleProductActive(product.id, newActive);
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, active: newActive } : p));
      showToast(`${product.name} marked ${newActive ? "active" : "inactive"}`);
    } catch { showToast("Failed to update status"); }
  }

  // ── Edit product ────────────────────────────────────────────────────────────

  async function handleEditSave(productId, data) {
    const updated = await updateProduct(productId, data);
    setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, ...updated } : p));
    showToast("Product updated");
  }

  // ── T&B request ─────────────────────────────────────────────────────────────

  async function handleTnbRequest() {
    if (!tnbModal) return;
    const { product } = tnbModal;
    setTnbSaving(true);
    try {
      await requestTnbChange(product.id, !product.tryAndBuyEligible, tnbNote);
      setProducts((prev) => prev.map((p) =>
        p.id === product.id ? { ...p, tnbRequests: [{ id: "pending", requestedEligible: !product.tryAndBuyEligible }] } : p
      ));
      showToast(`T&B request submitted for ${product.name}`);
      setTnbModal(null); setTnbNote("");
    } catch (err) {
      showToast(err?.response?.data?.error?.message ?? "Request failed");
    } finally {
      setTnbSaving(false);
    }
  }

  // ── Bulk actions ────────────────────────────────────────────────────────────

  async function handleBulkTb(enable) {
    const sel = products.filter((p) => selected.has(p.id));
    let ok = 0;
    for (const p of sel) {
      try { await requestProductTbChange(p.id, enable ? "PENDING_ELIGIBLE" : "PENDING_INELIGIBLE"); ok++; } catch {}
    }
    showToast(`T&B ${enable ? "enable" : "disable"} requested for ${ok} product${ok !== 1 ? "s" : ""}`);
    setSelected(new Set());
    load();
  }

  async function handleBulkStock() {
    const stock = parseInt(bulkStockValue, 10);
    if (isNaN(stock) || stock < 0) return;
    setBulkSaving(true);
    try {
      const updates = products.filter((p) => selected.has(p.id)).flatMap((p) =>
        p.variants.map((v) => ({ variantId: v.id, stock }))
      );
      await bulkUpdateStock(updates);
      await load();
      setBulkStockModal(false); setBulkStockValue(""); setSelected(new Set());
      showToast(`Set ${updates.length} variants to ${stock} units`);
    } finally { setBulkSaving(false); }
  }

  // ── CSV ─────────────────────────────────────────────────────────────────────

  function handleExport() {
    const prods = someSelected ? products.filter((p) => selected.has(p.id)) : products;
    const rows  = [["product_name","sku","category","price","size","color","variant_id","stock"]];
    for (const p of prods) {
      for (const v of p.variants) {
        rows.push([p.name, productSku(p), p.category, Number(p.price), v.size, v.color ?? "", v.id, v.stock]);
      }
    }
    const csv  = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = "inventory.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadTemplate() {
    const csv  = [
      ["product_name","size","color","variant_id","stock"],
      ["Example Product","M","Black","paste-variant-id-here","0"],
    ].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = "stock_template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      const vm   = {};
      for (const p of products) {
        for (const v of p.variants) {
          vm[v.id] = { product: p.name, size: v.size, color: v.color, currentStock: v.stock };
          vm[`${p.name.toLowerCase()}|${v.size.toLowerCase()}|${(v.color ?? "").toLowerCase()}`] =
            { variantId: v.id, product: p.name, size: v.size, color: v.color, currentStock: v.stock };
        }
      }
      const changes = rows.map((row) => {
        const newStock = parseInt(row.stock, 10);
        if (isNaN(newStock)) return null;
        let match     = row.variant_id ? vm[row.variant_id] : null;
        let variantId = row.variant_id || null;
        if (!match && row.product_name) {
          const key = `${row.product_name.toLowerCase()}|${(row.size ?? "").toLowerCase()}|${(row.color ?? "").toLowerCase()}`;
          match = vm[key];
          if (match) variantId = match.variantId;
        }
        if (!match || !variantId) return { error: `No match: ${row.product_name ?? row.variant_id}` };
        return { variantId, product: match.product, size: match.size, color: match.color, currentStock: match.currentStock, newStock };
      }).filter(Boolean);
      setPreview(changes);
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  async function handleConfirmImport() {
    const updates = preview.filter((r) => !r.error).map(({ variantId, newStock }) => ({ variantId, stock: newStock }));
    if (!updates.length) return;
    setCsvSaving(true);
    try {
      await bulkUpdateStock(updates);
      const fresh = await fetchStoreProducts(storeId);
      setProducts(fresh);
      setPreview(null);
      showToast(`Updated ${updates.length} variant${updates.length !== 1 ? "s" : ""}`);
    } finally { setCsvSaving(false); }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 max-w-6xl mx-auto space-y-5">

      {/* Header metrics */}
      <div className="grid grid-cols-5 gap-3">
        <MetricCard label="Products"     value={products.length} />
        <MetricCard label="Out of Stock" value={outOfStockVariants} warn={outOfStockVariants > 0} />
        <MetricCard label="Low Stock"    value={lowStockVariants}   warn={lowStockVariants > 0} />
        <MetricCard label="T&B Eligible" value={`${tbEligibleCount} / ${products.length}`} />
        <MetricCard label="Inactive"     value={inactiveCount} />
      </div>

      {/* Alerts */}
      <AlertsPanel
        outOfStock={outOfStockProducts}
        lowStock={lowStockProducts}
        threshold={threshold}
        onChangeThreshold={setThreshold}
      />

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-40 border border-gray-200 rounded-xl px-4 py-2 text-sm text-navy placeholder:text-gray-300 focus:outline-none focus:border-navy"
        />
        <Sel value={catFilter} onChange={setCatFilter}>
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </Sel>
        <Sel value={statusFilter} onChange={setStatusFilter}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Sel>
        <Sel value={tbFilter} onChange={setTbFilter}>
          <option value="all">All T&B</option>
          <option value="eligible">T&B Eligible</option>
          <option value="ineligible">Not Eligible</option>
        </Sel>
        <Sel value={stockFilter} onChange={setStockFilter}>
          <option value="all">All stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </Sel>
        <Sel value={sortBy} onChange={setSortBy}>
          <option value="name">Sort: Name</option>
          <option value="price">Sort: Price ↓</option>
          <option value="stock">Sort: Stock ↑</option>
        </Sel>
        <div className="flex gap-2 ml-auto">
          <button onClick={handleDownloadTemplate}
            className="text-sm text-gray-400 border border-dashed border-gray-200 bg-white px-3 py-2 rounded-xl hover:bg-gray-50 hover:text-navy transition">
            ↓ Template
          </button>
          <button onClick={handleExport}
            className="text-sm font-medium text-navy border border-gray-200 bg-white px-3 py-2 rounded-xl hover:bg-gray-50 transition">
            ↓ Export{someSelected ? ` (${selected.size})` : ""}
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="text-sm font-bold bg-navy text-cream px-3 py-2 rounded-xl hover:brightness-110 transition">
            ↑ Import CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* Bulk actions */}
      {someSelected && (
        <div className="bg-navy rounded-2xl px-5 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-cream text-sm font-semibold">{selected.size} selected</span>
          <button onClick={() => handleBulkTb(true)}
            className="text-xs font-bold bg-emerald-400 text-navy px-3 py-1.5 rounded-lg hover:bg-emerald-500 transition">
            Enable T&B
          </button>
          <button onClick={() => handleBulkTb(false)}
            className="text-xs font-bold bg-red-400 text-white px-3 py-1.5 rounded-lg hover:bg-red-500 transition">
            Disable T&B
          </button>
          <button onClick={() => setBulkStockModal(true)}
            className="text-xs font-bold bg-yellow text-navy px-3 py-1.5 rounded-lg hover:brightness-95 transition">
            Set Stock
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-cream/50 hover:text-cream text-sm">
            ✕ Clear
          </button>
        </div>
      )}

      {/* Product table */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading inventory…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream border-b border-gray-100">
                <th className="pl-4 pr-2 py-3 w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                    className="w-4 h-4 accent-navy rounded cursor-pointer" />
                </th>
                <th className="w-12 px-2" />
                {[
                  ["Product / SKU",          "text-left px-3"],
                  ["Category",               "text-left px-3 w-28"],
                  ["Price",                  "text-left px-3 w-24"],
                  ["Stock  (click to edit)", "text-left px-3"],
                  ["T&B",                    "text-center px-3 w-28"],
                  ["Status",                 "text-center px-3 w-24"],
                  ["",                       "w-10 px-3"],
                ].map(([label, cls], i) => (
                  <th key={i} className={`py-3 text-[11px] font-semibold text-navy/60 uppercase tracking-wide ${cls}`}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-gray-400">No products match the current filters</td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    threshold={threshold}
                    selected={selected.has(p.id)}
                    onSelect={toggleSelect}
                    onEdit={setEditModal}
                    onToggleActive={handleToggleActive}
                    onTnbModal={(prod) => { setTnbModal({ product: prod }); setTnbNote(""); }}
                    editingVariantId={editingVariantId}
                    editValue={editValue}
                    onStart={startEdit}
                    onChange={setEditValue}
                    onCommit={commitEdit}
                    onCancel={cancelEdit}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Order activity */}
      {activity && <ActivityPanel activity={activity} />}

      {/* ── Modals ── */}

      {editModal && (
        <EditModal product={editModal} onSave={handleEditSave} onClose={() => setEditModal(null)} />
      )}

      {tnbModal && (
        <TnbModal
          product={tnbModal.product}
          note={tnbNote}
          onNoteChange={setTnbNote}
          onSubmit={handleTnbRequest}
          onClose={() => setTnbModal(null)}
          saving={tnbSaving}
        />
      )}

      {bulkStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={() => setBulkStockModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <h2 className="font-black text-navy">Set Stock — {selected.size} Product{selected.size !== 1 ? "s" : ""}</h2>
            <p className="text-sm text-navy/50">Sets ALL variants of selected products to the same count.</p>
            <div>
              <p className="text-[11px] font-bold text-navy/40 uppercase tracking-widest mb-1">Stock Count</p>
              <input
                type="number" min={0} autoFocus
                value={bulkStockValue}
                onChange={(e) => setBulkStockValue(e.target.value)}
                placeholder="e.g. 10"
                className="w-full border border-navy/15 rounded-xl px-4 py-2.5 text-sm text-navy focus:outline-none focus:border-navy"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setBulkStockModal(false)} className="flex-1 border border-navy/20 text-navy font-bold rounded-xl py-2.5 text-sm hover:bg-navy/5">Cancel</button>
              <button onClick={handleBulkStock} disabled={bulkSaving || !bulkStockValue}
                className="flex-1 bg-navy text-yellow font-black rounded-xl py-2.5 text-sm disabled:opacity-40">
                {bulkSaving ? "Updating…" : "Set Stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={() => setPreview(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-navy px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <span className="text-cream font-bold">Import Preview — {preview.filter((r) => !r.error).length} changes</span>
              <button onClick={() => setPreview(null)} className="text-cream/50 hover:text-cream text-xl">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {preview.map((row, i) =>
                row.error ? (
                  <div key={i} className="bg-red-50 text-red-600 text-xs px-4 py-2 rounded-lg">{row.error}</div>
                ) : (
                  <div key={i} className="flex items-center justify-between bg-cream rounded-xl px-4 py-2.5 text-sm">
                    <span className="font-medium text-navy">{row.product} — {row.size}{row.color ? ` / ${row.color}` : ""}</span>
                    <span className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400">{row.currentStock}</span>
                      <span className="text-gray-300">→</span>
                      <span className={`font-bold ${row.newStock > row.currentStock ? "text-emerald-600" : row.newStock < row.currentStock ? "text-red-500" : "text-gray-400"}`}>
                        {row.newStock}
                      </span>
                    </span>
                  </div>
                )
              )}
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setPreview(null)} className="flex-1 border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleConfirmImport} disabled={csvSaving}
                className="flex-1 bg-navy text-yellow font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
                {csvSaving ? "Saving…" : "Confirm Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-navy text-cream text-sm font-medium px-5 py-3 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
