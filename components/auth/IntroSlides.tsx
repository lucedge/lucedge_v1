"use client";

import { useEffect, useRef, useState } from "react";

const SLIDES = [
  {
    headline: "Know why you really lose.",
    sub: "Most traders fail from 8 repeating behavioral loops — not bad strategy. LuceEdge detects them.",
    icon: "🔍",
  },
  {
    headline: "Every trade tells a story.",
    sub: "Log in seconds. Your journal builds a picture of how you actually trade, not how you think you do.",
    icon: "📓",
  },
  {
    headline: "Your patterns, not theirs.",
    sub: "No generic tips. Insights are built from your own trade history.",
    icon: "📊",
  },
] as const;

const AUTO_MS = 4000;

interface Props {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export function IntroSlides({ onGetStarted, onSignIn }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [animDir, setAnimDir] = useState<"left" | "right">("left");
  const [animating, setAnimating] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = (next: number, dir: "left" | "right") => {
    if (animating) return;
    setAnimDir(dir);
    setAnimating(true);
    setTimeout(() => {
      setIndex(next);
      setAnimating(false);
    }, 200);
  };

  useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(() => {
      goTo((index + 1) % SLIDES.length, "left");
    }, AUTO_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [index, paused]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) {
      goTo((index + 1) % SLIDES.length, "left");
    } else {
      goTo((index - 1 + SLIDES.length) % SLIDES.length, "right");
    }
  };

  const slide = SLIDES[index];
  const translateX = animating ? (animDir === "left" ? "-8px" : "8px") : "0px";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--surface-0)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Logo */}
      <div style={{ position: "absolute", top: 28, left: 24, display: "flex", alignItems: "center", gap: 8 }}>
        <img src="/assets/mark.svg" alt="" width={28} height={28} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--fg-1)", letterSpacing: "-.02em", fontFamily: "var(--font-sans)" }}>
          LuceEdge
        </span>
      </div>

      {/* Slide content */}
      <div
        style={{
          maxWidth: 380,
          width: "100%",
          textAlign: "center",
          transition: "opacity 200ms var(--ease), transform 200ms var(--ease)",
          opacity: animating ? 0 : 1,
          transform: `translateX(${translateX})`,
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 28, lineHeight: 1 }}>{slide.icon}</div>
        <h1
          style={{
            fontSize: "clamp(24px, 6vw, 32px)",
            fontWeight: 700,
            color: "var(--fg-1)",
            letterSpacing: "-.025em",
            lineHeight: 1.15,
            margin: "0 0 16px",
            fontFamily: "var(--font-sans)",
          }}
        >
          {slide.headline}
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "var(--fg-3)",
            lineHeight: 1.6,
            margin: 0,
            fontFamily: "var(--font-sans)",
          }}
        >
          {slide.sub}
        </p>
      </div>

      {/* Dot indicator */}
      <div style={{ display: "flex", gap: 6, marginTop: 40 }}>
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => { setPaused(true); goTo(i, i > index ? "left" : "right"); }}
            aria-label={`Slide ${i + 1}`}
            style={{
              height: 6,
              width: i === index ? 18 : 6,
              borderRadius: "var(--radius-full)",
              background: i === index ? "var(--brand-blue)" : "var(--border-2)",
              border: "none",
              padding: 0,
              cursor: "pointer",
              transition: "width 300ms var(--ease), background 300ms var(--ease)",
            }}
          />
        ))}
      </div>

      {/* Fixed bottom CTAs */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 24px max(24px, env(safe-area-inset-bottom))",
          background: "linear-gradient(to top, var(--surface-0) 80%, transparent)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "center",
        }}
      >
        <button
          onClick={onGetStarted}
          style={{
            width: "100%",
            maxWidth: "min(480px, 100%)",
            height: 50,
            background: "var(--brand-blue)",
            border: "none",
            borderRadius: "var(--radius-md)",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
            cursor: "pointer",
            letterSpacing: "-.01em",
          }}
        >
          Get started
        </button>
        <button
          onClick={onSignIn}
          style={{
            background: "none",
            border: "none",
            color: "var(--fg-3)",
            fontSize: 13,
            fontFamily: "var(--font-sans)",
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          Already have an account? <span style={{ color: "var(--brand-blue)" }}>Sign in</span>
        </button>
      </div>
    </div>
  );
}
