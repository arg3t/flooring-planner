import React, { useState, useEffect, useRef } from 'react';

/** A `?` that explains something on hover, and on tap for touch. */
export default function Tooltip({ children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);
  return (
    <span ref={ref} className={`ti${open ? ' open' : ''}`} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
      ?<span className="tip">{children}</span>
    </span>
  );
}
