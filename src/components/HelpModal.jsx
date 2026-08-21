import React from 'react';

const STEPS = [
  ['Upload the floor plan.', 'Any photo or export of the drawing works, as long as it is to scale.'],
  ['Add a room and draw its shape.', 'Drag rectangles over the room. Use several for an L-shape — they snap flush so no gaps are left. Leave out fitted kitchen units: you lay up to them, not under them.'],
  ['Pin one known length.', 'Switch to Select, tap an edge, type the length printed on the plan. Every other edge in every room resolves from it. Pin a second anywhere as a cross-check.'],
  ['Set the plank direction per room.', 'Usually along the longest wall, or toward the window.'],
  ['Calculate, then export the manual.', 'You get a job sheet with a key plan, one block per room, and a cut sheet to work through at the saw.'],
];

export default function HelpModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-bg open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2>How to use this</h2>
        <p className="lead">Trace your rooms on the plan, give it one real length, get a cut list and a laying order.</p>
        <ol>
          {STEPS.map(([title, detail]) => (
            <li key={title}><b>{title}</b> <span>{detail}</span></li>
          ))}
        </ol>
        <div className="aside">
          Your work saves itself in this browser and comes back on refresh. Use <b>Save file</b> to keep a copy or move it to another device.
        </div>
        <button className="btn primary wide close" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}
