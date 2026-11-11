import { missionControlData } from '../features/mission-control/server';

/** Read the same scoped snapshot without replacing a mounted editor on failure. */
export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const pathname = url.searchParams.get('_pathname') ?? '/';
  if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('?') || pathname.includes('#')) {
    return Response.json({ ok: false }, { status: 400 });
  }
  url.pathname = pathname;
  url.searchParams.delete('_pathname');
  try {
    const data = await missionControlData(new Request(url, { signal: request.signal }));
    return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Database and transport details can contain secrets. Keep the previous
    // snapshot visible and give the operator an actionable, bounded error.
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
