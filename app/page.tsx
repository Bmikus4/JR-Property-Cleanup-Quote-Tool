"use client";

import { useState, useEffect } from "react";
import IntroScreen from "./components/IntroScreen";
import LoginScreen from "./components/LoginScreen";
import Sidebar from "./components/Sidebar";
import ChatScreen from "./components/ChatScreen";

// Each tool can define its own layout component in the content area.
const TOOL_COMPONENTS: Record<string, React.ComponentType<{ isActive: boolean; adminControls?: boolean }>> = {
  "quote-tool": ChatScreen,
};

const ADMIN_CONTROLS_KEY = "admin-controls";

const AVAILABLE_TOOLS = [
  { id: "quote-tool", label: "Quote Tool", description: "Property cleanup field quotes" },
];

// Tracks the visual viewport so the app can pin itself to the visible area.
// When the mobile keyboard opens, visualViewport shrinks and shifts (offsetTop);
// pinning prevents the page from scrolling the chat out of frame.
function useVisualViewport() {
  const [vp, setVp] = useState<{ height: string; offsetTop: number }>({ height: "100vh", offsetTop: 0 });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function onChange() {
      setVp({ height: `${vv!.height}px`, offsetTop: vv!.offsetTop });
    }

    onChange();
    vv.addEventListener("resize", onChange);
    vv.addEventListener("scroll", onChange);
    return () => {
      vv.removeEventListener("resize", onChange);
      vv.removeEventListener("scroll", onChange);
    };
  }, []);

  return vp;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    function check() { setMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    // Detect the keyboard by comparing the current visual-viewport height to the
    // tallest height seen (the "no keyboard" baseline). This works on both iOS
    // (innerHeight stays fixed) and Android (innerHeight shrinks with the
    // keyboard), where an innerHeight-vs-viewport diff fails.
    let baseline = vv.height;
    function check() {
      if (vv!.height > baseline) baseline = vv!.height;
      setVisible(baseline - vv!.height > 120);
    }
    check();
    vv.addEventListener("resize", check);
    vv.addEventListener("scroll", check);
    return () => {
      vv.removeEventListener("resize", check);
      vv.removeEventListener("scroll", check);
    };
  }, []);
  return visible;
}

function ToolsOverview({ onSelectTool }: { onSelectTool: (id: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "24px 28px", borderBottom: "1px solid var(--border)" }}>
        <span className="eyebrow"><span className="slash">/</span>AVAILABLE TOOLS</span>
      </div>
      <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 12 }}>
        {AVAILABLE_TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 5,
              padding: "18px 20px",
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              cursor: "pointer",
              textAlign: "left",
              transition: "background-color 200ms ease, border-color 200ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--surface-hover)";
              e.currentTarget.style.borderColor = "var(--accent-border)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--surface-2)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            <span style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 600 }}>{tool.label}</span>
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{tool.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}


type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

interface InstallState {
  canPrompt: boolean;   // Android / desktop Chrome captured the native prompt
  isIOS: boolean;       // iOS has no install API — instructions only
  isStandalone: boolean; // already installed / launched from home screen
  promptInstall: () => Promise<void>;
}

function useInstallPrompt(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    const ua = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === "MacIntel" && "ontouchend" in document); // iPadOS
    setIsIOS(iOS);

    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const onInstalled = () => setDeferred(null);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  return { canPrompt: deferred !== null, isIOS, isStandalone, promptInstall };
}

