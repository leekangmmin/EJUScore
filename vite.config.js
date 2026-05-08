// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
})
