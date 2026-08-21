import { useState, useEffect, useRef, type ReactNode } from 'react';

/** A `?` that explains something on hover, and on tap for touch. */
export default function Tooltip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);
  return (
    <span ref={ref} className={`ti${open ? ' open' : ''}`} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
      ?<span className="tip">{children}</span>
    </span>
  );
}
