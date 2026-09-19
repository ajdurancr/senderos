import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import App, { ErrorBoundary, Layout, links } from './root';

afterEach(cleanup);

describe('Studio document root', () => {
  it('declares links and composes the document shell and route outlet', () => {
    expect(links()).toEqual([]);
    expect(Layout({ children: 'Studio content' }).props.children).toBeTruthy();
    expect(App().type).toBeTruthy();
  });

  it.each([
    {
      error: {
        status: 404,
        statusText: 'Not Found',
        internal: true,
        data: 'Missing',
      },
      title: 'That Studio page does not exist',
    },
    {
      error: new Error('Missing env:SENDEROS_DATABASE_URL'),
      title: 'Studio needs a database connection',
    },
    {
      error: new Error('Request failed', { cause: new Error('sqlite network error') }),
      title: 'Studio could not reach the Senderos database',
    },
    {
      error: 'unexpected failure',
      title: 'Studio hit an unexpected problem',
    },
  ])('renders the $title recovery state', ({ error, title }) => {
    render(<ErrorBoundary error={error} params={{}} />);
    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Return to Studio' })).toBeTruthy();
  });
});
