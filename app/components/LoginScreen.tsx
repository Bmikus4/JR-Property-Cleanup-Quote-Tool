"use client";

import { useState, useEffect } from "react";

interface LoginScreenProps {
  onSuccess: (name: string, email: string) => void;
}

type Mode = "login" | "signup";

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [btnHover, setBtnHover] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, name, email }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Something went wrong."); return; }
      localStorage.setItem("auth", JSON.stringify({ name: data.name, email, loginTime: Date.now() }));
      onSuccess(data.name, email);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const field = (key: string): React.CSSProperties => ({
    width: "100%",
    background: "var(--bg)",
    border: `1px solid ${focused === key ? "var(--accent)" : "var(--border)"}`,
    boxShadow: focused === key ? "0 0 0 3px var(--accent-subtle)" : "none",
    borderRadius: "var(--radius)",
    padding: "13px 16px",
    color: "var(--text-primary)",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.18s ease, box-shadow 0.18s ease",
  });

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    background: "transparent",
    border: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid var(--border)",
    color: active ? "var(--text-primary)" : "var(--text-faint)",
    padding: "0 0 12px",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.16em",
    cursor: "pointer",
    transition: "color 0.2s, border-color 0.2s",
  });

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
        zIndex: 1,
        pointerEvents: visible ? "auto" : "none",
        padding: 20,
      }}
    >
      <div className="frosted-glass login-glass">
        <div style={{ maxWidth: 320, width: "100%", display: "flex", flexDirection: "column", gap: 28 }}>

          {/* Brand mark */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="eyebrow"><span className="slash">/</span>JR PROPERTY CLEANUP</span>
            <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.1 }}>
              Quote Tool
            </h1>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={tabStyle(mode === "login")}  onClick={() => { setMode("login"); setError(""); }}>LOG IN</button>
            <button style={tabStyle(mode === "signup")} onClick={() => { setMode("signup"); setError(""); }}>CREATE ACCOUNT</button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 196 }}>
            {mode === "signup" && (
              <input
                type="text" placeholder="Name" value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocused("name")} onBlur={() => setFocused(null)}
                required style={field("name")}
              />
            )}
            <input
              type="email" placeholder="Email address" value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
              required style={field("email")}
            />

            {error && (
              <p role="alert" style={{ color: "var(--danger)", fontSize: 12.5, margin: 0, lineHeight: 1.4 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              style={{
                marginTop: 4,
                background: loading ? "var(--accent-press)" : btnHover ? "var(--accent-hover)" : "var(--accent)",
                border: "none",
                borderRadius: "var(--radius)",
                color: "var(--text-on-accent)",
                padding: "14px",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "background 0.18s ease, transform 0.1s ease",
              }}
            >
              {loading ? "..." : mode === "login" ? "LOG IN" : "CREATE ACCOUNT"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
