import React from 'react';
import { useProject } from '../state/store.jsx';
import Tooltip from './Tooltip.jsx';

const FIELDS = [
  ['plankLen', 'Plank length mm'], ['plankWid', 'Plank width mm'],
  ['packArea', 'm² per pack'], ['packPrice', '€ per pack'],
  ['gap', 'Wall gap mm'], ['kerf', 'Saw kerf mm'],
  ['minPiece', 'Min piece mm'], ['minStagger', 'Min stagger mm'],
];

export default function MaterialPanel() {
  const { state, dispatch } = useProject();
  return (
    <section className="panel">
      <h2><span className="n">02</span> Material
        <Tooltip>Plank and pack size come off the product page. The gap is left at every wall for expansion; kerf is the width the blade removes, so one plank never yields two exact halves.</Tooltip>
      </h2>
      <div className="grid4">
        {FIELDS.map(([key, label]) => (
          <div className="field" key={key}>
            <label htmlFor={`mat-${key}`}>{label}</label>
            <input
              id={`mat-${key}`} type="number" step={key === 'packArea' || key === 'packPrice' ? '0.01' : '1'}
              value={state.material[key]}
              onChange={(e) => dispatch({ type: 'setMaterial', key, value: +e.target.value })}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
