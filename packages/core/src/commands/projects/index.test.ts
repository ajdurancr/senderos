import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { createProject } from "./create";
import { defaultProjectIdForPath } from "./default-id-for-path";
import { getProject } from "./get";
import { listProjects } from "./list";
import { updateProject } from "./update";
import { initHome, tempProjectDir } from "../../test-support/runtime";
import { createGoal } from "../goals/create";
import { listGoals } from "../goals/list";
import { createRunRecord } from "../runs/create";
import { listRuns } from "../runs/list";

describe("project services", () => {
  test("allows the same project name in different execution contexts", async () => {
    const home = await initHome();
    const first = await createProject({
      home,
      name: "Shared name",
      canonicalPath: tempProjectDir("context-project-a"),
      githubOwner: "ajdurancr",
      githubRepo: "project-a",
    });
    await expect(createProject({
      home,
      name: "Shared name",
      canonicalPath: tempProjectDir("context-project-duplicate"),
      githubOwner: "ajdurancr",
      githubRepo: "project-duplicate",
    })).rejects.toThrow();
    const { registerExecutionContext } = await import("../execution-contexts/register");
    await registerExecutionContext({ home, id: "context-secondary", name: "Secondary context" });
    const second = await createProject({
      home,
      executionContextId: "context-secondary",
      name: "Shared name",
      canonicalPath: tempProjectDir("context-project-b"),
      githubOwner: "ajdurancr",
      githubRepo: "project-b",
    });
    expect(first.executionContextId).not.toBe(second.executionContextId);
    expect(await listProjects(home, first.executionContextId)).toHaveLength(1);
    expect(await listProjects(home, second.executionContextId)).toHaveLength(1);
    await createGoal({ home, executionContextId: first.executionContextId, projectId: first.id, title: "First goal" });
    const secondGoal = await createGoal({ home, executionContextId: second.executionContextId, projectId: second.id, title: "Second goal" });
    await createRunRecord(secondGoal, home);
    expect((await listGoals(home, first.executionContextId)).map((goal) => goal.title)).toEqual(["First goal"]);
    expect((await listGoals(home, second.executionContextId)).map((goal) => goal.title)).toEqual(["Second goal"]);
    expect(await listRuns(home, first.executionContextId)).toHaveLength(0);
    expect(await listRuns(home, second.executionContextId)).toHaveLength(1);
  });
  test("derives project ids from package names when no explicit id is provided", () => {
    const canonicalPath = tempProjectDir(
      "senderos-test-project",
      "@senderos/test-project",
    );
    expect(defaultProjectIdForPath(canonicalPath)).toContain(
      "senderos-test-project-",
    );
  });

  test("falls back to the directory name for malformed package metadata", () => {
    const canonicalPath = tempProjectDir("senderos-malformed-package");
    writeFileSync(join(canonicalPath, "package.json"), "{not valid json");

    expect(defaultProjectIdForPath(canonicalPath)).toContain(
      "senderos-malformed-package-",
    );
  });

  test("creates and reads a project record", async () => {
    const home = await initHome();
    const canonicalPath = tempProjectDir("senderos-project-create");
    const created = await createProject({
      home,
      canonicalPath,
      githubOwner: "ajdurancr",
      githubRepo: "senderos",
    });

    expect(created.name).toBe("senderos-project-create");
    expect((await getProject(created.id, home))?.id).toBe(created.id);
  });

  test("lists stored projects in creation order", async () => {
    const home = await initHome();
    await createProject({
      home,
      canonicalPath: tempProjectDir("senderos-project-a"),
      githubOwner: "ajdurancr",
      githubRepo: "senderos",
    });
    await createProject({
      home,
      canonicalPath: tempProjectDir("senderos-project-b"),
      githubOwner: "ajdurancr",
      githubRepo: "senderos",
    });

    const projects = await listProjects(home);
    expect(projects).toHaveLength(2);
    expect(projects[0]?.name).toBe("senderos-project-a");
    expect(projects[1]?.name).toBe("senderos-project-b");
  });

  test("updates stored project fields", async () => {
    const home = await initHome();
    const created = await createProject({
      home,
      canonicalPath: tempProjectDir("senderos-project-update"),
      githubOwner: "ajdurancr",
      githubRepo: "senderos",
    });

    const updated = await updateProject({
      home,
      id: created.id,
      targetBranch: "develop",
      name: "Updated project",
    });
    expect(updated?.targetBranch).toBe("develop");
    expect(updated?.name).toBe("Updated project");
  });

  test("rejects when updating a missing project", async () => {
    const home = await initHome();
    await expect(
      updateProject({ home, id: "project-missing", name: "Missing" }),
    ).rejects.toThrow();
  });
});
