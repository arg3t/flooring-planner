import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

/**
 * The bundle is inlined as a classic script so the file opens straight from
 * disk, and a classic inline script runs the moment it is parsed — possibly
 * before #root exists. Waiting for the document to finish parsing is the
 * dependable fix; rewriting the bundle's position in the HTML is not, because
 * the bundle text contains strings that look like script tags.
 */
function mount() {
  const el = document.getElementById('root');
  if (!el) return;
  createRoot(el).render(<React.StrictMode><App /></React.StrictMode>);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
