import { afterAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { RouterContextProvider } from "react-router";

const testRuntimeBase = resolve(
  process.env.SENDEROS_TEST_RUNTIME_ROOT ??
    resolve(import.meta.dirname, "../../../../../.tmp/test-runtime"),
);
const testRuntimeRoot = resolve(testRuntimeBase, "studio");
mkdirSync(testRuntimeRoot, { recursive: true });
const databasePath = join(testRuntimeRoot, `senderos-studio-${crypto.randomUUID()}.db`);
process.env.SENDEROS_DATABASE_URL = `file:${databasePath}`;

describe("Studio server integration", () => {
  afterAll(() => {
    rmSync(testRuntimeRoot, { recursive: true, force: true });
    if (existsSync(testRuntimeBase) && readdirSync(testRuntimeBase).length === 0) {
      rmSync(testRuntimeBase, { recursive: true, force: true });
    }
  });

  it("loads the shared database and applies every Studio intent", async () => {
    const { missionControlData, applyMissionControlAction } = await import("./server");
    const { senderosForStudio } = await import("../../server/senderos.server");
    await missionControlData();
    const senderos = senderosForStudio();
    const context = await (await import("@senderos/core")).registerExecutionContext({ id: "context-studio", name: "Studio test" });
    const scoped = (await import("@senderos/core")).createSenderos({ executionContextId: context.id });
    const project = await scoped.commands.projects.create({ id: "project-studio", name: "Studio project", canonicalPath: "/tmp/studio-project", githubOwner: "owner", githubRepo: "repo" });
    const graph = (await senderos.missionControl.senderos.listGraphs())[0]!;

    const create = new FormData();
    Object.entries({ intent: "create-goal", projectId: project.id, title: "Studio goal", kind: "feature", specText: "Ship it", senderoVersionId: graph.version.id }).forEach(([key, value]) => create.set(key, value));
    await applyMissionControlAction(create);
    let data = await missionControlData();
    const goal = data.goals.find((item) => item.title === "Studio goal")!;

    const start = new FormData(); start.set("intent", "start"); start.set("goalId", goal.id); await applyMissionControlAction(start);
    const plan = new FormData(); plan.set("intent", "dispatch-plan"); await applyMissionControlAction(plan);
    data = await missionControlData();
    const attempt = data.attempts.at(-1)!;

    const evidence = new FormData(); Object.entries({ intent: "evidence", attemptId: attempt.id, label: "Proof", url: "https://example.test/proof" }).forEach(([key, value]) => evidence.set(key, value)); await applyMissionControlAction(evidence);
    const review = new FormData(); Object.entries({ intent: "review", attemptId: attempt.id, status: "approved", rationale: "Looks good" }).forEach(([key, value]) => review.set(key, value)); await applyMissionControlAction(review);
    const evidenceWithoutUrl = new FormData(); Object.entries({ intent: "evidence", attemptId: attempt.id, label: "Local proof", url: "" }).forEach(([key, value]) => evidenceWithoutUrl.set(key, value)); await applyMissionControlAction(evidenceWithoutUrl);
    const reviewWithoutRationale = new FormData(); Object.entries({ intent: "review", attemptId: attempt.id, status: "changes_requested", rationale: "" }).forEach(([key, value]) => reviewWithoutRationale.set(key, value)); await applyMissionControlAction(reviewWithoutRationale);
    const stop = new FormData(); stop.set("intent", "stop"); stop.set("runId", attempt.runId); await applyMissionControlAction(stop);

    const updateProject = new FormData(); Object.entries({ intent: "update-project", projectId: project.id, name: "Updated project", targetBranch: "develop", integrationMode: "local_merge" }).forEach(([key, value]) => updateProject.set(key, value)); await applyMissionControlAction(updateProject);
    const node = graph.nodes[0]!;
    const position = new FormData(); Object.entries({ intent: "update-sendero-node-position", nodeId: node.id, positionX: "111", positionY: "222" }).forEach(([key, value]) => position.set(key, value)); await applyMissionControlAction(position);
    const layout = new FormData(); layout.set("intent", "update-sendero-layout"); layout.set("positions", JSON.stringify({ [node.id]: { x: 333, y: 444 } })); await applyMissionControlAction(layout);
    const updateNode = new FormData(); Object.entries({ intent: "update-sendero-node", nodeId: node.id, label: "New start" }).forEach(([key, value]) => updateNode.set(key, value)); await applyMissionControlAction(updateNode);
    const edge = graph.edges[0]!;
    const updateEdge = new FormData(); Object.entries({ intent: "update-sendero-edge", edgeId: edge.id, name: "Updated arc", description: "Updated", transitionObjective: "Continue", status: "active" }).forEach(([key, value]) => updateEdge.set(key, value)); await applyMissionControlAction(updateEdge);

    data = await missionControlData();
    expect(data.projects.find((item) => item.id === project.id)).toMatchObject({ name: "Updated project", targetBranch: "develop" });
    expect(data.runtime.database).toMatchObject({ endpoint: "Local libSQL database", remote: false });
    expect(data.attempts.find((item) => item.id === attempt.id)?.statusSnapshotJson).toContain("changes_requested");

    const homeRoute = await import("../../routes/home");
    const routeContext = new RouterContextProvider();
    const routeUrl = new URL("http://localhost/");
    expect(await homeRoute.loader({ request: new Request(routeUrl), url: routeUrl, pattern: "/", params: {}, context: routeContext })).toMatchObject({ projects: data.projects });
    const noOp = new FormData(); noOp.set("intent", "no-op");
    expect(await homeRoute.action({ request: new Request(routeUrl, { method: "POST", body: noOp }), url: routeUrl, pattern: "/", params: {}, context: routeContext })).toBeNull();
  }, 30_000);
});
