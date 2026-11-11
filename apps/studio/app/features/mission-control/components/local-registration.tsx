import { Form, useActionData, useNavigation, useSearchParams } from "react-router";
import type { MissionControlData } from "../server";

/** Register shared-database identities; execution remains a separate operator step. */
export function LocalRegistration({ data, projectId }: { data: MissionControlData; projectId?: string }) {
  const [search] = useSearchParams();
  const pending = useNavigation().state !== "idle";
  const feedback = useActionData<{ ok?: boolean; intent?: string; message?: string }>();
  const contexts = data.executionContexts;
  const requestedContext = search.get("context") ?? data.projects.find(project => project.id === projectId)?.executionContextId;
  const contextId = requestedContext ? (contexts.some(context => context.id === requestedContext) ? requestedContext : "") : contexts.length === 1 ? contexts[0]!.id : "";
  return <section className="settings-section">
    <header><div><span><h2>Set up a workspace</h2><p>Organize work in this database before creating a goal.</p></span></div></header>
    <p>Execution contexts separate teams or work environments. Projects group their goals. Registration records these identities; it does not connect a repository or start execution.</p>
    <details open={data.projects.length === 0}>
      <summary>Add a project</summary>
      <Form method="post" key={`project-registration-${contextId}`}>
        <input type="hidden" name="intent" value="register-project" />
        <fieldset disabled={pending} className="settings-fields"><legend className="visually-hidden">New project details</legend>
          <label>Project name<input name="name" required maxLength={200} aria-describedby="registration-project-help" /><small id="registration-project-help">Use a recognizable name, such as Research notebook.</small></label>
          <label>Project execution context<select name="executionContextId" required defaultValue={contextId} disabled={contexts.length === 0} aria-describedby="registration-context-help">
            <option value="" disabled>Choose a context</option>
            {contexts.map(context => <option key={context.id} value={context.id}>{context.name}</option>)}
          </select><small id="registration-context-help">{contexts.length ? "The project belongs to this context. Confirm it before adding." : "Add an execution context below first."}</small></label>
        </fieldset>
        {!pending && feedback?.intent === 'register-project' && !feedback.ok && <div className="action-feedback error" role="alert">{feedback.message}</div>}
        <footer><span>Starts with no repository integration. Configure delivery later.</span><button type="reset" className="button button-secondary" disabled={pending}>Discard project registration</button><button className="button button-primary" disabled={pending || contexts.length === 0}>{pending ? "Saving…" : "Add project"}</button></footer>
      </Form>
    </details>
    <details open={contexts.length === 0}>
      <summary>Add an execution context</summary>
      <Form method="post">
        <input type="hidden" name="intent" value="register-context" />
        <fieldset disabled={pending} className="settings-fields"><legend className="visually-hidden">New execution context details</legend><label>Context name<input name="name" required maxLength={200} aria-describedby="registration-new-context-help" /><small id="registration-new-context-help">Choose a distinct team or environment name. Existing contexts remain unchanged.</small></label></fieldset>
        {!pending && feedback?.intent === 'register-context' && !feedback.ok && <div className="action-feedback error" role="alert">{feedback.message}</div>}
        <footer><span>The new context will be selected so you can add its first project.</span><button type="reset" className="button button-secondary" disabled={pending}>Discard context registration</button><button className="button button-primary" disabled={pending}>{pending ? "Saving…" : "Add context"}</button></footer>
      </Form>
    </details>
  </section>;
}
