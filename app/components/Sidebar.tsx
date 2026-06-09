"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface SubItem {
  id: string;
  label: string;
}

interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  hasDropdown: boolean;
  subItems?: SubItem[];
}

interface SidebarProps {
  activeTool: string | null;
  onSelectTool: (toolId: string) => void;
  onSettings: () => void;
}

function IconTools() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function ToggleArrow({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: "transform 350ms cubic-bezier(0.4, 0, 0.2, 1)",
        transform: expanded ? "rotate(0deg)" : "rotate(180deg)",
      }}
    >
      <polyline points="8 2 4 6 8 10" />
    </svg>
  );
}

function DropdownArrow({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
      }}
    >
      <polyline points="3 5 7 9 11 5" />
    </svg>
  );
}

function IconCRM() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    id: "tools",
    label: "Tools",
    icon: <IconTools />,
    hasDropdown: true,
    subItems: [{ id: "quote-tool", label: "Quote Tool" }],
  },
  {
    id: "current-rms",
    label: "Current RMS",
    icon: <IconCRM />,
    hasDropdown: false,
  },
];

const SETTINGS_ITEM: NavItemConfig = {
  id: "settings",
  label: "Settings",
  icon: <IconSettings />,
  hasDropdown: false,
};

const EXPANDED_WIDTH = 260;
const CONDENSED_WIDTH = 70;

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // Detect the keyboard by comparing the current visual-viewport height to the
    // tallest height seen. Works on iOS (fixed innerHeight) and Android (shrinks
    // with the keyboard); a plain innerHeight-vs-viewport diff fails on Android.
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

