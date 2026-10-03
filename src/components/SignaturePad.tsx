"use client";

import { useEffect, useRef } from "react";

/** Lienzo de firma. Deja el PNG en un input oculto al terminar cada trazo. */
export function SignaturePad({ name }: { name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const g = c.getContext("2d")!;
    g.scale(ratio, ratio);
    g.lineWidth = 2.2;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "#111";
  }, []);

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div className="sigpad">
      <canvas
        ref={canvas}
        aria-label="Espacio para firmar"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const g = e.currentTarget.getContext("2d")!;
          g.beginPath();
          g.moveTo(...at(e));
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const g = e.currentTarget.getContext("2d")!;
          g.lineTo(...at(e));
          g.stroke();
        }}
        onPointerUp={(e) => {
          drawing.current = false;
          if (input.current) input.current.value = e.currentTarget.toDataURL("image/png");
        }}
      />
      <input ref={input} type="hidden" name={name} />
      <button
        type="button"
        className="secondary small"
        onClick={() => {
          const c = canvas.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          if (input.current) input.current.value = "";
        }}
      >
        Borrar
      </button>
    </div>
  );
}
