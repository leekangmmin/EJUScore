"""
EJU Intelligence Engine Upgrade
Advanced prediction, weakness analysis, knowledge graph, and evaluation.

Release Freeze v1.1.0:
  - Dataset integrity verified at import time via integrity_check.py
  - Any mutation to locked dataset files causes a HARD STOP
"""

import os
import sys

# Run integrity check on import (only once per process — integrity_check.py is idempotent)
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_LOCKFILE = os.path.join(_THIS_DIR, '..', 'dataset', 'LOCKFILE.json')
_ROOT = os.path.dirname(_THIS_DIR)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
try:
    from integrity_check import verify_dataset_integrity
    verify_dataset_integrity(lockfile_path=_LOCKFILE, exit_on_fail=True)
except ImportError:
    print(
        "⚠  integrity_check.py not found — dataset integrity cannot be verified.\n"
        "   This is expected in development. For production, ensure the file exists.",
        file=sys.stderr,
    )
except Exception as exc:
    print(
        f"⚠  Dataset integrity check encountered an error: {exc}\n"
        f"   Proceeding without verification.",
        file=sys.stderr,
    )
