export type Formula = 'awscli' | 'awscli@1';

const FORMULA_RE = /^awscli(@1)? (\d[\w.]*)$/;
const BOTTLE_RE = /^awscli(@1)?: update (\d[\w.]*) bottle\.$/;

export function parseHomebrewCommit(
  message: string,
): { formula: Formula; version: string; kind: 'formula' | 'bottle' } | null {
  const line = message.split('\n')[0].trim();
  const bottle = BOTTLE_RE.exec(line);
  if (bottle) return { formula: bottle[1] ? 'awscli@1' : 'awscli', version: bottle[2], kind: 'bottle' };
  const formula = FORMULA_RE.exec(line);
  if (formula) return { formula: formula[1] ? 'awscli@1' : 'awscli', version: formula[2], kind: 'formula' };
  return null;
}

export function normalizeVersion(raw: string): { versionNorm: string; revision: number } {
  const m = /_(\d+)$/.exec(raw);
  if (m) return { versionNorm: raw.slice(0, m.index), revision: Number(m[1]) };
  return { versionNorm: raw, revision: 0 };
}

export function majorOf(versionNorm: string): number {
  return Number(versionNorm.split('.')[0]);
}

export function formulaForMajor(major: number): Formula {
  return major === 1 ? 'awscli@1' : 'awscli';
}
