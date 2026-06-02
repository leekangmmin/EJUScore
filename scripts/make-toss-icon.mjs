// Toss-style app icon generator
// 토스 블루 스퀴클 배경 + 흰색 성장(성적 추이) 차트 라인
// SVG → PNG (sharp) → icon-512 / icon-192 / icon-1024 + favicon.svg
import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pub = join(__dirname, '../public');

// 1024 기준 마스터 SVG (배경 스퀴클은 macOS Big Sur 가이드(여백 ~96px)에 맞춤)
const APP_SVG = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4E97FF"/>
      <stop offset="1" stop-color="#1F6BEB"/>
    </linearGradient>
  </defs>
  <rect x="96" y="96" width="832" height="832" rx="208" ry="208" fill="url(#bg)"/>
  <rect x="96" y="96" width="832" height="832" rx="208" ry="208" fill="#ffffff" opacity="0.06"/>
  <path d="M 290 664 L 432 556 L 560 620 L 742 372 L 742 720 L 290 720 Z" fill="#ffffff" opacity="0.16"/>
  <polyline points="290,664 432,556 560,620 742,372" fill="none" stroke="#ffffff"
    stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="742" cy="372" r="40" fill="#ffffff"/>
  <circle cx="742" cy="372" r="19" fill="#2272EB"/>
</svg>`;

// 모서리가 투명한 정사각(파비콘/PWA) — 둥근 사각은 OS/브라우저가 처리
const buf = Buffer.from(APP_SVG);

const targets = [
  { name: 'icon-1024.png', size: 1024 },
  { name: 'icon-512.png',  size: 512  },
  { name: 'icon-192.png',  size: 192  },
];

for (const t of targets) {
  await sharp(buf, { density: 384 })
    .resize(t.size, t.size)
    .png()
    .toFile(join(pub, t.name));
  console.log(`✅ ${t.name} (${t.size}px)`);
}

writeFileSync(join(pub, 'favicon.svg'), APP_SVG);
console.log('✅ favicon.svg');
