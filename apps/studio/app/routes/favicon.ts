import { redirect } from 'react-router';

// Browsers and older bookmarks may still request the conventional icon path.
// Keep it out of the operational wildcard loader, even without a database.
export function loader() {
  return redirect('/favicon.svg', { headers: { 'Cache-Control': 'public, max-age=86400' } });
}
