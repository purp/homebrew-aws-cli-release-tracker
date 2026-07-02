import { describe, it, expect } from 'vitest';
import { parseHomebrewCommit, normalizeVersion, majorOf, formulaForMajor } from '../src/parse.js';

describe('parseHomebrewCommit', () => {
  it('parses a v2 formula merge', () => {
    expect(parseHomebrewCommit('awscli 2.35.14')).toEqual({ formula: 'awscli', version: '2.35.14', kind: 'formula' });
  });
  it('parses a v1 formula merge', () => {
    expect(parseHomebrewCommit('awscli@1 1.45.30')).toEqual({ formula: 'awscli@1', version: '1.45.30', kind: 'formula' });
  });
  it('parses a v2 bottle build', () => {
    expect(parseHomebrewCommit('awscli: update 2.35.14 bottle.')).toEqual({ formula: 'awscli', version: '2.35.14', kind: 'bottle' });
  });
  it('parses a v1 bottle build', () => {
    expect(parseHomebrewCommit('awscli@1: update 1.45.30 bottle.')).toEqual({ formula: 'awscli@1', version: '1.45.30', kind: 'bottle' });
  });
  it('parses a revisioned version', () => {
    expect(parseHomebrewCommit('awscli@1: update 1.45.0_1 bottle.')).toEqual({ formula: 'awscli@1', version: '1.45.0_1', kind: 'bottle' });
  });
  it('ignores unrelated commits', () => {
    expect(parseHomebrewCommit('awscli@1: deprecate when maintenance mode starts (2026-07-15)')).toBeNull();
    expect(parseHomebrewCommit('some other formula 1.2.3')).toBeNull();
  });
});

describe('normalizeVersion', () => {
  it('strips a revision suffix', () => {
    expect(normalizeVersion('1.45.0_1')).toEqual({ versionNorm: '1.45.0', revision: 1 });
  });
  it('leaves a plain version alone', () => {
    expect(normalizeVersion('2.35.14')).toEqual({ versionNorm: '2.35.14', revision: 0 });
  });
});

describe('majorOf / formulaForMajor', () => {
  it('reads the major', () => {
    expect(majorOf('2.35.14')).toBe(2);
    expect(majorOf('1.45.0')).toBe(1);
  });
  it('maps major to formula', () => {
    expect(formulaForMajor(1)).toBe('awscli@1');
    expect(formulaForMajor(2)).toBe('awscli');
  });
});
