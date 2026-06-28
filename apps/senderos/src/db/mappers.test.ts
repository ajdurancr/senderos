import { describe, expect, test } from 'bun:test';
import { mapFeatureRow, mapTaskRow } from './mappers';

describe('db mappers', () => {
  test('maps feature and task rows and nulls', () => {
    expect(mapFeatureRow(null)).toBeNull();
    expect(mapTaskRow(null)).toBeNull();
    expect(mapFeatureRow({ id:'f', title:'t', problem_statement:'p', contract_text:'c', status:'defined', loop_phase:'idle', completion_criteria:'cc', current_workspace_id:null, current_run_id:null, created_at:'a', updated_at:'b' })?.problemStatement).toBe('p');
    expect(mapTaskRow({ id:'t', feature_id:'f', name:'n', phase:'contract', status:'ready', instruction_json:'{}', result_json:'{}', created_at:'a', updated_at:'b' })?.featureId).toBe('f');
  });
});
