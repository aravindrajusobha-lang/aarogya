import React, { useEffect, useRef, useState } from 'react';

/*
  AarogyaDrishtiIntro
  - Pure React + HTML5 Canvas medical iris & scanning trace intro animation.
  - "Drishti" means sight; this represents early community vision & oral health checkups.
  - Fully accessible, supports prefers-reduced-motion, skip button, and unmounts cleanly.
*/

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@200;300;500&display=swap');
.adx-root {
  position: fixed;
  inset: 0;
  z-index: 9999;
  overflow: hidden;
  font-family: 'Sora', system-ui, -apple-system, 'Segoe UI', 'Nirmala UI', sans-serif;
  color: #d7efe3;
  background:
    radial-gradient(60% 50% at 82% 30%, #1b2a0e 0%, transparent 70%),
    radial-gradient(80% 60% at 18% 8%, #06402b 0%, transparent 65%),
    #010d08;
  transition: opacity .8s ease, visibility .8s;
}
.adx-root.adx-leave {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
.adx-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.adx-copy {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 11vh;
  text-align: center;
  padding: 0 24px;
  opacity: 0;
  animation: adx-in 1.2s ease 1.4s forwards;
}
.adx-title {
  margin: 0;
  font-weight: 200;
  font-size: clamp(30px, 5.2vw, 64px);
  letter-spacing: .14em;
  line-height: 1.1;
}
.adx-te {
  margin: 10px 0 0;
  font-weight: 300;
  font-size: clamp(16px, 2vw, 24px);
  color: #9fe3c0;
  letter-spacing: .06em;
}
.adx-tag {
  margin: 18px 0 0;
  font-weight: 300;
  font-size: clamp(13px, 1.3vw, 16px);
  color: #9db8aa;
  letter-spacing: .04em;
}
.adx-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: 100%;
  transform-origin: left;
  background: linear-gradient(90deg, #1fd18b, #c8e66a);
  animation: adx-bar linear forwards;
}
.adx-skip {
  position: absolute;
  right: 24px;
  bottom: 22px;
  background: rgba(1, 13, 8, 0.85);
  color: #d7efe3;
  border: 1px solid rgba(159, 227, 192, .6);
  border-radius: 999px;
  padding: 10px 20px;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all .2s;
  z-index: 100000;
  box-shadow: 0 4px 14px rgba(0,0,0,0.5);
}
.adx-skip:hover {
  color: #d7efe3;
  border-color: rgba(200, 230, 106, .7);
}
.adx-skip:focus-visible {
  outline: 2px solid #c8e66a;
  outline-offset: 3px;
}
@keyframes adx-in {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}
@keyframes adx-bar {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@media (prefers-reduced-motion: reduce) {
  .adx-copy { animation-duration: .01s; animation-delay: 0s; }
}
`;

export interface AarogyaDrishtiIntroProps {
  duration?: number;
  onComplete?: () => void;
}

export const AarogyaDrishtiIntro: React.FC<AarogyaDrishtiIntroProps> = ({
  duration = 5200,
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef<boolean>(false);
  const cbRef = useRef<(() => void) | undefined>(onComplete);
  const [leaving, setLeaving] = useState<boolean>(false);
  const [gone, setGone] = useState<boolean>(false);

  useEffect(() => {
    cbRef.current = onComplete;
  }, [onComplete]);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    setTimeout(() => {
      setGone(true);
      if (typeof cbRef.current === 'function') {
        cbRef.current();
      }
    }, 800);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') {
        finish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(finish, duration);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0;
    let h = 0;
    let raf = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onMove = (e: MouseEvent) => {
      if (!w || !h) return;
      mouse.tx = (e.clientX / w - 0.5) * 2;
      mouse.ty = (e.clientY / h - 0.5) * 2;
    };

    const fibers = Array.from({ length: 220 }, () => ({
      a: Math.random() * Math.PI * 2,
      r0: 0.3 + Math.random() * 0.08,
      r1: 0.68 + Math.random() * 0.32,
      al: 0.08 + Math.random() * 0.22,
      k: Math.random(),
    }));

    const motes = Array.from({ length: 140 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 0.45 + Math.random() * 0.9,
      s: (0.08 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1),
      z: Math.random(),
    }));

    const ecg = (d: number) =>
      Math.exp(-Math.pow((d + 0.03) * 55, 2)) -
      0.45 * Math.exp(-Math.pow((d + 0.08) * 70, 2)) +
      0.22 * Math.exp(-Math.pow((d + 0.22) * 16, 2));

    const draw = (t: number) => {
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      ctx.clearRect(0, 0, w, h);

      const R = Math.min(w, h) * 0.26;
      const open = reduce ? 1 : Math.min(1, t / 1.4);
      const ease = 1 - Math.pow(1 - open, 3);
      const Re = R * ease;
      const cx = w / 2 + mouse.x * R * 0.04;
      const cy = h * 0.38 + mouse.y * R * 0.04;

      // iris body
      const body = ctx.createRadialGradient(cx, cy, Re * 0.25, cx, cy, Re * 1.05);
      body.addColorStop(0, 'rgba(6,64,43,0.95)');
      body.addColorStop(1, 'rgba(6,64,43,0)');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, Re * 1.05, 0, Math.PI * 2);
      ctx.fill();

      // fibres
      ctx.lineWidth = 1;
      for (const f of fibers) {
        const a = f.a + t * 0.05;
        const r = Math.round(31 + (200 - 31) * f.k);
        const g = Math.round(209 + (230 - 209) * f.k);
        const b = Math.round(139 + (106 - 139) * f.k);
        ctx.strokeStyle = `rgba(${r},${g},${b},${f.al * ease})`;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * Re * f.r0, cy + Math.sin(a) * Re * f.r0);
        ctx.lineTo(cx + Math.cos(a) * Re * f.r1, cy + Math.sin(a) * Re * f.r1);
        ctx.stroke();
      }

      // limbal ring
      ctx.strokeStyle = `rgba(200,230,106,${0.45 * ease})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, Re, 0, Math.PI * 2);
      ctx.stroke();

      // dashed orbit rings
      const rings = [
        { k: 1.18, dir: 1, al: 0.35 },
        { k: 1.34, dir: -1, al: 0.25 },
      ];
      for (const rg of rings) {
        ctx.setLineDash([Re * 0.08, Re * 0.05]);
        ctx.lineDashOffset = -t * 30 * rg.dir;
        ctx.strokeStyle = `rgba(31,209,139,${rg.al * ease})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, Re * rg.k, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // tick ring
      ctx.lineWidth = 1;
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2 + t * 0.03;
        const long = i % 8 === 0;
        const r0 = Re * 1.5;
        const r1 = r0 + Re * (long ? 0.1 : 0.04);
        ctx.strokeStyle = `rgba(159,227,192,${(long ? 0.5 : 0.25) * ease})`;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.stroke();
      }

      // scan sweep
      if (typeof ctx.createConicGradient === 'function') {
        const sweep = ctx.createConicGradient(t * 1.2, cx, cy);
        sweep.addColorStop(0, `rgba(31,209,139,${0.35 * ease})`);
        sweep.addColorStop(0.12, 'rgba(31,209,139,0)');
        sweep.addColorStop(1, 'rgba(31,209,139,0)');
        ctx.fillStyle = sweep;
        ctx.beginPath();
        ctx.arc(cx, cy, Re * 1.0, 0, Math.PI * 2);
        ctx.fill();
      }

      // motes
      for (const m of motes) {
        const a = m.a + t * m.s;
        const x = cx + Math.cos(a) * Re * m.r * 1.2;
        const y = cy + Math.sin(a) * Re * m.r * 1.2 * 0.92;
        ctx.fillStyle = `rgba(200,230,106,${(0.15 + m.z * 0.5) * ease})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.8 + m.z * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // pupil with heartbeat
      const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 1.2)), 12);
      const px = cx + mouse.x * Re * 0.1;
      const py = cy + mouse.y * Re * 0.1;
      const pr = Re * 0.27 * (1 + 0.06 * beat);
      const glow = ctx.createRadialGradient(px, py, pr * 0.6, px, py, pr * 2.2);
      glow.addColorStop(0, `rgba(200,230,106,${0.25 * ease})`);
      glow.addColorStop(1, 'rgba(200,230,106,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, pr * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#010d08';
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(200,230,106,${0.6 * ease})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // heartbeat trace across the eye
      const W = Re * 2.1;
      const head = reduce ? 0.2 : ((t * 0.45) % 1.25) * 2 - 1;
      let lx: number | null = null;
      let ly: number | null = null;
      ctx.lineWidth = 1.8;
      for (let x = cx - W; x <= cx + W; x += 4) {
        const d = (x - cx) / W - head;
        if (d > 0 || d < -0.9) {
          lx = null;
          continue;
        }
        const y = cy - ecg(d) * Re * 0.3;
        if (lx !== null && ly !== null) {
          ctx.strokeStyle = `rgba(200,230,106,${(1 + d / 0.9) * 0.9 * ease})`;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        lx = x;
        ly = y;
      }
    };

    resize();
    const start = performance.now();
    const loop = (now: number) => {
      draw((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };

    if (reduce) {
      draw(2);
    } else {
      raf = requestAnimationFrame(loop);
    }

    const onResize = () => {
      resize();
      if (reduce) draw(2);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      className={`adx-root${leaving ? ' adx-leave' : ''}`}
      role="status"
      aria-label="Aarogya Drishti is loading"
      onClick={finish}
    >
      <style>{CSS}</style>
      <canvas ref={canvasRef} className="adx-canvas" />
      <div className="adx-copy">
        <h1 className="adx-title">Aarogya Drishti</h1>
        <p className="adx-te" lang="te">
          ఆరోగ్య దృష్టి
        </p>
        <p className="adx-tag">See early. Reach every village.</p>
      </div>
      <button type="button" className="adx-skip" onClick={finish}>
        Skip intro
      </button>
      <div className="adx-bar" style={{ animationDuration: `${duration}ms` }} />
    </div>
  );
};

export default AarogyaDrishtiIntro;

