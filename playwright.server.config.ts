import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/remote-server', workers:1, fullyParallel:false, timeout:60000,
  outputDir:'/tmp/viptv-tv-real-server-tests',
  use:{ baseURL:'https://viptv.local.test:18565',viewport:{width:1920,height:1080},reducedMotion:'reduce',
    launchOptions:{args:['--enable-unsafe-swiftshader']},screenshot:'only-on-failure' },
});
