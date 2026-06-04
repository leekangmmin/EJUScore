#!/usr/bin/env python3
"""
EJU Intelligence System — Dataset Integrity Checker
====================================================
Verifies all canonical dataset files against LOCKFILE.json at startup.
Exits with code 1 (fail-fast) if any dataset has been mutated.

Usage:
    python integrity_check.py                          # standalone check
    from integrity_check import verify_dataset_integrity
    verify_dataset_integrity()                         # runtime import

LOCKFILE location: dataset/LOCKFILE.json
"""

import hashlib
import json
import os
import sys

# Module-level guard: only verify once per process
_VERIFIED = False


def verify_dataset_integrity(lockfile_path: str = None, exit_on_fail: bool = True) -> bool:
    """
    Verify all dataset files match their locked SHA256 hashes.

    Idempotent — only runs the actual verification once per process;
    subsequent calls return the cached result immediately.

    Args:
        lockfile_path: Path to LOCKFILE.json.
            If relative, resolved against this file's directory (script_dir/../dataset/LOCKFILE.json).
        exit_on_fail: If True, calls sys.exit(1) on mismatch (fail-fast).

    Returns:
        True if all datasets verify; False if mismatch (only if exit_on_fail=False).
    """
    global _VERIFIED
    if _VERIFIED:
        return True

    if lockfile_path is None:
        # Default: dataset/LOCKFILE.json relative to this file's location
        lockfile_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            'dataset', 'LOCKFILE.json'
        )
    elif not os.path.isabs(lockfile_path):
        # Try relative to CWD first, then fallback to script dir
        if not os.path.exists(lockfile_path):
            lockfile_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                lockfile_path
            )

    lockfile_path = os.path.abspath(lockfile_path)

    if not os.path.exists(lockfile_path):
        msg = (
            f"\n{'='*70}\n"
            f"  DATASET INTEGRITY CHECK: LOCKFILE NOT FOUND\n"
            f"  Expected at: {lockfile_path}\n"
            f"\n  The dataset integrity lockfile is missing.\n"
            f"  This release requires dataset/LOCKFILE.json to verify\n"
            f"  that no dataset files have been tampered with.\n"
            f"{'='*70}\n"
        )
        if exit_on_fail:
            print(msg, file=sys.stderr)
            sys.exit(1)
        return False

    # Load lockfile
    with open(lockfile_path, 'r', encoding='utf-8') as f:
        lockfile = json.load(f)

    version = lockfile.get('version', 'unknown')
    locked_files = lockfile.get('canonical_datasets', {})

    # IMPORTANT: Paths in LOCKFILE are relative to repo root
    # (e.g. "dataset/comprehensive/...") so the base_dir is the parent
    # of the dataset/ directory, i.e. the repo root.
    repo_root = os.path.dirname(os.path.dirname(lockfile_path))
    if not os.path.isdir(repo_root) or not os.path.exists(os.path.join(repo_root, '.git')):
        # Fallback: lockfile could be at repo_root/dataset/LOCKFILE.json
        # So repo_root = parent of parent of lockfile
        pass

    failures = []
    checked = 0

    for rel_path, expected in locked_files.items():
        # Skip the lockfile itself
        if rel_path.endswith('LOCKFILE.json'):
            continue

        full_path = os.path.join(repo_root, rel_path)
        if not os.path.exists(full_path):
            failures.append(f"MISSING:  {rel_path}")
            continue

        # Compute SHA256
        sha256 = hashlib.sha256()
        with open(full_path, 'rb') as f:
            sha256.update(f.read())
        actual_digest = sha256.hexdigest()
        expected_digest = expected.get('sha256', '')

        if actual_digest != expected_digest:
            failures.append(
                f"MISMATCH: {rel_path}\n"
                f"  Expected SHA256: {expected_digest}\n"
                f"  Actual   SHA256: {actual_digest}"
            )

        checked += 1

    if failures:
        msg = (
            f"\n{'='*70}\n"
            f"  DATASET INTEGRITY CHECK FAILED (v{version})\n"
            f"  {len(failures)} of {checked} files failed verification.\n"
            f"{'='*70}\n\n"
        )
        for f in failures:
            msg += f"  ❌ {f}\n\n"
        msg += (
            f"\n  The dataset has been mutated since the v{version} release freeze.\n"
            f"  This is a HARD STOP to prevent analysis on corrupted data.\n"
            f"  Revert dataset changes or regenerate LOCKFILE.json.\n"
            f"{'='*70}\n"
        )
        if exit_on_fail:
            print(msg, file=sys.stderr)
            sys.exit(1)
        return False

    # Mark as verified so subsequent calls are no-ops
    _VERIFIED = True

    print(
        f"\n{'='*70}\n"
        f"  DATASET INTEGRITY CHECK PASSED (v{version})\n"
        f"  All {checked} dataset files verified against LOCKFILE.\n"
        f"  Dataset is immutable. Ready for production.\n"
        f"{'='*70}\n"
    )
    return True


if __name__ == '__main__':
    verify_dataset_integrity()
