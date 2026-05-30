/**
 * polyfills.js — 구형 Chromium(Electron) 호환 폴리필
 * pdfjs-dist v5+ 가 사용하는 Uint8Array hex/base64 메서드는
 * Chromium 134(Electron 35)에 아직 없어 'a.toHex is not a function' 오류 발생.
 * 반드시 다른 모듈보다 먼저 import 되어야 함 (main.jsx 최상단).
 */
const HEX = [];
for (let i = 0; i < 256; i++) HEX[i] = i.toString(16).padStart(2, '0');

const U8 = typeof Uint8Array !== 'undefined' ? Uint8Array.prototype : null;

if (U8) {
  /* ── toHex ── */
  if (typeof U8.toHex !== 'function') {
    Object.defineProperty(U8, 'toHex', {
      value: function toHex() {
        let s = '';
        for (let i = 0; i < this.length; i++) s += HEX[this[i]];
        return s;
      },
      writable: true, configurable: true,
    });
  }

  /* ── setFromHex ── */
  if (typeof U8.setFromHex !== 'function') {
    Object.defineProperty(U8, 'setFromHex', {
      value: function setFromHex(str) {
        const len = Math.floor(str.length / 2);
        for (let i = 0; i < len; i++) this[i] = parseInt(str.substr(i * 2, 2), 16);
        return { read: len * 2, written: len };
      },
      writable: true, configurable: true,
    });
  }

  /* ── toBase64 ── */
  if (typeof U8.toBase64 !== 'function') {
    Object.defineProperty(U8, 'toBase64', {
      value: function toBase64() {
        let bin = '';
        for (let i = 0; i < this.length; i++) bin += String.fromCharCode(this[i]);
        return typeof btoa !== 'undefined' ? btoa(bin) : '';
      },
      writable: true, configurable: true,
    });
  }

  /* ── setFromBase64 ── */
  if (typeof U8.setFromBase64 !== 'function') {
    Object.defineProperty(U8, 'setFromBase64', {
      value: function setFromBase64(str) {
        const bin = typeof atob !== 'undefined' ? atob(str) : '';
        const len = Math.min(bin.length, this.length);
        for (let i = 0; i < len; i++) this[i] = bin.charCodeAt(i);
        return { read: len, written: len };
      },
      writable: true, configurable: true,
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   Map / WeakMap.prototype.getOrInsert(Computed)
   TC39 신규 제안 — pdfjs-dist v5.7+ 의 getOptionalContentConfig/render
   가 사용하나 Chromium 134(Electron 35)에 미탑재 →
   "this[#t].getOrInsertComputed is not a function" 로 PDF 렌더 크래시.
══════════════════════════════════════════════════════════════ */
for (const Ctor of [typeof Map !== 'undefined' ? Map : null,
                    typeof WeakMap !== 'undefined' ? WeakMap : null]) {
  if (!Ctor) continue;
  const proto = Ctor.prototype;
  if (typeof proto.getOrInsert !== 'function') {
    Object.defineProperty(proto, 'getOrInsert', {
      value: function getOrInsert(key, value) {
        if (this.has(key)) return this.get(key);
        this.set(key, value);
        return value;
      },
      writable: true, configurable: true,
    });
  }
  if (typeof proto.getOrInsertComputed !== 'function') {
    Object.defineProperty(proto, 'getOrInsertComputed', {
      value: function getOrInsertComputed(key, callbackfn) {
        if (this.has(key)) return this.get(key);
        const v = callbackfn(key);
        this.set(key, v);
        return v;
      },
      writable: true, configurable: true,
    });
  }
}

/* ── 정적 메서드: Uint8Array.fromHex / fromBase64 ── */
if (typeof Uint8Array !== 'undefined') {
  if (typeof Uint8Array.fromHex !== 'function') {
    Object.defineProperty(Uint8Array, 'fromHex', {
      value: function fromHex(str) {
        const len = Math.floor(str.length / 2);
        const out = new Uint8Array(len);
        for (let i = 0; i < len; i++) out[i] = parseInt(str.substr(i * 2, 2), 16);
        return out;
      },
      writable: true, configurable: true,
    });
  }
  if (typeof Uint8Array.fromBase64 !== 'function') {
    Object.defineProperty(Uint8Array, 'fromBase64', {
      value: function fromBase64(str) {
        const bin = typeof atob !== 'undefined' ? atob(str) : '';
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
      },
      writable: true, configurable: true,
    });
  }
}
