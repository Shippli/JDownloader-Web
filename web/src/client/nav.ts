// @unocss-include
import { t } from './i18n';

export type NavItem = {
  href: string;
  label: () => string;
  icon: string;
};

export const navItems: NavItem[] = [
  { href: '/downloads', label: () => t('nav.downloads'), icon: 'i-tabler-download' },
  { href: '/grabber', label: () => t('nav.grabber'), icon: 'i-tabler-link' },
];
