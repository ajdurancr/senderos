import { useLoaderData, useNavigation } from 'react-router';

import { MissionControlOverview } from '../features/mission-control/overview';
import {
  applyMissionControlAction,
  missionControlData,
} from '../features/mission-control/server';
import { StudioLayout } from '../layouts/studio-layout';
import type { Route } from './+types/home';

export function meta() {
  return [
    { title: 'Mission Control · Senderos Studio' },
    { name: 'description', content: 'Operational control plane for verified software outcomes.' },
  ];
}

export async function loader() {
  return missionControlData();
}

export async function action({ request }: Route.ActionArgs) {
  await applyMissionControlAction(await request.formData());
  return null;
}

export default function Home() {
  const data = useLoaderData<typeof loader>();
  const pending = useNavigation().state !== 'idle';
  return <StudioLayout pending={pending}><MissionControlOverview data={data} /></StudioLayout>;
}
