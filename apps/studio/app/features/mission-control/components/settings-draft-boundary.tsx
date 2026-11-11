import { useState, type ReactNode } from 'react';
import { useNavigation } from 'react-router';
import { DraftNavigationGuard } from '../../../components/draft-navigation-guard';

/** One router/document boundary for every draft on the settings page. */
export function SettingsDraftBoundary({ settingsDirty, children }: { settingsDirty: boolean; children: ReactNode }) {
  const [registration, setRegistration] = useState({ project: false, context: false });
  const pending = useNavigation().state !== 'idle';
  function changed(form: HTMLFormElement, reset = false) {
    const intent = new FormData(form).get('intent');
    if (intent !== 'register-project' && intent !== 'register-context') return;
    const dirty = !reset && Array.from(form.elements).some(element => {
      if (element instanceof HTMLInputElement && element.name === 'name') return element.value !== element.defaultValue;
      if (element instanceof HTMLSelectElement) return element.value !== Array.from(element.options).find(option => option.defaultSelected)?.value;
      return false;
    });
    setRegistration(previous => ({ ...previous, [intent === 'register-project' ? 'project' : 'context']: dirty }));
  }
  return <div onChange={event => {
    const form = (event.target as HTMLInputElement).form;
    if (form) changed(form);
  }} onReset={event => changed(event.target as HTMLFormElement, true)} onSubmitCapture={event => {
    const form = event.target as HTMLFormElement;
    const intent = new FormData(form).get('intent');
    if (intent !== 'register-project' && intent !== 'register-context') return;
    // Registration redirects select a new scope. Router blockers do not intercept
    // action redirects, so get explicit consent before risking another form's draft.
    const otherDirty = settingsDirty || (intent === 'register-project' ? registration.context : registration.project);
    if (otherDirty) {
      if (!window.confirm('Registration selects a new scope when it succeeds. Your unsaved edits in the other settings forms will be discarded. Continue registration?')) {
        event.preventDefault();
        return;
      }
    }
  }}>
    <DraftNavigationGuard subject={registration.project || registration.context ? 'workspace setup' : 'project settings'} dirty={settingsDirty || registration.project || registration.context} saving={pending} />
    {children}
  </div>;
}
