#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// PHASE 2 effectiveness audit — before(backup) vs after(current), by id.
// Emits PHASE2_EFFECTIVENESS_REPORT.md with exact domain counts, recovered
// vs relabeled-only, confidence distribution, and effective coverage.
// ═══════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BK = (fs.existsSync('/tmp/eju_backup_dir.txt')
  ? fs.readFileSync('/tmp/eju_backup_dir.txt', 'utf8').trim()
  : fs.readdirSync(path.join(ROOT, 'dataset')).filter((d) => d.startsWith('_backup_repair_')).sort().pop());
const BKDIR = path.isAbsolute(BK) ? BK : path.join(ROOT, BK);
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const VALID = ['economy', 'politics', 'history', 'geography', 'society'];

function perExam(base) {
  const dir = path.join(base, 'dataset/comprehensive');
  const out = [];
  for (const y of fs.readdirSync(dir).filter((d) => /^20/.test(d))) {
    for (const f of fs.readdirSync(path.join(dir, y))) {
      if (!/^exam_.*\.json$/.test(f)) continue;
      for (const q of J(path.join(dir, y, f)).questions || []) out.push(q);
    }
  }
  return out;
}
function consolidated(base) {
  const p = path.join(base, 'dataset/comprehensive/dataset_consolidated.json');
  return fs.existsSync(p) ? J(p).exams.flatMap((e) => e.questions || []) : [];
}

function normDomain(d) {
  if (d === undefined || d === null || d === '') return 'unknown';
  return d;
}
function countDomains(recs) {
  const c = { economy: 0, politics: 0, history: 0, geography: 0, society: 0, unknown: 0, review_required: 0, other: 0 };
  for (const r of recs) {
    const d = normDomain(r.domain);
    if (d in c) c[d]++; else c.other++;
  }
  return c;
}
function coverage(c, total) {
  const valid = VALID.reduce((s, k) => s + c[k], 0);
  return { valid, total, pct: total ? +(100 * valid / total).toFixed(2) : 0 };
}

function auditDataset(name, before, after) {
  const beforeById = new Map(before.map((r) => [r.id, r]));
  let recovered = 0, relabeled = 0, stillUnknown = 0, wasUnknown = 0;
  const recoveredTo = {};
  const confBuckets = { '0.0-0.2': 0, '0.2-0.4': 0, '0.4-0.6': 0, '0.6-0.8': 0, '0.8-1.0': 0 };
  for (const a of after) {
    const b = beforeById.get(a.id);
    if (!b || normDomain(b.domain) !== 'unknown') continue;
    wasUnknown++;
    if (typeof a.domain_confidence === 'number') {
      const c = a.domain_confidence;
      const k = c < 0.2 ? '0.0-0.2' : c < 0.4 ? '0.2-0.4' : c < 0.6 ? '0.4-0.6' : c < 0.8 ? '0.6-0.8' : '0.8-1.0';
      confBuckets[k]++;
    }
    if (VALID.includes(a.domain)) { recovered++; recoveredTo[a.domain] = (recoveredTo[a.domain] || 0) + 1; }
    else if (a.domain === 'review_required') relabeled++;
    else stillUnknown++;
  }
  return {
    name, total: after.length,
    before: countDomains(before), after: countDomains(after),
    covBefore: coverage(countDomains(before), before.length),
    covAfter: coverage(countDomains(after), after.length),
    wasUnknown, recovered, relabeled, stillUnknown, recoveredTo, confBuckets,
  };
}

const targets = [
  auditDataset('dataset/comprehensive (per-exam)', perExam(BKDIR), perExam(ROOT)),
  auditDataset('comprehensive consolidated', consolidated(BKDIR), consolidated(ROOT)),
];

// ── report ─────────────────────────────────────────────────
const L = [];
L.push('# PHASE2_EFFECTIVENESS_REPORT', '');
L.push(`- Generated: ${new Date().toISOString()}`);
L.push(`- Backup (before): \`${path.relative(ROOT, BKDIR)}\``);
L.push('- valid_domain_records = economy + politics + history + geography + society');
L.push('- effective_coverage = valid_domain_records / total_records (review_required NOT counted)', '');

for (const t of targets) {
  L.push(`## ${t.name}  (n=${t.total})`, '');
  L.push('### 1. Domains BEFORE', '', '| domain | count |', '|---|---|');
  for (const k of [...VALID, 'unknown']) L.push(`| ${k} | ${t.before[k]} |`);
  L.push('', '### 2. Domains AFTER', '', '| domain | count |', '|---|---|');
  for (const k of [...VALID, 'review_required', 'unknown']) L.push(`| ${k} | ${t.after[k]} |`);
  L.push('', '### 3. Recovered vs relabeled', '');
  L.push(`- unknown records processed: **${t.wasUnknown}**`);
  L.push(`- truly recovered (→ valid domain): **${t.recovered}** ${JSON.stringify(t.recoveredTo)}`);
  L.push(`- relabeled-only (→ review_required): **${t.relabeled}**`);
  if (t.stillUnknown) L.push(`- still unknown: ${t.stillUnknown}`);
  L.push('', 'Confidence distribution (processed records):', '', '| bucket | count |', '|---|---|');
  for (const [b, n] of Object.entries(t.confBuckets)) L.push(`| ${b} | ${n} |`);
  L.push('', '### 4. Effective domain coverage', '');
  L.push(`- BEFORE: ${t.covBefore.valid}/${t.covBefore.total} = **${t.covBefore.pct}%**`);
  L.push(`- AFTER:  ${t.covAfter.valid}/${t.covAfter.total} = **${t.covAfter.pct}%**`);
  L.push(`- Δ = **+${(t.covAfter.pct - t.covBefore.pct).toFixed(2)} pp** (= recovered ${t.recovered} / ${t.total})`, '');
}

// ── verdict ────────────────────────────────────────────────
const tot = targets.reduce((a, t) => ({ rec: a.rec + t.recovered, rel: a.rel + t.relabeled, was: a.was + t.wasUnknown }), { rec: 0, rel: 0, was: 0 });
L.push('## Verdict — did coverage improve, or did unknown just become review_required?', '');
L.push(`- Across audited datasets: **${tot.rec}** truly recovered vs **${tot.rel}** relabeled-only (of ${tot.was} processed).`);
const ratio = tot.was ? (100 * tot.rec / tot.was).toFixed(1) : '0';
L.push(`- Only **${ratio}%** of unknowns were genuinely classified; the rest (**${(100 - ratio).toFixed(1)}%**) were relabeled \`review_required\`.`);
L.push('');
L.push('**Answer:** Domain coverage improved **only marginally** (by exactly the recovered count). The');
L.push('dominant effect was **relabeling `unknown` → `review_required`**, which is an honest triage state,');
L.push('not new classification. Effective coverage (valid-5 / total) rose by the small Δ above, **not** by the');
L.push('full unknown reduction. Real coverage gains require **re-OCR** of the garbled questions, then re-running Phase 2.');

fs.writeFileSync(path.join(ROOT, 'PHASE2_EFFECTIVENESS_REPORT.md'), L.join('\n'));
console.log('[phase2-audit] recovered:', tot.rec, '| relabeled:', tot.rel, '| processed:', tot.was);
for (const t of targets) console.log(`  ${t.name}: coverage ${t.covBefore.pct}% → ${t.covAfter.pct}% (+${(t.covAfter.pct - t.covBefore.pct).toFixed(2)}pp)`);
console.log('[phase2-audit] wrote PHASE2_EFFECTIVENESS_REPORT.md');
