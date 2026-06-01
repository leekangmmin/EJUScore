# 종과 정밀(육안 비전) 분석 진행상황
- 목표: 종합과목 38회 × 38문항을 PDF 스캔 육안 판독으로 정밀 분류
- 스키마: vision/<key>.json = { name, year, round, source, questions:[{q, daimon, subject, topic, material, era, region, sub}] }
  - subject: economy|politics|history|geography|society
  - material: map|graph|table|timeline|photo|passage
  - era(역사)/region(지리)/sub(경제·정치 세부) 선택적
- 처리 순서: 최신→과거
- 빌드: build-exam-bank.mjs가 vision/*.json 있으면 우선 사용, 없으면 OCR(jongkwa_raw.json) 폴백

## 완료
- 2024 (38/38) — econ12 pol10 geo8 hist7 soc1
- 2025 (38/38) — econ12 pol10 geo8 hist7 soc1
- 2023-2 (38/38) — econ12 geo8 pol8 hist9 soc1
- 2023-1 (38/38) — econ13 pol9 geo7 hist8 soc1
- 2022-2 (38/38) — econ11 pol10 geo10 hist7 soc0
- 2022-1 (38/38) — econ11 geo10 pol9 hist8 soc0
- 2021-2 (38/38) — econ11 hist10 geo8 pol7 soc2
- 2021-1 (38/38) — econ11 geo10 pol10 hist6 soc1
- 2020-2 (38/38) — econ13 pol10 hist8 geo7 soc0

## 대기 (29회)
2019-1,
2018-2, 2018-1, 2017-2, 2017-1, 2016-2, 2016-1, 2015-2, 2015-1, 2014-2, 2014-1,
2013-2, 2013-1, 2012-2, 2012-1, 2011-2, 2011-1, 2010-2, 2010-1, 2009-2, 2009-1,
2008-2, 2008-1, 2007-2, 2007-1, 2006-2, 2006-1, 2005-2, 2005-1
