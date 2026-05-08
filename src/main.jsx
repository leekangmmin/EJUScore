// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

console.info(
  '%c EJU Score Tracker %c © 2025 이강민 (Lee Kangmin) %c github.com/leekangmmin/EJUScore ',
  'background:#4f8ef7;color:#fff;font-weight:700;padding:2px 6px;border-radius:4px 0 0 4px',
  'background:#1e1e2e;color:#a6e3a1;font-weight:600;padding:2px 6px',
  'background:#313244;color:#89b4fa;padding:2px 6px;border-radius:0 4px 4px 0'
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
