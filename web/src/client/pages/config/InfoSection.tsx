import type { Component } from 'solid-js';
import { createResource } from 'solid-js';
import { configApi } from '../../lib/api';
import { ConnectionCard } from './info/ConnectionCard';
import { DownloadConfigCard } from './info/DownloadConfigCard';
import { JdInfoCard } from './info/JdInfoCard';
import { StorageCard } from './info/StorageCard';
import { SystemCard } from './info/SystemCard';

const InfoSection: Component = () => {
  const [info, { refetch }] = createResource(() => configApi.getInfo());

  return (
    <div class="space-y-6">
      <ConnectionCard onSaved={refetch} />
      <JdInfoCard info={info()} loading={info.loading} />
      <StorageCard />
      <DownloadConfigCard />
      <SystemCard />
    </div>
  );
};

export default InfoSection;
