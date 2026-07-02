export interface Summary { mean: number; median: number; p90: number; n: number }
export interface SeriesPoint {
  version: string; major: number; formula: 'awscli' | 'awscli@1';
  releasedAt: string; formulaAt: string | null; bottleAt: string | null;
  totalH: number | null; noticeH: number | null; buildH: number | null;
}
export interface CoverageEntry { awscli: number; shipped: number; pct: number }
export interface Issue727 { state: 'open' | 'closed'; createdAt: string; closedAt: string | null; url: string }
export interface DataJson {
  generatedAt: string;
  windowStart: string;
  issue727: Issue727;
  headline: {
    totalBottleLag: { d30: Summary; d90: Summary; y1: Summary; all: Summary };
    noticeLatency: { y1: Summary; all: Summary };
    bottleBuildLatency: { y1: Summary; all: Summary };
  };
  coverage: { overall: CoverageEntry; v1: CoverageEntry; v2: CoverageEntry };
  series: SeriesPoint[];
  recent: SeriesPoint[];
  notes: { awscli1MaintenanceMode: string };
}
