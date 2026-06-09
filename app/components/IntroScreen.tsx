"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface IntroScreenProps {
  onComplete: () => void;
}

export default function IntroScreen({ onComplete }: IntroScreenProps) {
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeInTimer  = setTimeout(() => setFadeIn(true),  1000);
    const fadeOutTimer = setTimeout(() => setFadeOut(true), 3500);
    const doneTimer    = setTimeout(() => onComplete(),     4000);
    return () => {
      clearTimeout(fadeInTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 1, backgroundColor: "#ffffff" }}
    >
      <div
        className="intro-logo"
        style={{
          opacity: fadeOut ? 0 : fadeIn ? 1 : 0,
          transition: fadeOut ? "opacity 0.5s ease" : "opacity 0.8s ease",
          gap: "16px",
        }}
      >
        {/* JK icon-mark */}
        <Image
          src="/jk-icon.svg"
          alt="JR Property Cleanup"
          width={80}
          height={80}
          priority
          unoptimized
          style={{ height: 80, width: "auto", display: "block" }}
        />

        {/* Brand name */}
        <div style={{ textAlign: "center" }}>
          <p style={{
            color: "#1a3a5c",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
            margin: 0,
          }}>
            JR Property Cleanup
          </p>
          <p style={{
            color: "#4a90d9",
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            margin: "4px 0 0",
          }}>
            Quote Tool
          </p>
        </div>
      </div>
    </div>
  );
}
