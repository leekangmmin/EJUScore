# SCHEMA_MIGRATION_REPORT

- Generated: 2026-06-03T21:50:30.606Z
- Math files processed: **38** | reduced→full migrated: **13**
- Distinct schemas after migration: **1** (target: 1)
- Required fields present in all: **YES**
- Required: id, number, domain, raw_text, text, answer_choices, difficulty, confidence, source

## Canonical schema

```
id, number, year, round, subject, domain, topic, subtopic, raw_text, text, answer_choices, difficulty, confidence, ocr_confidence, question_type, keywords, concepts, word_count, lines, tables, diagrams, graphs, maps, source, flags
```

## Migrated (reduced→full) files

| file | records | fields added |
|---|---|---|
| dataset/mathematics/2005/exam_2005_r1.json | 19 | id, year, round, subject, domain, subtopic, raw_text, text, answer_choices, difficulty, ocr_confidence, question_type, keywords, concepts, word_count, lines, tables, diagrams, graphs, maps, flags |
| dataset/mathematics/2005/exam_2005_r2.json | 20 | id, year, round, subject, domain, subtopic, raw_text, text, answer_choices, difficulty, ocr_confidence, question_type, keywords, concepts, word_count, lines, tables, diagrams, graphs, maps, flags |
| dataset/mathematics/2006/exam_2006_r1.json | 19 | id, year, round, subject, domain, subtopic, raw_text, text, answer_choices, difficulty, ocr_confidence, question_type, keywords, concepts, word_count, lines, tables, diagrams, graphs, maps, flags |
| dataset/mathematics/2006/exam_2006_r2.json | 20 | id, year, round, subject, domain, subtopic, raw_text, text, answer_choices, difficulty, ocr_confidence, question_type, keywords, concepts, word_count, lines, tables, diagrams, graphs, maps, flags |
| dataset/mathematics/2007/exam_2007_r1.json | 20 | id, year, round, subject, domain, subtopic, raw_text, text, answer_choices, difficulty, ocr_confidence, question_type, keywords, concepts, word_count, lines, tables, diagrams, graphs, maps, flags |
| dataset/mathematics/2007/exam_2007_r2.json | 20 | id, year, round, subject, domain, subtopic, raw_text, text, answer_choices, difficulty, ocr_confidence, question_type, keywords, concepts, word_count, lines, tables, diagrams, graphs, maps, flags |
| dataset/mathematics/2008/exam_2008_r1.json | 18 | id, year, round, subject, domain, subtopic, raw_text, text, answer_choices, difficulty, ocr_confidence, question_type, keywords, concepts, word_count, lines, tables, diagrams, graphs, maps, flags |
| dataset/mathematics/2008/exam_2008_r2.json | 18 | id, year, round, subject, domain, subtopic, raw_text, text, answer_choices, difficulty, ocr_confidence, question_type, keywords, concepts, word_count, lines, tables, diagrams, graphs, maps, flags |
| dataset/mathematics/2009/exam_2009_r1.json | 18 | id, year, round, subject, domain, subtopic, raw_text, text, answer_choices, difficulty, ocr_confidence, question_type, keywords, concepts, word_count, lines, tables, diagrams, graphs, maps, flags |
| dataset/mathematics/2009/exam_2009_r2.json | 18 | id, year, round, subject, domain, subtopic, raw_text, text, answer_choices, difficulty, ocr_confidence, question_type, keywords, concepts, word_count, lines, tables, diagrams, graphs, maps, flags |
| dataset/mathematics/2010/exam_2010_r1.json | 18 | id, year, round, subject, domain, subtopic, raw_text, text, answer_choices, difficulty, ocr_confidence, question_type, keywords, concepts, word_count, lines, tables, diagrams, graphs, maps, flags |
| dataset/mathematics/2010/exam_2010_r2.json | 20 | id, year, round, subject, domain, subtopic, raw_text, text, answer_choices, difficulty, ocr_confidence, question_type, keywords, concepts, word_count, lines, tables, diagrams, graphs, maps, flags |
| dataset/mathematics/2011/exam_2011_r1.json | 18 | id, year, round, subject, domain, subtopic, raw_text, text, answer_choices, difficulty, ocr_confidence, question_type, keywords, concepts, word_count, lines, tables, diagrams, graphs, maps, flags |