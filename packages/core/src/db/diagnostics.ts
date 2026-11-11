/** Messages owned by Core, with no driver-supplied connection details. */
export class DatabaseDiagnosticError extends Error {
  constructor(message: string) { super(message); }
}

/** Presentation only: never pass this URL to the database driver. */
export function diagnosticDatabaseUrl(url: string) {
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return "[invalid database URL]";
  try { new URL(url); }
  catch { return "[invalid database URL]"; }
  const fragment = url.indexOf("#");
  const base = fragment < 0 ? url : url.slice(0, fragment);
  const query = base.indexOf("?");
  const address = (query < 0 ? base : base.slice(0, query))
    .replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/?#]*@/i, "$1[redacted]@");
  const options = query < 0 ? "" : "?" + base.slice(query + 1).split("&").map(pair => {
    if (!pair) return "";
    const split = pair.indexOf("=");
    const key = split < 0 ? pair : pair.slice(0, split);
    const value = split < 0 ? "" : pair.slice(split + 1);
    let decoded: string;
    try { decoded = decodeURIComponent(key.replaceAll("+", " ")); }
    catch { return "[redacted]"; }
    if (decoded === "authToken") return `${key}=[redacted]`;
    if (decoded === "tls" || decoded === "cache") {
      const safe = decoded === "tls" ? /^(0|1)$/ : /^(shared|private)$/;
      return `${key}=${safe.test(value) ? value : "[redacted]"}`;
    }
    return "[redacted]";
  }).join("&");
  return address + options + (fragment < 0 ? "" : "#[redacted]");
}

/** Driver messages can contain URLs, decoded credentials or server responses. */
export function diagnosticDatabaseFailure(error: unknown) {
  if (error instanceof DatabaseDiagnosticError) return error.message;
  const code = (error as { code?: unknown } | null)?.code;
  if (["URL_INVALID", "URL_PARAM_NOT_SUPPORTED", "URL_SCHEME_NOT_SUPPORTED"].includes(code as string))
    return "Invalid database connection: Check the configured URL scheme, encoding and supported options.";
  if (["SQLITE_NOTADB", "SQLITE_CORRUPT"].includes(code as string))
    return "Database file is unreadable or damaged: Preserve it and follow the documented recovery path.";
  if (["SQLITE_BUSY", "SQLITE_LOCKED"].includes(code as string))
    return "Database is busy: Wait for other database work to finish and retry diagnostics.";
  if (["EACCES", "EPERM", "SQLITE_CANTOPEN", "SQLITE_IOERR"].includes(code as string))
    return "Database file is inaccessible: Check the configured path, directory permissions and storage availability.";
  return "Database health check failed: Check the configured URL, credentials, access and connectivity. Driver details are omitted to protect credentials.";
}
