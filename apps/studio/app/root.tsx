import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import { DocumentHtml } from "./components/document-html";
import "./app.css";

export const links: Route.LinksFunction = () => [];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DocumentHtml>
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
    </DocumentHtml>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const technicalMessage = error instanceof Error ? error.message : String(error);
  const fullError = error instanceof Error && error.cause instanceof Error
    ? `${technicalMessage} ${error.cause.message}`
    : technicalMessage;
  const databaseError = /SENDEROS_DATABASE|libsql|sqlite|database|fetch failed|network|auth/i.test(fullError);
  const missingConfiguration = /Missing env:SENDEROS_DATABASE_URL/i.test(fullError);
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const title = notFound
    ? "That Studio page does not exist"
    : missingConfiguration
      ? "Studio needs a database connection"
      : databaseError
        ? "Studio could not reach the Senderos database"
        : "Studio hit an unexpected problem";
  const message = notFound
    ? "The URL may be stale or the referenced entity may have moved."
    : missingConfiguration
      ? "Set SENDEROS_DATABASE_URL for the Studio process. For a remote libSQL database, also provide SENDEROS_DATABASE_AUTH_TOKEN."
      : databaseError
        ? "Check the database URL, credentials, and network access. Studio will migrate and seed a reachable database automatically."
        : "Your data was not changed. Try the request again; if it keeps failing, inspect the server log using the reference below.";

  return (
    <main className="error-page">
      <div className="error-card">
        <div className="error-mark">!</div>
        <p>Senderos Studio</p>
        <h1>{title}</h1>
        <span>{message}</span>
        <div className="error-actions"><a href="">Try again</a><a href="/">Return to Studio</a></div>
        <small>Detailed diagnostics are available in the Studio server log.</small>
      </div>
    </main>
  );
}
