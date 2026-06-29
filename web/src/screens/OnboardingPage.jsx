import { useState, useEffect } from "react";
import axios from "axios";

const API = `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api`;

const CATEGORIES = ["Sneakers", "Apparel", "Boots", "Accessories", "Other"];
const SIZE_PRESETS = {
  Sneakers: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"],
  Apparel:  ["XS", "S", "M", "L", "XL", "XXL"],
  Boots:    ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10"],
  default:  ["One Size"],
};

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-navy/50 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

function Input({ ...props }) {
  return (
    <input
      {...props}
      className="border border-navy/15 rounded-xl px-4 py-3 text-navy text-sm font-medium focus:outline-none focus:border-navy placeholder:text-navy/25"
    />
  );
}

function Btn({ children, onClick, disabled, variant = "primary", type = "button" }) {
  const cls = variant === "primary"
    ? "bg-navy text-yellow font-black rounded-xl py-3 px-6 disabled:opacity-40 transition-opacity w-full"
    : "bg-yellow text-navy font-black rounded-xl py-3 px-6 border border-navy/20 disabled:opacity-40 transition-opacity";
  return <button type={type} onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

function StepDot({ n, current }) {
  const done = n < current;
  const active = n === current;
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors
      ${done ? "bg-emerald-500 text-white" : active ? "bg-navy text-yellow" : "bg-navy/10 text-navy/30"}`}>
      {done ? "✓" : n}
    </div>
  );
}

// ── Step 1: PIN ────────────────────────────────────────────────────────────────
function StepPin({ token, storeInfo, onVerified }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function verify() {
    if (!pin.trim()) return;
    setLoading(true); setError(null);
    try {
      await axios.post(`${API}/onboard/${token}/verify-pin`, { pinCode: pin.trim() });
      onVerified(pin.trim());
    } catch (e) {
      setError(e.response?.data?.error?.message ?? "Incorrect PIN");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-black text-navy mb-1">Verify your invite</h2>
        <p className="text-navy/50 text-sm">Enter the PIN code your Voda admin shared with you.</p>
      </div>
      <div className="bg-cream rounded-2xl p-4 border border-navy/8">
        <p className="text-xs text-navy/40 font-semibold uppercase tracking-widest mb-1">Store</p>
        <p className="text-navy font-bold">{storeInfo.name}</p>
        <p className="text-navy/50 text-sm">{storeInfo.location}</p>
      </div>
      <Field label="PIN Code">
        <Input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && verify()}
          placeholder="Enter PIN"
          autoFocus
        />
      </Field>
      {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
      <Btn onClick={verify} disabled={loading || !pin.trim()}>
        {loading ? "Verifying…" : "Continue →"}
      </Btn>
    </div>
  );
}

// ── Step 2: Store Details ──────────────────────────────────────────────────────
function StepDetails({ initial, onNext }) {
  const [form, setForm] = useState({
    name: initial.name || "",
    location: initial.location || "",
    phone: "",
    email: "",
    category: "",
    logoUrl: "",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.name && form.location && form.phone;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-black text-navy mb-1">Store details</h2>
        <p className="text-navy/50 text-sm">Complete your store profile. You can update this later.</p>
      </div>

      <Field label="Store Name *">
        <Input value={form.name} onChange={set("name")} placeholder="e.g. Sneaker House" />
      </Field>
      <Field label="Mall Location / Unit *">
        <Input value={form.location} onChange={set("location")} placeholder="e.g. Level 1, Unit 12" />
      </Field>
      <Field label="Contact Phone *">
        <Input type="tel" value={form.phone} onChange={set("phone")} placeholder="e.g. 98765 43210" />
      </Field>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={set("email")} placeholder="store@example.com" />
      </Field>
      <Field label="Category">
        <select
          value={form.category}
          onChange={set("category")}
          className="border border-navy/15 rounded-xl px-4 py-3 text-navy text-sm font-medium focus:outline-none focus:border-navy bg-white"
        >
          <option value="">Select category…</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Logo URL (optional)">
        <Input value={form.logoUrl} onChange={set("logoUrl")} placeholder="https://…" />
      </Field>

      <Btn onClick={() => onNext(form)} disabled={!valid}>Add Inventory →</Btn>
    </div>
  );
}

// ── Step 3: Inventory ──────────────────────────────────────────────────────────
function StepInventory({ storeCategory, onNext, onBack }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name: "", price: "", category: storeCategory || "", sizes: "", tbEligible: false });

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  function addProduct() {
    if (!form.name || !form.price) return;
    const presetSizes = SIZE_PRESETS[form.category] || SIZE_PRESETS.default;
    const sizesArr = form.sizes.trim()
      ? form.sizes.split(",").map((s) => s.trim()).filter(Boolean)
      : presetSizes;
    setProducts((p) => [...p, { ...form, sizes: sizesArr }]);
    setForm({ name: "", price: "", category: storeCategory || "", sizes: "", tbEligible: false });
  }

  function removeProduct(i) {
    setProducts((p) => p.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-black text-navy mb-1">Add inventory</h2>
        <p className="text-navy/50 text-sm">Add the products you want to list. You can add more after approval.</p>
      </div>

      {/* Add product form */}
      <div className="bg-cream rounded-2xl p-4 border border-navy/8 flex flex-col gap-3">
        <p className="text-xs font-bold text-navy/40 uppercase tracking-widest">New Product</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Product Name *">
            <Input value={form.name} onChange={setF("name")} placeholder="e.g. Air Runner 2" />
          </Field>
          <Field label="Price (₹) *">
            <Input type="number" value={form.price} onChange={setF("price")} placeholder="e.g. 7200" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select value={form.category} onChange={setF("category")}
              className="border border-navy/15 rounded-xl px-4 py-3 text-navy text-sm font-medium focus:outline-none focus:border-navy bg-white">
              <option value="">Select…</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Sizes (comma-separated, or leave blank for defaults)">
            <Input value={form.sizes} onChange={setF("sizes")} placeholder="e.g. UK 8, UK 9, UK 10" />
          </Field>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-navy font-semibold">
          <input type="checkbox" checked={form.tbEligible} onChange={setF("tbEligible")} className="w-4 h-4 accent-navy rounded" />
          Try &amp; Buy eligible
        </label>
        <button
          onClick={addProduct}
          disabled={!form.name || !form.price}
          className="self-start bg-navy text-yellow text-sm font-black rounded-xl px-5 py-2 disabled:opacity-40"
        >
          + Add Product
        </button>
      </div>

      {/* Product list */}
      {products.length > 0 && (
        <div className="flex flex-col gap-2">
          {products.map((p, i) => (
            <div key={i} className="bg-white border border-navy/10 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-navy text-sm">{p.name}</p>
                <p className="text-navy/50 text-xs">₹{Number(p.price).toLocaleString()} · {p.category || "—"} · {p.sizes.join(", ")}{p.tbEligible ? " · T&B" : ""}</p>
              </div>
              <button onClick={() => removeProduct(i)} className="text-red-400 hover:text-red-600 text-sm font-bold">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 border border-navy/20 text-navy font-bold rounded-xl py-3 text-sm hover:bg-navy/5">← Back</button>
        <button onClick={() => onNext(products)} className="flex-1 bg-navy text-yellow font-black rounded-xl py-3 text-sm">
          {products.length === 0 ? "Skip & Submit →" : `Submit ${products.length} product${products.length > 1 ? "s" : ""} →`}
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Done ───────────────────────────────────────────────────────────────
function StepDone({ storeName }) {
  return (
    <div className="flex flex-col items-center gap-5 py-8 text-center">
      <div className="w-20 h-20 rounded-full bg-navy flex items-center justify-center text-4xl">✓</div>
      <div>
        <h2 className="text-2xl font-black text-navy mb-2">You're submitted!</h2>
        <p className="text-navy/60 text-sm max-w-xs leading-relaxed">
          <strong>{storeName}</strong> is now pending review. Your Voda admin will approve your store and notify you once you're live.
        </p>
      </div>
      <div className="bg-cream rounded-2xl p-5 border border-navy/8 w-full text-left space-y-2">
        <p className="text-xs font-bold text-navy/40 uppercase tracking-widest">What happens next</p>
        <p className="text-sm text-navy/70">① Admin reviews your store details and inventory</p>
        <p className="text-sm text-navy/70">② You receive confirmation once approved</p>
        <p className="text-sm text-navy/70">③ Your store goes live on the Voda customer app</p>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function OnboardingPage({ token }) {
  const [step, setStep] = useState(0);   // 0=loading, 1=pin, 2=details, 3=inventory, 4=done
  const [storeInfo, setStoreInfo] = useState(null);
  const [pinCode, setPinCode] = useState(null);
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`${API}/onboard/${token}`)
      .then((r) => { setStoreInfo(r.data.data.store); setStep(1); })
      .catch((e) => setError(e.response?.data?.error?.message ?? "Invalid invite link"));
  }, [token]);

  async function submit(products) {
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/onboard/${token}/complete`, {
        pinCode,
        ...details,
        products,
      });
      setStoreInfo((s) => ({ ...s, name: res.data.data.storeName }));
      setStep(4);
    } catch (e) {
      alert(e.response?.data?.error?.message ?? "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fdf9ea] flex flex-col">
      {/* Header */}
      <div className="bg-[#012a62] px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#fdde59] flex items-center justify-center font-black text-[#012a62] text-sm">V</div>
        <span className="text-white font-black text-lg">Voda</span>
        <span className="text-white/40 text-sm ml-1">/ Store Onboarding</span>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">

          {/* Step dots */}
          {step >= 1 && step <= 3 && (
            <div className="flex items-center gap-2 mb-8">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-2">
                  <StepDot n={n} current={step} />
                  {n < 3 && <div className={`h-0.5 w-12 rounded-full ${step > n ? "bg-emerald-400" : "bg-navy/10"}`} />}
                </div>
              ))}
              <span className="ml-auto text-navy/30 text-xs font-semibold">
                {step === 1 ? "Verify" : step === 2 ? "Details" : "Inventory"}
              </span>
            </div>
          )}

          {/* Content */}
          <div className="bg-white rounded-3xl shadow-sm border border-navy/8 p-8">
            {step === 0 && !error && (
              <div className="text-center py-8 text-navy/40 text-sm">Loading invite…</div>
            )}
            {error && (
              <div className="text-center py-8">
                <p className="text-4xl mb-4">🔗</p>
                <p className="text-navy font-black text-lg mb-2">Link unavailable</p>
                <p className="text-red-500 text-sm font-semibold">{error}</p>
              </div>
            )}
            {step === 1 && (
              <StepPin token={token} storeInfo={storeInfo} onVerified={(pin) => { setPinCode(pin); setStep(2); }} />
            )}
            {step === 2 && (
              <StepDetails initial={storeInfo} onNext={(d) => { setDetails(d); setStep(3); }} />
            )}
            {step === 3 && (
              <StepInventory
                storeCategory={details?.category}
                onNext={submitting ? undefined : submit}
                onBack={() => setStep(2)}
              />
            )}
            {step === 4 && <StepDone storeName={storeInfo?.name || details?.name} />}
          </div>
        </div>
      </div>
    </div>
  );
}
