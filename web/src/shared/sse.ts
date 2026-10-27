// SSE protocol shared by server (broadcaster) and client (stores/sse).

export type EntityDelta<P = unknown, L = unknown> = {
  packages?: P[];
  removedPackages?: number[];
  links?: L[];
  removedLinks?: number[];
};

export type DownloadsSnapshot<P = unknown, L = unknown> = {
  packages: P[];
  links: L[];
  state: string;
  speed: number;
  exProgress: Record<number, number>;
};

export type SseEntityTypes = {
  downloadPackage: unknown;
  downloadLink: unknown;
  grabberPackage: unknown;
  grabberLink: unknown;
  dialog: unknown;
  captcha: unknown;
};

export type SseServerMessage<T extends SseEntityTypes = SseEntityTypes>
  = | { type: 'health'; jd: boolean }
    | ({ type: 'downloads'; full: true; seq: number } & DownloadsSnapshot<T['downloadPackage'], T['downloadLink']>)
    | ({ type: 'downloads'; full: false; seq: number; state?: string; speed?: number; exProgress?: Record<number, number> } & EntityDelta<T['downloadPackage'], T['downloadLink']>)
    | { type: 'grabber'; full: true; seq: number; packages: T['grabberPackage'][]; links: T['grabberLink'][] }
    | ({ type: 'grabber'; full: false; seq: number } & EntityDelta<T['grabberPackage'], T['grabberLink']>)
    | { type: 'notifications'; dialogs: T['dialog'][]; captchas: T['captcha'][]; updateAvailable: boolean }
    | { type: 'hello'; epoch: string; heartbeatMs: number }
    | { type: 'heartbeat'; epoch: string; seq: number };
