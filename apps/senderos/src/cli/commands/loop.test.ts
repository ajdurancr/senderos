import { describe, expect, test } from 'bun:test';
import { handleLoop } from './loop';
import { approveFeature, createFeature } from '../../services/runtime';
import { initHome } from '../../../tests/helpers/runtime';

describe('handleLoop', () => {
  test('covers start, resume, tick, show, and default error path', () => {
    const home = initHome();
    const feature = approveFeature(createFeature({ home, title: 'Loop command target' }).id, home)!;
    const started: any = handleLoop('start', ['loop', 'start', feature.id], home);
    expect(started.run).toBeTruthy();
    const shown: any = handleLoop('show', ['loop', 'show', feature.id], home);
    expect(shown.feature.id).toBe(feature.id);
    const resumed: any = handleLoop('resume', ['loop', 'resume', feature.id], home);
    expect(resumed.run).toBeTruthy();
    const ticked: any = handleLoop('tick', ['loop', 'tick', feature.id], home);
    expect(ticked.feature).toBeTruthy();
    expect(() => handleLoop('wat', ['loop', 'wat', feature.id], home)).toThrow('Unknown loop action');
  });
});
