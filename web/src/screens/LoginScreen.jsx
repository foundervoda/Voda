import { useState } from "react";
import { login, requestMagicLink } from "../api/auth";

export default function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);

  const [magicEmail, setMagicEmail] = useState("");
  const [magicLink, setMagicLink] = useState("");
  const [magicError, setMagicError] = useState(null);
  const [magicLoading, setMagicLoading] = useState(false);

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

  async function handleMagicRequest(e) {
    e.preventDefault();
    setMagicError(null);
    setMagicLink("");
    setMagicLoading(true);
    try {
      const link = await requestMagicLink(magicEmail);
      setMagicLink(link);
    } catch (err) {
      setMagicError(err?.response?.data?.error?.message ?? "Failed to generate magic link");
    } finally {
      setMagicLoading(false);
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

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs font-semibold uppercase">
            <span className="bg-cream px-2 text-navy/40">Or Admin Magic Link</span>
          </div>
        </div>

        <form onSubmit={handleMagicRequest} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-navy mb-1.5">Admin Email</label>
            <input
              type="email"
              required
              value={magicEmail}
              onChange={(e) => setMagicEmail(e.target.value)}
              placeholder="admin@voda.test"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-navy
                         placeholder:text-gray-300 focus:outline-none focus:border-navy transition"
            />
          </div>

          {magicError && <p className="text-red-500 text-xs">{magicError}</p>}

          <button
            type="submit"
            disabled={magicLoading}
            className="w-full bg-yellow text-navy font-bold py-3 rounded-xl text-sm border border-navy/20
                       hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {magicLoading ? "Generating link…" : "Get Magic Login Link"}
          </button>

          {magicLink && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 break-all text-center">
              <p className="font-semibold mb-1">Click below to auto-login as Admin:</p>
              <a href={magicLink} className="underline font-bold text-green-700 hover:text-green-900">
                {magicLink}
              </a>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
