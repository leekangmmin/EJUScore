"""
EJU Intelligence Platform - OCR Engine
Multi-engine OCR with confidence tracking for Japanese + English text extraction.
"""
import re
import numpy as np
from PIL import Image
import pytesseract
from typing import List, Dict, Optional, Tuple
from .pipeline_config import TESSERACT_LANG, OCR_CONFIDENCE_THRESHOLD


def normalize_japanese_text(text: str) -> str:
    """
    Normalize Japanese OCR output that has excessive spaces.
    Tesseract often adds spaces between Japanese characters.
    This function removes those spaces while preserving English words.
    """
    if not text:
        return text

    # Remove spaces between Japanese characters (Hiragana, Katakana, Kanji)
    # Pattern: space between two Japanese chars OR Japanese char and punctuation
    text = re.sub(r'([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]) (?=[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])', r'\1', text)
    text = re.sub(r'([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]) (?=[、。．・])', r'\1', text)
    text = re.sub(r'([、。．・]) (?=[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])', r'\1', text)

    # Remove spaces between digits
    text = re.sub(r'(\d) (\d)', r'\1\2', text)

    # Fix common OCR artifacts for Japanese
    text = text.replace('ー ', 'ー').replace('一 ', '一')
    text = text.replace('  ', ' ').strip()

    return text


