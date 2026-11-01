import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'ui.spec.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:3100', headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-zygote', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {},
  },
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/mis/login', reuseExistingServer: false,
    env: { AUTH_SECRET: 'test-only-session-secret', MIS_ADMIN_USERNAME: 'test-admin', MIS_ADMIN_PASSWORD: 'test-only-password' },
  },
});
