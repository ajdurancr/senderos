import { expect, test } from 'bun:test';
import { completionPolicy, jsonObject, requirementsPolicy } from './definition-input';

test('validates authored execution policy JSON', () => {
  expect(jsonObject('{"outcome":"ok"}', 'Condition')).toEqual({ outcome: 'ok' });
  expect(() => jsonObject('broken', 'Condition')).toThrow('valid JSON');
  expect(() => jsonObject([], 'Condition')).toThrow('object');
  expect(completionPolicy({ requireReview: true, evidenceKinds: ['artifact'] })).toEqual({ requireReview: true, evidenceKinds: ['artifact'] });
  expect(() => completionPolicy({ surprise: true })).toThrow('Unsupported');
  expect(() => completionPolicy({ requireReview: 'true' })).toThrow('boolean');
  expect(() => completionPolicy({ evidenceKinds: ['unverified'] })).toThrow('evidence');
  expect(requirementsPolicy('["browser","browser"]')).toEqual(['browser']);
  expect(() => requirementsPolicy('broken')).toThrow('valid JSON');
  expect(() => requirementsPolicy([''])).toThrow('nonempty');
});

test('capability identifiers match the host registry grammar', () => {
  expect(requirementsPolicy(['browser', 'shell.exec', 'files:read', 'custom_tool-v2'])).toHaveLength(4);
  for (const name of ['has spaces', ' trailing', '-starts-with-symbol', 'emoji🙂', 'path/read'])
    expect(() => requirementsPolicy([name])).toThrow('capability identifiers');
});
