import { useState } from 'react';
import { ProjectProvider, useProject } from './state/store';
import PlanPanel from './components/PlanPanel';
import MaterialPanel from './components/MaterialPanel';
import RoomList from './components/RoomList';
import Results from './components/Results';
import HelpModal from './components/HelpModal';
import { buildReport } from './report/buildReport';

/**
 * Opening the manual.
 *
 * A new tab that prints itself is the good path. A sandboxed or popup-blocked
 * frame is common enough on mobile that the fallback — hand over a file the user
 * opens themselves — has to be a first-class path, not an afterthought.
 */
function useManualExport() {
  const { derivedRooms, state, scale } = useProject();
  const [note, setNote] = useState<string | null>(null);
  const open = () => {
    const html = buildReport(derivedRooms, state.material, scale.pxPerM);
    if (!html) { setNote('Nothing to print yet — trace a room and pin one known length.'); return; }
    let win: Window | null = null;
    try { win = window.open('', '_blank'); } catch { /* blocked */ }
    if (win && win.document) { win.document.open(); win.document.write(html); win.document.close(); return; }
    try {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'flooring-manual.html';
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
      setNote('Downloaded flooring-manual.html — open it and the print dialog appears on its own. Choose Save as PDF.');
    } catch {
      setNote('This browser blocked both printing and downloading. Open the planner in a normal tab and try again.');
    }
  };
  return { open, note };
}

function Shell() {
  const { state, plan } = useProject();
  const [help, setHelp] = useState(false);
  const manual = useManualExport();

  return (
    <div className="sheet">
      <header className="top">
        <div>
          <h1>Plank Planner</h1>
          <div className="sub">{state.saveNote}</div>
        </div>
        <button className="btn" onClick={() => setHelp(true)}>How to use</button>
      </header>

      <PlanPanel />
      <MaterialPanel />
      <RoomList />

      <div className="btnrow">
        <button className="btn" style={{ flex: 1, borderColor: 'var(--blue)', color: 'var(--blue)' }} onClick={manual.open}>
          Manual PDF
        </button>
      </div>
      {manual.note && <div className="note-box">{manual.note}</div>}

      {plan.empty
        ? <div className="warn-box">Nothing to lay yet. Trace a room on the plan and pin one known edge length.</div>
        : <Results />}

      <HelpModal open={help} onClose={() => setHelp(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ProjectProvider>
      <Shell />
    </ProjectProvider>
  );
}
