import { expect, test } from 'bun:test';
import { afterEach } from 'bun:test';
import {
  cleanupIntegrationRunRoot,
  cleanupIntegrationTemps,
  cli,
  createTempProject,
  openDb,
  pathExists,
  tempDir,
} from './helpers';

afterEach(() => {
  cleanupIntegrationTemps();
  cleanupIntegrationRunRoot();
});

test('integration helpers create projects, directories, and database handles', () => {
  const directory = tempDir('helpers');
  const project = createTempProject({
    extraFiles: [{ path: 'notes.txt', content: 'ready' }],
  });
  expect(pathExists(directory)).toBe(true);
  expect(pathExists(project)).toBe(true);
  const db = openDb(directory);
  db.exec('create table smoke (id integer)');
  db.close();
});

test('integration CLI helper executes Senderos and cleanup removes artifacts', () => {
  const directory = tempDir('cleanup');
  expect(cli(['help']).command).toBe('senderos');
  cleanupIntegrationTemps();
  expect(pathExists(directory)).toBe(false);
});
