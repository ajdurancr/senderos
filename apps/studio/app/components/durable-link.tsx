import { Link, type LinkProps } from "react-router";

/**
 * Studio entity URLs are durable server routes. Full document navigation keeps
 * every destination independent from the route module that initiated it and
 * avoids stale canvas state leaking across workspace views.
 */
export function DurableLink(props: LinkProps) {
  return <Link {...props} reloadDocument />;
}
