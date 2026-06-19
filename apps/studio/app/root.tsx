import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message = error instanceof Error ? error.message : "Unknown error";

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-rose-300">Studio error</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">The route failed to render.</h1>
        <p className="mt-4 text-sm leading-7 text-slate-200">{message}</p>
      </div>
    </main>
  );
}
