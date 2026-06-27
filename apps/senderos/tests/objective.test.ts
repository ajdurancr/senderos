import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFeature, initializeRuntime, schedulePlan, status } from '../src/index';

describe('senderos exports', () => {
  test('can create a feature after init', () => {
    const home = mkdtempSync(join(tmpdir(), 'senderos-export-'));
    try {
      initializeRuntime(home);
      const feature = createFeature({ home, title: 'Bootstrap Senderos' });
      expect(feature.id).toContain('feature-');
      expect(status(home).openFeatures).toBe(1);
      expect(schedulePlan(home).command).toContain('senderos');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
