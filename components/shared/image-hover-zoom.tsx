'use client';

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ImageHoverZoomProps {
  src: string;
  alt: string;
  className?: string;
  zoomSize?: number;
}

export function ImageHoverZoom({ src, alt, className = '', zoomSize = 480 }: ImageHoverZoomProps) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  const handleMouseEnter = useCallback(() => setHover(true), []);
  const handleMouseLeave = useCallback(() => setHover(false), []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    let x = rect.right + 12;
    let y = rect.top;

    if (x + zoomSize > viewW) {
      x = rect.left - zoomSize - 12;
    }
    if (x < 8) x = 8;

    if (y + zoomSize > viewH) {
      y = viewH - zoomSize - 8;
    }
    if (y < 8) y = 8;

    setPos({ x, y });
  }, [zoomSize]);

  return (
    <>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={className}
        draggable={false}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      />
      {hover && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none rounded-lg overflow-hidden shadow-2xl shadow-black/60 border border-border/50 bg-black"
          style={{
            left: pos.x,
            top: pos.y,
            width: zoomSize,
            height: zoomSize * 1.5,
          }}
        >
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>,
        document.body,
      )}
    </>
  );
}
