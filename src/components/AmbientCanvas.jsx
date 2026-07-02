import { useEffect, useRef } from "react";
import { prefersReducedMotion, isTouchPrimary } from "../lib/device.js";

const reduced = prefersReducedMotion;
// Heavy always-on ambiance (rAF particle canvas, animated light beams, holo
// scan-lines) is desktop-only. Touch/mobile keeps just the static gold orbs so
// the page stays cheap to composite. Desktop is unchanged.
const heavy = !reduced && !isTouchPrimary;

const STYLE_ID = "ds-ambient-css";

const AMBIENT_CSS = `
.ds-ambient-beam {
  position: fixed;
  top: -40%;
  width: 70px;
  height: 180%;
  background: linear-gradient(
    to bottom,
    rgba(212,175,55,0) 0%,
    rgba(212,175,55,0.065) 50%,
    rgba(212,175,55,0) 100%
  );
  filter: blur(14px);
  pointer-events: none;
}

.ds-ambient-beam:nth-child(1) {
  left: 22%;
  transform: rotate(-8deg);
  animation: dsBmSway 26s ease-in-out infinite;
}

.ds-ambient-beam:nth-child(2) {
  left: 56%;
  transform: rotate(6deg);
  width: 50px;
  animation: dsBmSway 37s ease-in-out infinite reverse;
  animation-delay: -11s;
}

.ds-ambient-beam:nth-child(3) {
  left: 81%;
  transform: rotate(-13deg);
  opacity: 0.7;
  animation: dsBmSway 21s ease-in-out infinite;
  animation-delay: -7s;
}

@keyframes dsBmSway {
  0%, 100% {
    transform: rotate(-8deg) scaleX(1);
    opacity: 0.55;
  }
  50% {
    transform: rotate(3deg) scaleX(1.45);
    opacity: 1;
  }
}

.ds-holo-scan {
  position: fixed;
  left: 0;
  right: 0;
  height: 1px;
  z-index: 3;
  background: linear-gradient(
    to right,
    rgba(212,175,55,0) 0%,
    rgba(212,175,55,0.26) 50%,
    rgba(212,175,55,0) 100%
  );
  pointer-events: none;
  animation: dsHoloUp 11s linear infinite;
}

.ds-holo-scan:nth-child(2) {
  animation-delay: -3.7s;
  opacity: 0.55;
}

.ds-holo-scan:nth-child(3) {
  animation-delay: -7.4s;
  opacity: 0.32;
}

@keyframes dsHoloUp {
  from { top: 100vh; }
  to   { top: -2px;  }
}

/* slow drifting gradient orbs — "moving gradients" */
.ds-amb-orb {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(100px);
}
.ds-amb-orb-1 {
  left: 4%; top: 14%;
  width: 42vw; height: 42vw; max-width: 560px; max-height: 560px;
  background: radial-gradient(circle, rgba(212,175,55,0.07) 0%, transparent 70%);
  animation: dsAmbOrb 34s ease-in-out infinite;
}
.ds-amb-orb-2 {
  right: 3%; bottom: 8%;
  width: 38vw; height: 38vw; max-width: 500px; max-height: 500px;
  background: radial-gradient(circle, rgba(120,160,220,0.05) 0%, transparent 70%);
  animation: dsAmbOrb 46s ease-in-out infinite;
  animation-delay: -14s;
}
@keyframes dsAmbOrb {
  0%, 100% { transform: translate(0, 0) scale(1);        opacity: 0.7; }
  33%      { transform: translate(5vw, -4vh) scale(1.08); opacity: 1;   }
  66%      { transform: translate(-4vw, 5vh) scale(0.96); opacity: 0.5; }
}
`;

export default function AmbientCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = AMBIENT_CSS;
      document.head.appendChild(style);
    }

    return () => {
      const existing = document.getElementById(STYLE_ID);
      if (existing) existing.remove();
    };
  }, []);

  useEffect(() => {
    if (!heavy) return; // no particle rAF on mobile / reduced-motion

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let rafId;
    let running = true;

    const PARTICLE_COUNT = 38;

    const goldColors = [
      [212, 175, 55],
      [230, 195, 80],
      [200, 160, 40],
    ];
    const silverBlueColors = [
      [160, 185, 220],
      [140, 170, 210],
      [180, 200, 235],
    ];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: PARTICLE_COUNT }, () => {
      const isGold = Math.random() < 0.55;
      const palette = isGold ? goldColors : silverBlueColors;
      const color = palette[Math.floor(Math.random() * palette.length)];

      return {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        radius: 0.4 + Math.random() * 1.3,
        speed: 0.04 + Math.random() * 0.18,
        sineAmp: 0.18 + Math.random() * 0.55,
        sineFreq: 0.005 + Math.random() * 0.018,
        sineOffset: Math.random() * Math.PI * 2,
        opacity: 0.06 + Math.random() * 0.16,
        color,
        frame: Math.random() * 1000,
      };
    });

    function draw() {
      if (!running) return;

      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.frame += 1;
        p.y -= p.speed;
        p.x += Math.sin(p.frame * p.sineFreq + p.sineOffset) * p.sineAmp * 0.05;

        if (p.y < -4) {
          p.y = window.innerHeight + 4;
          p.x = Math.random() * window.innerWidth;
          p.frame = Math.random() * 1000;
        }

        const [r, g, b] = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${p.opacity})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  if (reduced) return null;

  // Mobile: static gold orbs only (animation disabled → rastered once, not
  // re-composited each frame). Desktop: the full animated ambiance.
  const orbStyle = heavy ? undefined : { animation: "none" };

  return (
    <>
      {heavy && (
        <canvas
          ref={canvasRef}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2,
            pointerEvents: "none",
            width: "100%",
            height: "100%",
          }}
          aria-hidden="true"
        />
      )}

      {heavy && (
        <div aria-hidden="true" style={{ pointerEvents: "none" }}>
          <div className="ds-ambient-beam" />
          <div className="ds-ambient-beam" />
          <div className="ds-ambient-beam" />
        </div>
      )}

      {heavy && (
        <div aria-hidden="true" style={{ pointerEvents: "none" }}>
          <div className="ds-holo-scan" />
          <div className="ds-holo-scan" />
          <div className="ds-holo-scan" />
        </div>
      )}

      {/* gradient orbs — animated on desktop, static on mobile */}
      <div aria-hidden="true" style={{ pointerEvents: "none" }}>
        <div className="ds-amb-orb ds-amb-orb-1" style={orbStyle} />
        <div className="ds-amb-orb ds-amb-orb-2" style={orbStyle} />
      </div>
    </>
  );
}
