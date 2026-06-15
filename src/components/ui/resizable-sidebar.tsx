import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface ResizableSidebarProps {
  children: React.ReactNode;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey: string;
  className?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function loadWidth(
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return clamp(parseInt(saved, 10) || fallback, min, max);
  } catch {
    // ignore
  }
  return fallback;
}

export function ResizableSidebar({
  children,
  defaultWidth,
  minWidth = 180,
  maxWidth = 600,
  storageKey,
  className,
}: ResizableSidebarProps) {
  const [width, setWidth] = useState(() =>
    loadWidth(storageKey, defaultWidth, minWidth, maxWidth),
  );
  const widthRef = useRef(width);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  widthRef.current = width;

  useEffect(() => {
    setWidth(loadWidth(storageKey, defaultWidth, minWidth, maxWidth));
  }, [storageKey, defaultWidth, minWidth, maxWidth]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = widthRef.current;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = e.clientX - startX.current;
        const newWidth = clamp(startWidth.current + delta, minWidth, maxWidth);
        setWidth(newWidth);
        widthRef.current = newWidth;
      };

      const handleMouseUp = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        try {
          localStorage.setItem(storageKey, String(widthRef.current));
        } catch {
          // ignore
        }
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [minWidth, maxWidth, storageKey],
  );

  return (
    <div
      className={cn('relative flex h-full shrink-0', className)}
      style={{ width }}
    >
      {children}
      <div
        className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-primary/20 active:bg-primary/30"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