class OCREngine:
    """
    OCR Engine for EJU exam PDFs.
    Uses Tesseract with Japanese + English language support.
    Provides confidence tracking per extraction.
    """

    def __init__(self, lang: str = TESSERACT_LANG):
        self.lang = lang
        self.stats = {
            'total_extractions': 0,
            'high_confidence': 0,
            'low_confidence': 0,
            'failed': 0,
        }

    def extract_text(self, image: Image.Image) -> Dict:
        """Extract text from a PIL Image with confidence data."""
        try:
            data = pytesseract.image_to_data(
                image,
                lang=self.lang,
                output_type=pytesseract.Output.DICT,
                config='--psm 6 --oem 3'
            )

            text_parts = []
            confidences = []
            words_info = []

            for i in range(len(data['text'])):
                word = data['text'][i].strip()
                conf = int(data['conf'][i]) if data['conf'][i] != '-1' else 0
                if word:
                    confidence = conf / 100.0
                    text_parts.append(word)
                    confidences.append(confidence)
                    words_info.append({
                        'word': word,
                        'confidence': confidence,
                        'bbox': {
                            'x': data['left'][i],
                            'y': data['top'][i],
                            'w': data['width'][i],
                            'h': data['height'][i],
                        }
                    })

            text = ' '.join(text_parts)
            text = normalize_japanese_text(text)
            avg_confidence = np.mean(confidences) if confidences else 0.0
            blocks = self._extract_blocks(data)

            result = {
                'text': text,
                'confidence': round(avg_confidence, 4),
                'words': words_info,
                'blocks': blocks,
                'word_count': len(words_info),
            }

            self.stats['total_extractions'] += 1
            if avg_confidence >= OCR_CONFIDENCE_THRESHOLD:
                self.stats['high_confidence'] += 1
            else:
                self.stats['low_confidence'] += 1

            return result

        except Exception as e:
            self.stats['failed'] += 1
            return {
                'text': '',
                'confidence': 0.0,
                'words': [],
                'blocks': [],
                'word_count': 0,
                'error': str(e),
            }

    def extract_text_fast(self, image: Image.Image) -> str:
        """Fast text extraction without detailed confidence."""
        try:
            text = pytesseract.image_to_string(
                image,
                lang=self.lang,
                config='--psm 6 --oem 3'
            )
            text = normalize_japanese_text(text)
            return text.strip()
        except Exception:
            return ''

    def extract_with_layout(self, image: Image.Image) -> Dict:
        """Extract text with layout analysis."""
        try:
            data = pytesseract.image_to_data(
                image,
                lang=self.lang,
                output_type=pytesseract.Output.DICT,
                config='--psm 4 --oem 3'
            )
            blocks = self._extract_blocks_grouped(data)
            text = ' '.join([b['text'] for b in blocks])
            text = normalize_japanese_text(text)
            confs = [b['confidence'] for b in blocks if b['confidence'] > 0]
            avg_confidence = np.mean(confs) if confs else 0.0

            return {
                'text': text,
                'confidence': round(avg_confidence, 4),
                'blocks': blocks,
            }
        except Exception as e:
            return {
                'text': '',
                'confidence': 0.0,
                'blocks': [],
                'error': str(e),
            }

    def _extract_blocks(self, data: Dict) -> List[Dict]:
        """Extract text blocks from pytesseract data."""
        blocks = []
        current_block = None
        block_num = -1

        for i in range(len(data['text'])):
            word = data['text'][i].strip()
            bn = data['block_num'][i]

            if bn != block_num:
                if current_block:
                    blocks.append(current_block)
                block_num = bn
                current_block = {
                    'block_num': bn,
                    'text': '',
                    'confidence': 0.0,
                    'words': [],
                    'bbox': {
                        'x': data['left'][i],
                        'y': data['top'][i],
                        'w': data['width'][i],
                        'h': data['height'][i],
                    }
                }

            if word and current_block:
                current_block['words'].append(word)
                current_block['text'] += ' ' + word

        if current_block:
            blocks.append(current_block)

        for block in blocks:
            block['text'] = normalize_japanese_text(block['text'].strip())

        return blocks

    def _extract_blocks_grouped(self, data: Dict) -> List[Dict]:
        """Group pytesseract output into meaningful blocks."""
        blocks = {}
        for i in range(len(data['text'])):
            word = data['text'][i].strip()
            if not word:
                continue
            bn = data['block_num'][i]
            ln = data['line_num'][i]
            par = data['par_num'][i]
            key = (bn, ln, par)

            if key not in blocks:
                conf_val = int(data['conf'][i]) if data['conf'][i] != '-1' else 0
                blocks[key] = {
                    'block_num': bn, 'line_num': ln, 'par_num': par,
                    'text': '', 'words': [], 'confidences': [],
                    'bbox': {
                        'x': data['left'][i], 'y': data['top'][i],
                        'w': data['width'][i], 'h': data['height'][i],
                    }
                }

            conf_val = int(data['conf'][i]) if data['conf'][i] != '-1' else 0
            blocks[key]['words'].append(word)
            blocks[key]['text'] += ' ' + word
            blocks[key]['confidences'].append(conf_val / 100.0)

        result = []
        for key in sorted(blocks.keys()):
            b = blocks[key]
            b['text'] = normalize_japanese_text(b['text'].strip())
            b['confidence'] = round(np.mean(b['confidences']), 4) if b['confidences'] else 0.0
            del b['confidences']
            result.append(b)

        return result

    def extract_tables(self, image: Image.Image) -> List[Dict]:
        """Detect and extract table structures from image."""
        try:
            data = pytesseract.image_to_data(
                image,
                lang=self.lang,
                output_type=pytesseract.Output.DICT,
                config='--psm 6 --oem 3'
            )
            tables = []
            current_table = []
            current_block = -1

            for i in range(len(data['text'])):
                word = data['text'][i].strip()
                bn = data['block_num'][i]
                if bn != current_block:
                    if current_table and len(current_table) >= 4:
                        tables.append({
                            'block_num': current_block,
                            'text': ' '.join(current_table),
                            'cells': current_table,
                            'confidence': 0.0,
                        })
                    current_block = bn
                    current_table = []
                if word:
                    current_table.append(word)

            if current_table and len(current_table) >= 4:
                tables.append({
                    'block_num': current_block,
                    'text': ' '.join(current_table),
                    'cells': current_table,
                    'confidence': 0.0,
                })

            return tables
        except Exception:
            return []

    def detect_vertical_japanese(self, image: Image.Image) -> List[Dict]:
        """Detect vertical Japanese text regions."""
        vertical_regions = []
        try:
            data = pytesseract.image_to_data(
                image,
                lang=self.lang,
                output_type=pytesseract.Output.DICT,
                config='--psm 6 --oem 3'
            )
            positions = []
            for i in range(len(data['text'])):
                word = data['text'][i].strip()
                if word and data['conf'][i] != '-1':
                    positions.append({
                        'word': word,
                        'x': data['left'][i], 'y': data['top'][i],
                        'w': data['width'][i], 'h': data['height'][i],
                    })

            if positions:
                x_groups = {}
                for pos in positions:
                    x_key = round(pos['x'] / 20) * 20
                    if x_key not in x_groups:
                        x_groups[x_key] = []
                    x_groups[x_key].append(pos)

                for x_key, group in x_groups.items():
                    if len(group) >= 3:
                        group.sort(key=lambda p: p['y'])
                        vertical_regions.append({
                            'x': x_key,
                            'text': ' '.join([p['word'] for p in group]),
                            'word_count': len(group),
                            'is_vertical': True,
                        })
            return vertical_regions
        except Exception:
            return []

    def get_stats(self) -> Dict:
        return self.stats
