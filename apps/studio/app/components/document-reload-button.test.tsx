import { afterEach, expect, it, vi } from 'vitest';
import { DocumentReloadButton } from './document-reload-button';

afterEach(() => vi.unstubAllGlobals());

it('reloads the current document as an explicit non-submit action', () => {
  const reload = vi.fn();
  vi.stubGlobal('window', { location: { reload } });
  const control = DocumentReloadButton({ children: 'Read persisted state' });
  expect(control.type).toBe('button');
  expect(control.props.type).toBe('button');
  expect(control.props.className).toBe('button button-secondary');
  control.props.onClick();
  expect(reload).toHaveBeenCalledOnce();
});