function MobileBottomBar({ activeTool, onSelectTool, onSettings }: SidebarProps) {
  const keyboardVisible = useKeyboardVisible();

  if (keyboardVisible) return null;

  const allItems = [...NAV_ITEMS, SETTINGS_ITEM];

  function handleTap(item: NavItemConfig) {
    if (item.id === "settings") {
      onSettings();
    } else {
      onSelectTool(item.id);
    }
  }

  function isActive(item: NavItemConfig) {
    if (item.hasDropdown) {
      return item.subItems?.some((s) => s.id === activeTool) ?? false;
    }
    return activeTool === item.id;
  }

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: "6px 0",
        paddingBottom: "max(6px, env(safe-area-inset-bottom))",
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
      }}
    >
      {allItems.map((item) => {
        const active = isActive(item);
        return (
          <button
            key={item.id}
            onClick={() => handleTap(item)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: active ? "var(--color-primary)" : "var(--color-text-primary)",
              padding: "2px 16px",
              transition: "color 200ms ease",
              minWidth: 36,
              minHeight: 36,
              justifyContent: "center",
            }}
          >
            <span style={{ display: "flex", transform: "scale(0.75)" }}>{item.icon}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default function Sidebar({ activeTool, onSelectTool, onSettings }: SidebarProps) {
  const [expanded, setExpanded] = useState(true);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const flyoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flyoutItem, setFlyoutItem] = useState<string | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-expanded");
    if (stored !== null) setExpanded(JSON.parse(stored));
  }, []);

  useEffect(() => {
    function checkMobile() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setExpanded(false);
    }
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (isMobile) {
    return <MobileBottomBar activeTool={activeTool} onSelectTool={onSelectTool} onSettings={onSettings} />;
  }

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem("sidebar-expanded", JSON.stringify(next));
    if (!next) setOpenDropdowns({});
  }

  function handleNavClick(item: NavItemConfig) {
    if (item.id === "settings") {
      onSettings();
      return;
    }
    if (item.hasDropdown) {
      if (expanded) {
        setOpenDropdowns((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
      }
      onSelectTool(item.id);
    } else {
      onSelectTool(item.id);
    }
  }

  function handleSubItemClick(subId: string) {
    onSelectTool(subId);
    setFlyoutItem(null);
  }

  const handleFlyoutEnter = (itemId: string) => {
    if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
    setFlyoutItem(itemId);
  };

  const handleFlyoutLeave = () => {
    flyoutTimeoutRef.current = setTimeout(() => setFlyoutItem(null), 150);
  };

  const isCondensed = !expanded;
  const width = expanded ? EXPANDED_WIDTH : CONDENSED_WIDTH;

  function isSubItemActive(subId: string) {
    return activeTool === subId;
  }

  function isParentActive(item: NavItemConfig) {
    if (!item.hasDropdown) return activeTool === item.id;
    return item.subItems?.some((s) => s.id === activeTool) ?? false;
  }

  return (
    <nav
      ref={sidebarRef}
      role="navigation"
      aria-label="Main sidebar navigation"
      className="frosted-glass"
      style={{
        width,
        minWidth: width,
        height: "calc(100% - 42px)",
        marginTop: 21,
        marginBottom: 21,
        display: "flex",
        flexDirection: "column",
        transition: "width 350ms cubic-bezier(0.4, 0, 0.2, 1), min-width 350ms cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
        zIndex: 100,
        overflowY: "auto",
        overflowX: "hidden",
        borderLeft: "none",
        borderRadius: "0 16px 16px 0",
      }}
    >

      {/* Toggle arrow */}
      <button
        onClick={toggleExpanded}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        style={{
          position: "absolute",
          top: "50%",
          right: 8,
          transform: "translateY(-50%)",
          width: 20,
          height: 20,
          borderRadius: 4,
          backgroundColor: "transparent",
          color: "var(--color-text-muted)",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 110,
          padding: 0,
          transition: "color 250ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text-primary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
      >
        <ToggleArrow expanded={expanded} />
      </button>

      {/* Logo — JK icon-mark */}
      <div style={{ padding: "16px 0 19px 0", display: "flex", justifyContent: "center" }}>
        <div style={{ width: 42, height: 42, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Image
            src="/jk-icon.svg"
            alt="JR Property Cleanup"
            width={42}
            height={42}
            unoptimized
            style={{ height: 38, width: "auto", objectFit: "contain" }}
          />
        </div>
      </div>

      {/* Nav Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px", flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const parentActive = isParentActive(item);
          const isCurrentPage = parentActive && !item.hasDropdown;
          const dropdownOpen = openDropdowns[item.id] && expanded;
          const isHovered = hoveredItem === item.id;

          let bg = "transparent";
          if (isCurrentPage) bg = "var(--color-primary-subtle-bg)";
          else if (dropdownOpen) bg = "var(--color-surface-active)";
          else if (isHovered) bg = "var(--color-surface-hover)";

          let iconColor = "var(--color-text-muted)";
          let labelColor = "var(--color-text-secondary)";
          if (isCurrentPage) {
            iconColor = "var(--color-primary)";
            labelColor = "var(--color-primary)";
          } else if (isHovered || parentActive) {
            iconColor = "var(--color-text-primary)";
            labelColor = "var(--color-text-primary)";
          }

          return (
            <div key={item.id} style={{ position: "relative" }}>
              <button
                onClick={() => handleNavClick(item)}
                onMouseEnter={() => {
                  setHoveredItem(item.id);
                  if (isCondensed && item.hasDropdown) handleFlyoutEnter(item.id);
                }}
                onMouseLeave={() => {
                  setHoveredItem(null);
                  if (isCondensed && item.hasDropdown) handleFlyoutLeave();
                }}
                onFocus={() => setHoveredItem(item.id)}
                onBlur={() => setHoveredItem(null)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpenDropdowns((prev) => ({ ...prev, [item.id]: false }));
                    setFlyoutItem(null);
                  }
                }}
                aria-expanded={item.hasDropdown ? (dropdownOpen || flyoutItem === item.id) : undefined}
                aria-haspopup={item.hasDropdown ? "true" : undefined}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 12,
                  padding: "10px 12px",
                  backgroundColor: bg,
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  color: iconColor,
                  transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1), color 250ms cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative",
                }}
              >
                <span style={{ flexShrink: 0, display: "flex", color: iconColor, transition: "color 250ms cubic-bezier(0.4, 0, 0.2, 1)" }}>
                  {item.icon}
                </span>

                <span
                  style={{
                    flex: 1,
                    textAlign: "left",
                    fontSize: 14,
                    fontWeight: 500,
                    color: labelColor,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    transition: "color 250ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  {item.label}
                </span>

                {item.hasDropdown && (
                  <span style={{ color: "var(--color-text-muted)", display: "flex", flexShrink: 0 }}>
                    <DropdownArrow open={!!dropdownOpen} />
                  </span>
                )}

                {isCondensed && isHovered && !flyoutItem && (
                  <div
                    style={{
                      position: "absolute",
                      left: "calc(100% + 12px)",
                      top: "50%",
                      transform: "translateY(-50%)",
                      backgroundColor: "var(--color-surface-elevated)",
                      color: "var(--color-text-primary)",
                      fontSize: 13,
                      fontWeight: 500,
                      padding: "6px 12px",
                      borderRadius: 6,
                      whiteSpace: "nowrap",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                      zIndex: 120,
                      pointerEvents: "none",
                    }}
                  >
                    {item.label}
                  </div>
                )}
              </button>

              {expanded && item.hasDropdown && item.subItems && (
                <div
                  role="menu"
                  style={{
                    maxHeight: dropdownOpen ? item.subItems.length * 44 + 8 : 0,
                    opacity: dropdownOpen ? 1 : 0,
                    overflow: "hidden",
                    transition: "max-height 350ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                    paddingLeft: 20,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 30,
                      top: 4,
                      bottom: 12,
                      width: 1,
                      backgroundColor: "var(--color-border-subtle)",
                    }}
                  />

                  {item.subItems.map((sub) => {
                    const subActive = isSubItemActive(sub.id);
                    return (
                      <button
                        key={sub.id}
                        role="menuitem"
                        onClick={() => handleSubItemClick(sub.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          width: "100%",
                          padding: "8px 12px 8px 24px",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          backgroundColor: subActive ? "var(--color-surface-active)" : "transparent",
                          color: subActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                          fontSize: 13,
                          fontWeight: subActive ? 600 : 400,
                          transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1), color 250ms cubic-bezier(0.4, 0, 0.2, 1)",
                          position: "relative",
                        }}
                        onMouseEnter={(e) => {
                          if (!subActive) e.currentTarget.style.backgroundColor = "var(--color-surface-hover)";
                        }}
                        onMouseLeave={(e) => {
                          if (!subActive) e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            left: 10,
                            top: "50%",
                            width: 10,
                            height: 1,
                            backgroundColor: "var(--color-border-subtle)",
                          }}
                        />
                        <span style={{ flex: 1, textAlign: "left" }}>{sub.label}</span>
                        {subActive && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="4 2 8 6 4 10" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {isCondensed && item.hasDropdown && flyoutItem === item.id && item.subItems && (
                <div
                  ref={flyoutRef}
                  onMouseEnter={() => handleFlyoutEnter(item.id)}
                  onMouseLeave={handleFlyoutLeave}
                  style={{
                    position: "absolute",
                    left: "calc(100% + 8px)",
                    top: 0,
                    backgroundColor: "var(--color-surface-elevated)",
                    borderRadius: 10,
                    padding: "8px 0",
                    minWidth: 180,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                    zIndex: 120,
                  }}
                >
                  <div
                    style={{
                      padding: "6px 16px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--color-text-muted)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {item.label}
                  </div>
                  {item.subItems.map((sub) => {
                    const subActive = isSubItemActive(sub.id);
                    return (
                      <button
                        key={sub.id}
                        onClick={() => handleSubItemClick(sub.id)}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "8px 16px",
                          border: "none",
                          backgroundColor: subActive ? "var(--color-surface-active)" : "transparent",
                          color: subActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                          fontSize: 13,
                          cursor: "pointer",
                          transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                        onMouseEnter={(e) => {
                          if (!subActive) e.currentTarget.style.backgroundColor = "var(--color-surface-hover)";
                        }}
                        onMouseLeave={(e) => {
                          if (!subActive) e.currentTarget.style.backgroundColor = subActive ? "var(--color-surface-active)" : "transparent";
                        }}
                      >
                        {sub.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Settings — pinned to bottom */}
      <div style={{ padding: "0 8px", borderTop: "1px solid var(--color-border-subtle)" }}>
        {(() => {
          const item = SETTINGS_ITEM;
          const isHovered = hoveredItem === item.id;
          const iconColor = isHovered ? "var(--color-text-primary)" : "var(--color-text-muted)";
          const labelColor = isHovered ? "var(--color-text-primary)" : "var(--color-text-secondary)";
          return (
            <button
              onClick={() => handleNavClick(item)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 12,
                padding: "10px 12px",
                margin: "8px 0",
                backgroundColor: isHovered ? "var(--color-surface-hover)" : "transparent",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                color: iconColor,
                transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1), color 250ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <span style={{ flexShrink: 0, display: "flex", color: iconColor, transition: "color 250ms cubic-bezier(0.4, 0, 0.2, 1)" }}>
                {item.icon}
              </span>
              <span style={{
                flex: 1, textAlign: "left", fontSize: 14, fontWeight: 500,
                color: labelColor, whiteSpace: "nowrap", overflow: "hidden",
                transition: "color 250ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}>
                {item.label}
              </span>
              {isCondensed && isHovered && (
                <div style={{
                  position: "absolute", left: "calc(100% + 12px)", top: "50%", transform: "translateY(-50%)",
                  backgroundColor: "var(--color-surface-elevated)", color: "var(--color-text-primary)",
                  fontSize: 13, fontWeight: 500, padding: "6px 12px", borderRadius: 6,
                  whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.4)", zIndex: 120, pointerEvents: "none",
                }}>
                  {item.label}
                </div>
              )}
            </button>
          );
        })()}
      </div>

    </nav>
  );
}
