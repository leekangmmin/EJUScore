"""
EJU Intelligence Platform - Layout Detection
Detects question blocks, tables, diagrams, graphs, maps, and timelines in exam pages.
"""
import re
import numpy as np
from PIL import Image
from typing import List, Dict, Optional, Tuple


class LayoutDetector:
    """
    Detects structural elements in EJU exam pages.
    """

    def __init__(self):
        self.elements_found = {
            'questions': 0, 'tables': 0, 'diagrams': 0,
            'graphs': 0, 'maps': 0, 'timelines': 0,
        }

    def detect_all(self, image: Image.Image) -> Dict:
        """Run all detection algorithms on a page image."""
        width, height = image.size
        gray = self._to_grayscale(image)
        np_image = np.array(gray)

        results = {
            'page_width': width, 'page_height': height,
            'blocks': [], 'tables': [], 'diagrams': [],
            'graphs': [], 'maps': [], 'timelines': [],
            'question_regions': [], 'answer_choice_regions': [],
        }

        results['tables'] = self.detect_tables(np_image, image)
        results['diagrams'] = self.detect_diagrams(np_image, image)
        results['graphs'] = self.detect_graphs(np_image, image)
        results['maps'] = self.detect_maps(np_image, image)
        results['timelines'] = self.detect_timelines(np_image, image)
        question_regions = self.detect_question_regions(np_image, image)
        results['question_regions'] = question_regions
        answer_regions = self.detect_answer_choices(np_image, image)
        results['answer_choice_regions'] = answer_regions

        for qr in question_regions:
            results['blocks'].append({
                'type': 'question', 'bbox': qr['bbox'],
                'question_number': qr.get('number'),
                'confidence': qr.get('confidence', 0.8),
            })
        for ar in answer_regions:
            results['blocks'].append({
                'type': 'answer_choices', 'bbox': ar['bbox'],
                'choices': ar.get('choices', []),
                'confidence': ar.get('confidence', 0.7),
            })
        for t in results['tables']:
            results['blocks'].append({
                'type': 'table', 'bbox': t['bbox'],
                'confidence': t.get('confidence', 0.7),
            })

        self.elements_found['questions'] = len(question_regions)
        self.elements_found['tables'] = len(results['tables'])
        self.elements_found['diagrams'] = len(results['diagrams'])
        self.elements_found['graphs'] = len(results['graphs'])
        self.elements_found['maps'] = len(results['maps'])
        self.elements_found['timelines'] = len(results['timelines'])

        return results

    def _to_grayscale(self, image: Image.Image) -> Image.Image:
        return image.convert('L')

    def detect_question_regions(self, np_image: np.ndarray, pil_image: Image.Image) -> List[Dict]:
        """Detect question number regions."""
        regions = []
        height, width = np_image.shape

        try:
            import pytesseract
            data = pytesseract.image_to_data(
                pil_image, lang='jpn',
                output_type=pytesseract.Output.DICT,
                config='--psm 6 --oem 3'
            )

            for i in range(len(data['text'])):
                word = data['text'][i].strip()
                if not word:
                    continue
                if re.search(r'^[問第]+\s*\d+', word) or re.search(r'^\d+[\.\s]', word):
                    regions.append({
                        'number': word,
                        'bbox': {
                            'x0': max(0, data['left'][i] - 10),
                            'y0': max(0, data['top'][i] - 10),
                            'x1': min(width, data['left'][i] + data['width'][i] + 10),
                            'y1': min(height, data['top'][i] + data['height'][i] + 10),
                        },
                        'confidence': max(0.5, int(data['conf'][i]) / 100.0) if data['conf'][i] != '-1' else 0.5,
                    })
        except ImportError:
            pass

        if not regions:
            regions = self._detect_questions_via_projections(np_image)

        return regions

    def _detect_questions_via_projections(self, np_image: np.ndarray) -> List[Dict]:
        """Fallback: detect question regions via horizontal projection."""
        height, width = np_image.shape
        regions = []
        h_proj = np.sum(np_image < 200, axis=1)
        threshold = width * 0.1
        content_rows = h_proj > threshold

        in_content = False
        start_row = 0
        for row in range(height):
            if content_rows[row] and not in_content:
                start_row = row
                in_content = True
            elif not content_rows[row] and in_content:
                if row - start_row > 30:
                    regions.append({
                        'number': '',
                        'bbox': {'x0': 0, 'y0': start_row, 'x1': width, 'y1': row},
                        'confidence': 0.5,
                    })
                in_content = False
        return regions

    def detect_tables(self, np_image: np.ndarray, pil_image: Image.Image) -> List[Dict]:
        """Detect tables."""
        tables = []
        height, width = np_image.shape
        edges = self._detect_edges(np_image)
        h_lines = self._find_lines(edges, 'horizontal')
        v_lines = self._find_lines(edges, 'vertical')

        if len(h_lines) >= 3 and len(v_lines) >= 2:
            table_regions = self._find_table_regions(h_lines, v_lines, width, height)
            for region in table_regions:
                tables.append({
                    'bbox': region['bbox'], 'rows': region['rows'],
                    'columns': region['columns'], 'confidence': 0.7, 'type': 'table',
                })
        return tables

    def _detect_edges(self, np_image: np.ndarray) -> np.ndarray:
        """Simple edge detection."""
        try:
            from scipy import ndimage
            sobel_h = ndimage.sobel(np_image, axis=0)
            sobel_v = ndimage.sobel(np_image, axis=1)
            magnitude = np.sqrt(sobel_h**2 + sobel_v**2)
            return (magnitude > magnitude.mean() + magnitude.std()).astype(np.uint8) * 255
        except ImportError:
            return np.zeros_like(np_image)

    def _find_lines(self, edge_image: np.ndarray, axis: str = 'horizontal', min_length: int = 50) -> List[int]:
        """Find straight lines in edge image."""
        lines = []
        if axis == 'horizontal':
            for row in range(edge_image.shape[0]):
                consecutive = 0
                for col in range(edge_image.shape[1]):
                    if edge_image[row, col] > 0:
                        consecutive += 1
                    else:
                        if consecutive >= min_length:
                            lines.append(row)
                        consecutive = 0
                if consecutive >= min_length:
                    lines.append(row)
        else:
            for col in range(edge_image.shape[1]):
                consecutive = 0
                for row in range(edge_image.shape[0]):
                    if edge_image[row, col] > 0:
                        consecutive += 1
                    else:
                        if consecutive >= min_length:
                            lines.append(col)
                        consecutive = 0
                if consecutive >= min_length:
                    lines.append(col)
        return list(set(lines))

    def _find_table_regions(self, h_lines, v_lines, width, height):
        if len(h_lines) < 3 or len(v_lines) < 2:
            return []
        h_lines.sort()
        v_lines.sort()
        row_gaps = []
        for i in range(len(h_lines) - 1):
            gap = h_lines[i+1] - h_lines[i]
            if 15 < gap < 100:
                row_gaps.append((h_lines[i], h_lines[i+1]))
        col_gaps = []
        for i in range(len(v_lines) - 1):
            gap = v_lines[i+1] - v_lines[i]
            if 30 < gap < 500:
                col_gaps.append((v_lines[i], v_lines[i+1]))
        if len(row_gaps) < 2:
            return []
        bbox = {
            'x0': min(v[0] for v in col_gaps) if col_gaps else 0,
            'y0': min(r[0] for r in row_gaps),
            'x1': max(v[1] for v in col_gaps) if col_gaps else width,
            'y1': max(r[1] for r in row_gaps),
        }
        return [{'bbox': bbox, 'rows': len(row_gaps), 'columns': len(col_gaps)}]

    def detect_diagrams(self, np_image, pil_image):
        diagrams = []
        height, width = np_image.shape
        edges = self._detect_edges(np_image)
        try:
            from scipy import ndimage
            labeled, num_features = ndimage.label(edges > 0)
            for i in range(1, min(num_features + 1, 50)):
                ys, xs = np.where(labeled == i)
                if len(ys) < 100:
                    continue
                y0, y1 = ys.min(), ys.max()
                x0, x1 = xs.min(), xs.max()
                rh, rw = y1 - y0, x1 - x0
                if 30 < rh < height * 0.6 and 30 < rw < width * 0.6:
                    density = len(ys) / (rh * rw)
                    if 0.01 < density < 0.3:
                        diagrams.append({
                            'bbox': {'x0': int(x0), 'y0': int(y0), 'x1': int(x1), 'y1': int(y1)},
                            'confidence': 0.6, 'type': 'diagram',
                        })
        except ImportError:
            pass
        return diagrams

    def detect_graphs(self, np_image, pil_image):
        graphs = []
        height, width = np_image.shape
        edges = self._detect_edges(np_image)
        h_lines = self._find_lines(edges, 'horizontal', min_length=30)
        v_lines = self._find_lines(edges, 'vertical', min_length=30)
        if h_lines and v_lines:
            h_axis = max(h_lines)
            v_axis = min(v_lines)
            gh = height - h_axis
            gw = v_axis
            if 50 < gh < height * 0.5 and 50 < gw < width * 0.5:
                graphs.append({
                    'bbox': {
                        'x0': max(0, v_axis - 20), 'y0': max(0, h_axis - gh - 20),
                        'x1': min(width, v_axis + gw + 50), 'y1': min(height, h_axis + 20),
                    },
                    'confidence': 0.6, 'type': 'graph', 'has_axes': True,
                })
        return graphs

    def detect_maps(self, np_image, pil_image):
        maps = []
        height, width = np_image.shape[:2] if len(np_image.shape) >= 2 else (0, 0)
        return maps

    def detect_timelines(self, np_image, pil_image):
        timelines = []
        height, width = np_image.shape[:2] if len(np_image.shape) >= 2 else (0, 0)
        try:
            import pytesseract
            data = pytesseract.image_to_data(
                pil_image, lang='jpn',
                output_type=pytesseract.Output.DICT,
                config='--psm 6 --oem 3'
            )
            year_pattern = re.compile(r'\d{4}年|\d{2}世紀|昭和|平成|令和')
            date_positions = []
            for i in range(len(data['text'])):
                word = data['text'][i].strip()
                if year_pattern.search(word):
                    date_positions.append({'text': word, 'x': data['left'][i], 'y': data['top'][i]})
            if len(date_positions) >= 3:
                y_positions = [d['y'] for d in date_positions]
                y_std = np.std(y_positions) if len(y_positions) > 1 else 999
                if y_std < 30:
                    min_x = min(d['x'] for d in date_positions)
                    max_x = max(d['x'] for d in date_positions)
                    min_y = min(d['y'] for d in date_positions)
                    max_y = max(d['y'] for d in date_positions)
                    timelines.append({
                        'bbox': {
                            'x0': max(0, min_x - 20), 'y0': max(0, min_y - 30),
                            'x1': min(width, max_x + 20), 'y1': min(height, max_y + 30),
                        },
                        'confidence': 0.7, 'type': 'timeline',
                        'dates': [d['text'] for d in date_positions],
                    })
        except ImportError:
            pass
        return timelines

    def detect_answer_choices(self, np_image, pil_image):
        regions = []
        height, width = np_image.shape[:2] if len(np_image.shape) >= 2 else (0, 0)
        try:
            import pytesseract
            data = pytesseract.image_to_data(
                pil_image, lang='jpn',
                output_type=pytesseract.Output.DICT,
                config='--psm 6 --oem 3'
            )
            choice_pattern = re.compile(r'^[①②③④⑤⑥⑦⑧⑨⑩]|^\d+[\.\s]')
            choice_groups = {}
            for i in range(len(data['text'])):
                word = data['text'][i].strip()
                if choice_pattern.match(word):
                    key = f"{data['block_num'][i]}_{data['line_num'][i]}"
                    if key not in choice_groups:
                        choice_groups[key] = []
                    choice_groups[key].append({
                        'text': word, 'x': data['left'][i], 'y': data['top'][i],
                        'w': data['width'][i], 'h': data['height'][i],
                    })
            for key, choices in choice_groups.items():
                if len(choices) >= 2:
                    min_x = min(c['x'] for c in choices)
                    min_y = min(c['y'] for c in choices)
                    max_x = max(c['x'] + c['w'] for c in choices)
                    max_y = max(c['y'] + c['h'] for c in choices)
                    regions.append({
                        'bbox': {
                            'x0': max(0, min_x - 10), 'y0': max(0, min_y - 10),
                            'x1': min(width, max_x + 10), 'y1': min(height, max_y + 10),
                        },
                        'choices': [c['text'] for c in choices],
                        'confidence': 0.7,
                    })
        except ImportError:
            pass
        return regions
