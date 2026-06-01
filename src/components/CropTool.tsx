'use client';
import { useRef, useState, useEffect, useCallback } from 'react';

interface Rect { x: number; y: number; w: number; h: number }

interface Props {
  imageUrl: string;
  onCrop: (dataUrl: string) => void;
  onSkip: () => void;
}

export default function CropTool({ imageUrl, onCrop, onSkip }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0 });
  const hasSelection = rect && rect.w > 15 && rect.h > 15;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (rect && rect.w > 2 && rect.h > 2) {
      // Oscurecer afuera de la selección
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Restaurar la zona seleccionada
      ctx.drawImage(img,
        (rect.x / canvas.width) * img.width,
        (rect.y / canvas.height) * img.height,
        (rect.w / canvas.width) * img.width,
        (rect.h / canvas.height) * img.height,
        rect.x, rect.y, rect.w, rect.h
      );
      // Borde de selección
      ctx.strokeStyle = '#C8956C';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.setLineDash([]);
      // Esquinas
      const cs = 10;
      ctx.strokeStyle = '#C8956C';
      ctx.lineWidth = 3;
      [[rect.x, rect.y], [rect.x + rect.w, rect.y],
       [rect.x, rect.y + rect.h], [rect.x + rect.w, rect.y + rect.h]].forEach(([cx, cy]) => {
        ctx.beginPath();
        ctx.moveTo(cx - cs, cy); ctx.lineTo(cx + cs, cy);
        ctx.moveTo(cx, cy - cs); ctx.lineTo(cx, cy + cs);
        ctx.stroke();
      });
    }
  }, [rect]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement!;
      const maxW = parent.clientWidth;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      draw();
    };
    img.src = imageUrl;
  }, [imageUrl, draw]);

  useEffect(() => { draw(); }, [draw]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    return {
      x: Math.max(0, Math.min(canvas.width, (clientX - r.left) * scaleX)),
      y: Math.max(0, Math.min(canvas.height, (clientY - r.top) * scaleY)),
    };
  };

  const onStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pos = getPos(e);
    startRef.current = pos;
    setDragging(true);
    setRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const onMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    e.preventDefault();
    const pos = getPos(e);
    setRect({
      x: Math.min(startRef.current.x, pos.x),
      y: Math.min(startRef.current.y, pos.y),
      w: Math.abs(pos.x - startRef.current.x),
      h: Math.abs(pos.y - startRef.current.y),
    });
  };

  const onEnd = () => setDragging(false);

  const handleCrop = () => {
    if (!rect || !imgRef.current || rect.w < 15 || rect.h < 15) { onSkip(); return; }
    const canvas = canvasRef.current!;
    const img = imgRef.current;
    const out = document.createElement('canvas');
    // Mapea coordenadas del canvas display → imagen original
    const scaleX = img.width / canvas.width;
    const scaleY = img.height / canvas.height;
    out.width = Math.round(rect.w * scaleX);
    out.height = Math.round(rect.h * scaleY);
    const ctx = out.getContext('2d')!;
    ctx.drawImage(img,
      rect.x * scaleX, rect.y * scaleY, out.width, out.height,
      0, 0, out.width, out.height
    );
    onCrop(out.toDataURL('image/png'));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#8B7E74] text-center">
        Arrastra para seleccionar solo la zona de los ítems
      </p>
      <div className="rounded-xl overflow-hidden border border-[#E8E2D9] bg-black">
        <canvas
          ref={canvasRef}
          className="w-full block touch-none"
          style={{ cursor: 'crosshair' }}
          onMouseDown={onStart}
          onMouseMove={onMove}
          onMouseUp={onEnd}
          onTouchStart={onStart}
          onTouchMove={onMove}
          onTouchEnd={onEnd}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSkip}
          className="flex-1 border border-[#E8E2D9] text-[#8B7E74] rounded-xl py-2.5 text-sm hover:bg-[#FAF7F2] transition-colors"
        >
          Imagen completa
        </button>
        <button
          onClick={handleCrop}
          disabled={!hasSelection}
          className="flex-1 bg-[#1A1410] text-white rounded-xl py-2.5 text-sm disabled:opacity-30 hover:bg-[#2d2420] transition-colors"
        >
          {hasSelection ? 'Analizar selección ✓' : 'Selecciona una zona'}
        </button>
      </div>
    </div>
  );
}
