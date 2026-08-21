import { useProject } from '../state/store';
import { islands, roomArea } from '../core/geometry';
import ShapeEditor from './ShapeEditor';

export default function RoomList() {
  const { state, dispatch, scale, derivedRooms } = useProject();
  return (
    <section className="panel">
      <h2><span className="n">03</span> Rooms</h2>
      {!state.rooms.length && <div className="note-box" style={{ margin: '0 0 10px' }}>No rooms yet.</div>}
      {state.rooms.map((room, i) => {
        const derived = derivedRooms[i];
        const pieces = islands(room).length;
        return (
          <div className="room-card" key={room.id}>
            <div className="row-top">
              <input
                className="room-name-input" value={room.name}
                onChange={(e) => dispatch({ type: 'patchRoom', id: room.id, patch: { name: e.target.value } })}
              />
              <button className="x-btn" onClick={() => dispatch({ type: 'removeRoom', id: room.id })}>✕</button>
            </div>
            <div className="areacheck">
              <b>{scale.pxPerM && derived ? `${roomArea(derived).toFixed(2)} m²` : '— m²'}</b> · {room.shapes.length} shape(s)
              {pieces > 1 && <><br /><span className="bad">⚠ {pieces} disconnected pieces — drag them together until they snap</span></>}
            </div>
            <ShapeEditor room={room} />
            <div className="dir-toggle">
              <button className={room.dir === 'x' ? 'active' : ''} onClick={() => dispatch({ type: 'patchRoom', id: room.id, patch: { dir: 'x' } })}>planks ↔ horizontal</button>
              <button className={room.dir === 'y' ? 'active' : ''} onClick={() => dispatch({ type: 'patchRoom', id: room.id, patch: { dir: 'y' } })}>planks ↕ vertical</button>
            </div>
            <label className="skip-toggle">
              <input type="checkbox" checked={room.skip}
                onChange={(e) => dispatch({ type: 'patchRoom', id: room.id, patch: { skip: e.target.checked } })} />
              Skip this room
            </label>
          </div>
        );
      })}
      <button className="btn ghost wide" onClick={() => dispatch({ type: 'addRoom' })}>+ Add room</button>
    </section>
  );
}
