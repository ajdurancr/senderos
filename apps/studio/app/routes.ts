import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  route("favicon.ico", "routes/favicon.ts"),
  route("resources/snapshot", "routes/snapshot.ts"),
  index("routes/home.tsx"),
  route("*", "routes/studio.tsx"),
] satisfies RouteConfig;
