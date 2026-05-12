// Icon generator: PNG → .ico (Windows) + copies for build
import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPng = join(__dirname, '../public/icon-512.png');
const outIco = join(__dirname, '../public/icon.ico');

const buf = readFileSync(srcPng);

pngToIco([buf])
  .then(ico => {
    writeFileSync(outIco, ico);
    console.log('✅ public/icon.ico generated');
  })
  .catch(err => {
    console.error('❌ Icon generation failed:', err.message);
    process.exit(1);
  });
