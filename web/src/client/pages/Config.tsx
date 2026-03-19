import type { Component } from 'solid-js';
import { createSignal } from 'solid-js';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../components/ui/Tabs';
import { t } from '../i18n';
import AccountsSection from './config/AccountsSection';
import ExtensionsSection from './config/ExtensionsSection';
import InfoSection from './config/InfoSection';
import SettingsSection from './config/SettingsSection';
import UsersSection from './config/UsersSection';
import WebSection from './config/WebSection';

const Config: Component = () => {
  const [activeTab, setActiveTab] = createSignal('info');

  return (
    <div>
      <div class="mb-6">
        <h1 class="text-2xl font-bold tracking-tight text-foreground">{t('config.title')}</h1>
        <p class="text-sm text-muted-foreground mt-1">{t('config.subtitle')}</p>
      </div>

      <TabsRoot value={activeTab()} onChange={setActiveTab}>
        <TabsList class="mb-6">
          <TabsTrigger value="info">
            <span class="i-tabler-info-circle w-4 h-4" />
            <span class="hidden sm:inline">{t('config.tabs.jd')}</span>
          </TabsTrigger>
          <TabsTrigger value="accounts">
            <span class="i-tabler-credit-card w-4 h-4" />
            <span class="hidden sm:inline">{t('config.tabs.accounts')}</span>
          </TabsTrigger>
          <TabsTrigger value="users">
            <span class="i-tabler-users w-4 h-4" />
            <span class="hidden sm:inline">{t('config.tabs.users')}</span>
          </TabsTrigger>
          <TabsTrigger value="settings">
            <span class="i-tabler-settings-2 w-4 h-4" />
            <span class="hidden sm:inline">{t('config.tabs.advanced')}</span>
          </TabsTrigger>
          <TabsTrigger value="extensions">
            <span class="i-tabler-puzzle w-4 h-4" />
            <span class="hidden sm:inline">{t('config.tabs.extensions')}</span>
          </TabsTrigger>
          <TabsTrigger value="web">
            <span class="i-tabler-world w-4 h-4" />
            <span class="hidden sm:inline">{t('config.tabs.web')}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="info"><InfoSection /></TabsContent>
        <TabsContent value="accounts"><AccountsSection /></TabsContent>
        <TabsContent value="users"><UsersSection /></TabsContent>
        <TabsContent value="settings"><SettingsSection /></TabsContent>
        <TabsContent value="extensions"><ExtensionsSection /></TabsContent>
        <TabsContent value="web"><WebSection /></TabsContent>
      </TabsRoot>
    </div>
  );
};

export default Config;
