import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.tabsplit.com',
  appName: 'TabSplit',
  // webDir is required by the Capacitor CLI schema but unused at runtime
  // because server.url causes the native shell to load the remote Vercel deployment
  // rather than bundling any local static files.
  webDir: 'out',
  server: {
    url: 'https://tabsplit-three.vercel.app',
    cleartext: false,
  },
};

export default config;
