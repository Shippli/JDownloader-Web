import type { Preflight } from '@unocss/core';
import type { Theme } from '@unocss/preset-wind4';

export const preflights: Preflight<Theme>[] = [
  {
    getCSS: ({ theme }) => {
      return `
        :root {
          --radius: 0.5rem;
          --background: oklch(1 0 0);
          --foreground: oklch(0.141 0.004 285.824);
          --card: oklch(1 0 0);
          --card-foreground: oklch(0.141 0.004 285.824);
          --popover: oklch(1 0 0);
          --popover-foreground: oklch(0.141 0.004 285.824);
          --primary: oklch(0.21 0.006 285.884);
          --primary-foreground: oklch(0.985 0 0);
          --secondary: oklch(0.968 0.001 286.375);
          --secondary-foreground: oklch(0.21 0.006 285.884);
          --muted: oklch(0.968 0.001 286.375);
          --muted-foreground: oklch(0.552 0.014 285.942);
          --accent: oklch(0.968 0.001 286.375);
          --accent-foreground: oklch(0.21 0.006 285.884);
          --destructive: oklch(0.577 0.215 27.319);
          --success: oklch(0.627 0.194 149.214);
          --success-foreground: oklch(0.985 0 0);
          --warning: oklch(0.666 0.179 58.318);
          --warning-foreground: oklch(0.985 0 0);
          --info: oklch(0.546 0.245 262.881);
          --info-foreground: oklch(0.985 0 0);
          --border: oklch(0.92 0.004 286.32);
          --input: oklch(0.92 0.004 286.32);
          --ring: oklch(0.21 0.006 285.884);
          --sidebar: oklch(1 0 0);
          --sidebar-foreground: oklch(0.141 0.004 285.824);
          --sidebar-primary: oklch(0.21 0.006 285.884);
          --sidebar-primary-foreground: oklch(0.985 0 0);
          --sidebar-accent: oklch(0.968 0.001 286.375);
          --sidebar-accent-foreground: oklch(0.21 0.006 285.884);
          --sidebar-border: oklch(0.92 0.004 286.32);
          --sidebar-ring: oklch(0.21 0.006 285.884);
          --chart-1: oklch(0.646 0.222 41.116);
          --chart-2: oklch(0.6 0.118 184.704);
          --chart-3: oklch(0.398 0.07 227.392);
          --chart-4: oklch(0.828 0.189 84.429);
          --chart-5: oklch(0.769 0.188 70.08);
          --vis-tooltip-padding: calc(${theme.spacing?.DEFAULT} * 1.5)
            calc(${theme.spacing?.DEFAULT} * 2.5) !important;
          --vis-tooltip-box-shadow: ${theme.shadow?.xl} !important;
          --vis-tooltip-background-color: var(--background) !important;
          --vis-tooltip-border-color: var(--border) !important;
          --vis-tooltip-border-radius: ${theme.radius?.lg} !important;
          --vis-tooltip-text-color: var(--foreground) !important;
          --vis-font-family: var(--font-sans) !important;
          --vis-legend-label-color: var(--vis-tooltip-text-color) !important;
        }

        [data-kb-theme="dark"] {
          --background: oklch(0.21 0.006 285.884);
          --foreground: oklch(0.962 0 0);
          --card: oklch(0.254 0.005 286.016);
          --card-foreground: oklch(0.962 0 0);
          --popover: oklch(0.254 0.005 286.016);
          --popover-foreground: oklch(0.962 0 0);
          --primary: oklch(0.939 0 0);
          --primary-foreground: oklch(0.21 0.006 285.884);
          --secondary: oklch(0.315 0.007 286.012);
          --secondary-foreground: oklch(0.962 0 0);
          --muted: oklch(0.315 0.007 286.012);
          --muted-foreground: oklch(0.669 0.015 285.99);
          --accent: oklch(0.315 0.007 286.012);
          --accent-foreground: oklch(0.962 0 0);
          --destructive: oklch(0.636 0.208 25.378);
          --success: oklch(0.792 0.209 151.711);
          --success-foreground: oklch(0.21 0.006 285.884);
          --warning: oklch(0.828 0.189 84.429);
          --warning-foreground: oklch(0.21 0.006 285.884);
          --info: oklch(0.707 0.165 254.624);
          --info-foreground: oklch(0.21 0.006 285.884);
          --border: oklch(0.315 0.007 286.012);
          --input: oklch(0.315 0.007 286.012);
          --ring: oklch(0.756 0.011 286.143);
          --sidebar: oklch(0.21 0.006 285.884);
          --sidebar-foreground: oklch(0.962 0 0);
          --sidebar-primary: oklch(0.939 0 0);
          --sidebar-primary-foreground: oklch(0.21 0.006 285.884);
          --sidebar-accent: oklch(0.315 0.007 286.012);
          --sidebar-accent-foreground: oklch(0.962 0 0);
          --sidebar-border: oklch(0.315 0.007 286.012);
          --sidebar-ring: oklch(0.756 0.011 286.143);
          --chart-1: oklch(0.488 0.243 264.376);
          --chart-2: oklch(0.696 0.17 162.48);
          --chart-3: oklch(0.769 0.188 70.08);
          --chart-4: oklch(0.627 0.265 303.9);
          --chart-5: oklch(0.645 0.246 16.439);
        }

        * {
          @apply border-border outline-ring/50;
        }

        body {
          @apply bg-background text-foreground;
        }

        :where([data-somoto-toast][data-styled="true"]) {
          padding: 16px;
          border: 1px solid var(--normal-border);
        }
      `;
    },
  },
];
