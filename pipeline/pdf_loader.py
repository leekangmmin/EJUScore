"""
EJU Intelligence Platform - PDF Loader & Page Renderer
Handles PDF discovery, loading, page rendering, and metadata extraction.
"""
import os
import re
import fitz  # PyMuPDF
from typing import List, Dict, Optional, Tuple
from .pipeline_config import (
    COMPREHENSIVE_DIR, MATHEMATICS_DIR, OCR_DPI,
    ERA_MAP
)


def discover_pdfs(subject_type: str) -> List[Dict]:
    """
    Discover all exam PDFs from source directories.
    Returns list of dicts with file info.
    Excludes answer key PDFs.
    """
    if subject_type == "comprehensive":
        base_dir = COMPREHENSIVE_DIR
    elif subject_type == "mathematics":
        base_dir = MATHEMATICS_DIR
    else:
        raise ValueError(f"Unknown subject type: {subject_type}")

    pdfs = []
    for root, dirs, files in os.walk(base_dir):
        for f in files:
            if not f.lower().endswith('.pdf'):
                continue
            # Skip answer key files
            if '答案' in f or '답안' in f:
                continue

            full_path = os.path.join(root, f)
            info = parse_pdf_filename(f, subject_type, full_path)
            if info:
                pdfs.append(info)

    # Sort by year
    pdfs.sort(key=lambda x: (x['year'], x.get('round', 1)))
    return pdfs


def parse_pdf_filename(filename: str, subject_type: str, full_path: str) -> Optional[Dict]:
    """Parse filename to extract year, round, and metadata."""
    name = os.path.splitext(filename)[0]

    result = {
        'filename': filename,
        'path': full_path,
        'subject': subject_type,
        'year': None,
        'round': None,
        'era': None,
        'era_year': None,
    }

    # Try to extract Japanese era and year
    for era_prefix, year in ERA_MAP.items():
        if era_prefix in name:
            result['year'] = year
            result['era'] = era_prefix
            # Determine round
            round_match = re.search(r'第(\d+)回', name)
            if round_match:
                result['round'] = int(round_match.group(1))
            else:
                result['round'] = 1
            break

    # Fallback: try direct year extraction
    if result['year'] is None:
        year_match = re.search(r'(\d{4})', name)
        if year_match:
            result['year'] = int(year_match.group(1))
            round_match = re.search(r'第(\d+)回', name)
            if round_match:
                result['round'] = int(round_match.group(1))

    if result['year'] is None:
        print(f"  [WARN] Could not parse year from: {filename}")
        return None

    return result


def load_pdf(pdf_info: Dict) -> Optional[fitz.Document]:
    """Load a PDF file and return a PyMuPDF document."""
    try:
        doc = fitz.open(pdf_info['path'])
        return doc
    except Exception as e:
        print(f"  [ERROR] Failed to load PDF: {e}")
        return None


def render_page(doc: fitz.Document, page_num: int, dpi: int = OCR_DPI) -> Optional[Dict]:
    """
    Render a PDF page to an image at specified DPI.
    Returns dict with pixmap, image bytes, width, height.
    """
    try:
        page = doc[page_num]
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)

        return {
            'pixmap': pix,
            'width': pix.width,
            'height': pix.height,
            'page_num': page_num + 1,
            'image_bytes': pix.tobytes("png"),
        }
    except Exception as e:
        print(f"  [ERROR] Failed to render page {page_num}: {e}")
        return None


def extract_page_metadata(doc: fitz.Document) -> Dict:
    """Extract PDF metadata."""
    meta = doc.metadata
    return {
        'title': meta.get('title', ''),
        'author': meta.get('author', ''),
        'subject': meta.get('subject', ''),
        'keywords': meta.get('keywords', ''),
        'total_pages': len(doc),
    }


def get_year_from_filename(filepath: str) -> Optional[int]:
    """Extract year from a file path."""
    basename = os.path.basename(filepath)
    for era_prefix, year in ERA_MAP.items():
        if era_prefix in basename:
            return year
    match = re.search(r'(\d{4})', basename)
    if match:
        return int(match.group(1))
    return None
