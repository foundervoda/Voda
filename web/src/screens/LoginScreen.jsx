import { useState } from "react";
import { login } from "../api/auth";

export default function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === "ADMIN") {
        onLogin(user);
        return;
      }
      if (user.role !== "STORE_STAFF") {
        setError("This dashboard is for store staff and admins only.");
        return;
      }
      if (!user.storeId) {
        setError("Your account has no store assigned. Contact your admin.");
        return;
      }
      onLogin(user);
    } catch (err) {
      setError(err?.response?.data?.error?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/Voda Logo.png" alt="Voda" className="h-10 mx-auto mb-3" />
          <p className="text-navy/50 text-sm">Store Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-navy mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@store.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-navy
                         placeholder:text-gray-300 focus:outline-none focus:border-navy transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-navy
                         placeholder:text-gray-300 focus:outline-none focus:border-navy transition"
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-navy text-yellow font-bold py-3 rounded-xl text-sm
                       hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
