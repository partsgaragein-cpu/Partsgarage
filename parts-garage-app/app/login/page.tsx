"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Incorrect email or password.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="yl-row yl-items-center yl-justify-center" style={{ minHeight: "100vh", padding: 20 }}>
      <form onSubmit={handleLogin} className="yl-card" style={{ width: 360, maxWidth: "100%", padding: 28 }}>
        <div className="yl-display yl-fw-700" style={{ fontSize: 20, color: "var(--text)", marginBottom: 4 }}>
          Parts Garage
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 24 }}>Admin login</div>

        <label className="yl-label">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="yl-input"
          style={{ width: "100%", marginBottom: 16 }}
        />

        <label className="yl-label">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="yl-input"
          style={{ width: "100%", marginBottom: 20 }}
        />

        {error && <div style={{ fontSize: 12.5, color: "#E5484D", marginBottom: 16 }}>{error}</div>}

        <button type="submit" disabled={loading} className="yl-btn-primary" style={{ width: "100%" }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