function SettingsPanel({
  onLogout,
  adminControls,
  onToggleAdminControls,
  install,
}: {
  onLogout: () => void;
  adminControls: boolean;
  onToggleAdminControls: (next: boolean) => void;
  install: InstallState;
}) {
  const [logoutHovered, setLogoutHovered] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  async function handleInstallClick() {
    if (install.canPrompt) { await install.promptInstall(); return; }
    setShowHelp(true); // iOS or any browser without a captured prompt
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "24px 28px", borderBottom: "1px solid var(--border)" }}>
        <span className="eyebrow"><span className="slash">/</span>SETTINGS</span>
      </div>
      <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Add to Home Screen — installs the PWA (full-screen, no browser chrome) */}
        {install.isStandalone ? (
          <div style={{
            padding: "14px 20px", backgroundColor: "var(--surface-2)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", color: "var(--text-muted)", fontSize: 14,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
            App installed
          </div>
        ) : (
          <button
            onClick={handleInstallClick}
            style={{
              padding: "14px 20px", backgroundColor: "var(--surface-2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", color: "var(--text-secondary)", fontSize: 14, fontWeight: 500,
              cursor: "pointer", textAlign: "left",
              transition: "background 0.2s ease, color 0.2s ease, border-color 0.2s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            Add to Home Screen
          </button>
        )}

        {/* Admin Controls toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "16px 20px",
            backgroundColor: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 500 }}>
              Admin Controls
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
              Show admin tools across the dashboard
            </span>
          </div>
          <button
            role="switch"
            aria-checked={adminControls}
            aria-label="Toggle admin controls"
            onClick={() => onToggleAdminControls(!adminControls)}
            style={{
              flexShrink: 0,
              width: 44,
              height: 24,
              borderRadius: 9999,
              border: "none",
              padding: 0,
              cursor: "pointer",
              backgroundColor: adminControls ? "var(--accent-light)" : "rgba(26, 58, 92, 0.15)",
              transition: "background-color 250ms cubic-bezier(0.4,0,0.2,1)",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: adminControls ? 23 : 3,
                width: 18,
                height: 18,
                borderRadius: "50%",
                backgroundColor: "#ffffff",
                transition: "left 250ms cubic-bezier(0.4,0,0.2,1)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }}
            />
          </button>
        </div>

        <button
          onClick={onLogout}
          onMouseEnter={() => setLogoutHovered(true)}
          onMouseLeave={() => setLogoutHovered(false)}
          style={{
            padding: "14px 20px",
            backgroundColor: logoutHovered ? "var(--danger-subtle)" : "var(--surface-2)",
            border: logoutHovered ? "1px solid rgba(239,68,68,0.4)" : "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: logoutHovered ? "var(--danger)" : "var(--text-secondary)",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            textAlign: "left",
            transition: "all 200ms ease",
          }}
        >
          Log Out
        </button>
      </div>
      <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)" }}>
        <a
          href="https://www.samuraisolutions.co.uk/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--text-faint)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textDecoration: "none",
            transition: "color 200ms",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-faint)")}
        >
          samuraisolutions.co.uk
        </a>
      </div>

      {/* Install instructions (iOS has no install API; any browser without a
          captured prompt also lands here) */}
      {showHelp && (
        <div onClick={() => setShowHelp(false)} style={{
          position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            maxWidth: 360, width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", padding: 24, display: "flex", flexDirection: "column", gap: 14,
          }}>
            <span className="eyebrow"><span className="slash">/</span>ADD TO HOME SCREEN</span>
            {install.isIOS ? (
              <ol style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                <li>Tap the <strong style={{ color: "var(--text-primary)" }}>Share</strong> button in Safari (the square with an up-arrow).</li>
                <li>Scroll down and tap <strong style={{ color: "var(--text-primary)" }}>Add to Home Screen</strong>.</li>
                <li>Tap <strong style={{ color: "var(--text-primary)" }}>Add</strong>, then open it from your home screen.</li>
              </ol>
            ) : (
              <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                Open your browser menu and choose <strong style={{ color: "var(--text-primary)" }}>Install app</strong> or <strong style={{ color: "var(--text-primary)" }}>Add to Home Screen</strong>, then launch it from your home screen for a full-screen experience.
              </p>
            )}
            <button onClick={() => setShowHelp(false)} style={{
              alignSelf: "flex-end", marginTop: 4, background: "transparent", border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-sm)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600,
              letterSpacing: "0.06em", padding: "8px 16px", cursor: "pointer",
            }}>GOT IT</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [introFading, setIntroFading] = useState(false);
  const [introMounted, setIntroMounted] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>("tools");
  const [showSettings, setShowSettings] = useState(false);
  const [adminControls, setAdminControls] = useState(false);
  const install = useInstallPrompt();
  const chatKey = 0;
  const { height: viewportHeight, offsetTop: viewportOffsetTop } = useVisualViewport();
  const isMobile = useIsMobile();
  const keyboardUp = useKeyboardVisible();

  // Personal devices (phones / touch / installed PWA) stay signed in ~1 year.
  // Desktop (e.g. shared Windows PCs) keeps the short 45-minute session so a
  // login isn't left open on a shared machine.
  function sessionMs() {
    try {
      const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      const small = window.innerWidth < 768;
      const standalone = (window.matchMedia?.("(display-mode: standalone)").matches ?? false)
        || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      const personal = coarse || small || standalone;
      return personal ? 365 * 24 * 60 * 60 * 1000 : 45 * 60 * 1000;
    } catch {
      return 45 * 60 * 1000; // safest default: short session
    }
  }

  function checkSession() {
    try {
      const stored = localStorage.getItem("auth");
      if (!stored) return false;
      const { loginTime } = JSON.parse(stored);
      if (typeof loginTime === "number" && Date.now() - loginTime >= sessionMs()) {
        localStorage.removeItem("auth");
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const adminParam = params.get("admin");
    if (adminParam) {
      // Strip the secret from the URL bar/history immediately, then validate it
      // server-side — the secret itself never lives in the client bundle.
      window.history.replaceState({}, "", window.location.pathname);
      fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "admin", secret: adminParam }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            localStorage.setItem("auth", JSON.stringify({ name: data.name, email: data.email, loginTime: Date.now() }));
            setAuthed(true);
          } else if (checkSession()) {
            setAuthed(true);
          }
        })
        .catch(() => { if (checkSession()) setAuthed(true); });
      return;
    }
    if (checkSession()) setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    const interval = setInterval(() => {
      if (!checkSession()) setAuthed(false);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [authed]);

  useEffect(() => {
    setAdminControls(localStorage.getItem(ADMIN_CONTROLS_KEY) === "true");
  }, []);

  // Ask the browser to keep our storage (the saved login) from being evicted.
  // Installed PWAs are usually granted this automatically; it matters most on
  // iOS/Safari where storage can otherwise be cleared after inactivity.
  useEffect(() => {
    navigator.storage?.persist?.()?.catch(() => {});
  }, []);

  function handleToggleAdminControls(next: boolean) {
    setAdminControls(next);
    localStorage.setItem(ADMIN_CONTROLS_KEY, String(next));
  }

  function handleSelectTool(toolId: string) {
    setShowSettings(false);
    if (toolId === activeTool) return;
    setActiveTool(toolId);
  }

  function handleSettings() {
    setShowSettings(true);
    setActiveTool(null);
  }

  function handleLogout() {
    const stored = localStorage.getItem("auth");
    const email = stored ? JSON.parse(stored).email : null;
    if (email) localStorage.removeItem(`quote-draft-${email}`);
    localStorage.removeItem("auth");
    setAuthed(false);
    setActiveTool(null);
    setShowSettings(false);
  }

  function handleIntroComplete() {
    setIntroFading(true);
    setTimeout(() => setIntroMounted(false), 1050);
  }

  const ActiveToolComponent = activeTool ? TOOL_COMPONENTS[activeTool] : null;

  function renderContent() {
    if (showSettings) {
      return (
        <SettingsPanel
          onLogout={handleLogout}
          adminControls={adminControls}
          onToggleAdminControls={handleToggleAdminControls}
          install={install}
        />
      );
    }
    if (activeTool === "tools") {
      return <ToolsOverview onSelectTool={handleSelectTool} />;
    }
    if (ActiveToolComponent) {
      return <ActiveToolComponent key={chatKey} isActive={true} adminControls={adminControls} />;
    }
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100%", color: "var(--color-text-muted)", fontSize: 14, letterSpacing: "0.08em",
      }}>
        Select a tool to get started
      </div>
    );
  }

  return (
    <>
      <div style={{
        height: "100%",
        visibility: introMounted && !introFading ? "hidden" : "visible",
      }}>
        {!authed ? (
          <LoginScreen onSuccess={() => setAuthed(true)} />
        ) : (
          <div style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            position: "fixed",
            top: viewportOffsetTop,
            left: 0,
            right: 0,
            height: viewportHeight,
            maxHeight: viewportHeight,
            overflow: "hidden",
          }}>
            <Sidebar activeTool={activeTool} onSelectTool={handleSelectTool} onSettings={handleSettings} />
            <main style={{
              flex: 1,
              overflow: "hidden",
              position: "relative",
              padding: isMobile ? 0 : 21,
            }}>
              <div className="frosted-glass" style={{
                height: "100%",
                overflow: "hidden",
                position: "relative",
                paddingBottom: isMobile && !keyboardUp ? "calc(42px + max(6px, env(safe-area-inset-bottom)))" : 0,
              }}>
                {renderContent()}
              </div>
            </main>
          </div>
        )}
      </div>

      {/* Intro overlay — transparent so dots show through, fades out for crossfade */}
      {introMounted && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          backgroundColor: "transparent",
          opacity: introFading ? 0 : 1,
          transition: "opacity 1s ease",
          pointerEvents: introFading ? "none" : "auto",
        }}>
          <IntroScreen onComplete={handleIntroComplete} />
        </div>
      )}
    </>
  );
}
