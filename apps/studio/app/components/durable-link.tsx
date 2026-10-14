import { Link, useLocation, type LinkProps } from "react-router";

/** Keep scope across internal destinations; entity URLs remain durable server routes. */
export function DurableLink({ to, ...props }: LinkProps) {
  const location = useLocation();
  let destination = to;
  if (typeof to === "string" && to.startsWith("/") && !to.startsWith("//")) {
    const url = new URL(to, "http://studio.local");
    const current = new URLSearchParams(location.search);
    const currentProject = /^\/projects\/([^/]+)/.exec(location.pathname)?.[1];
    if (currentProject && !current.has("project")) current.set("project", decodeURIComponent(currentProject));
    for (const key of ["context", "project"]) {
      const value = current.get(key);
      if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
    }
    // A durable entity's owning project wins over the previous scope.
    const project = /^\/projects\/([^/]+)/.exec(url.pathname)?.[1];
    if (project && url.searchParams.has("project")) url.searchParams.set("project", decodeURIComponent(project));
    destination = `${url.pathname}${url.search}${url.hash}`;
  }
  return <Link {...props} to={destination} reloadDocument />;
}
