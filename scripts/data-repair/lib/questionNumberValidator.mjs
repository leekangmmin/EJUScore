// ═══════════════════════════════════════════════════════════════════
// QuestionNumberValidator — reject OCR-artifact / out-of-range numbers.
//
// Valid ranges (configurable):
//   comprehensive: 1–38   mathematics: 1–27   japanese: 1–60 (configurable)
// Rejects: 4+ digit values, >100, below min, out-of-subject-range, non-integer.
// ═══════════════════════════════════════════════════════════════════

export const DEFAULT_RANGES = {
  comprehensive: { min: 1, max: 38 },
  mathematics: { min: 1, max: 27 },
  japanese: { min: 1, max: 60 }, // configurable
};

/**
 * @returns {{valid:boolean, reason?:string}}
 *   reason ∈ absent | non_integer | four_plus_digits | gt_100 | below_min | out_of_range
 */
export function validateNumber(n, subject = 'comprehensive', ranges = DEFAULT_RANGES) {
  const r = ranges[subject] || ranges.comprehensive;
  if (n === null || n === undefined) return { valid: false, reason: 'absent' };
  if (typeof n !== 'number' || !Number.isInteger(n)) return { valid: false, reason: 'non_integer' };
  if (n >= 1000) return { valid: false, reason: 'four_plus_digits' }; // OCR artifact
  if (n > 100) return { valid: false, reason: 'gt_100' };             // OCR artifact
  if (n < r.min) return { valid: false, reason: 'below_min' };
  if (n > r.max) return { valid: false, reason: 'out_of_range' };
  return { valid: true };
}

/** Add a flag to a record's flags[] (idempotent). */
export function addFlag(record, flag) {
  if (!Array.isArray(record.flags)) record.flags = [];
  if (!record.flags.includes(flag)) record.flags.push(flag);
}

/**
 * Validate + de-duplicate a group of question records sharing one exam.
 * Invalid OR duplicate numbers → null + flag 'invalid_question_number'.
 * Returns the list of changes for the migration report.
 */
export function repairGroup(records, { getNum, setNum, subject, file, idOf }, ranges = DEFAULT_RANGES) {
  const seen = new Set();
  const changes = [];
  for (const rec of records) {
    const old = getNum(rec);
    const v = validateNumber(old, subject, ranges);
    let reason = null;
    if (!v.valid) reason = v.reason;
    else if (seen.has(old)) reason = 'duplicate_in_exam';
    else { seen.add(old); continue; }

    setNum(rec, null);
    addFlag(rec, 'invalid_question_number');
    changes.push({ file, id: idOf ? idOf(rec) : null, oldNumber: old, newNumber: null, reason, subject });
  }
  return changes;
}
