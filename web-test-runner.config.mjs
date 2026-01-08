import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
    files: 'test/**/*.test.js',
    nodeResolve: true,
    concurrentBrowsers: 1,
    // Use Playwright to run headless Chromium in CI
    browsers: [
        playwrightLauncher({
            product: 'chromium',
            // headless is default; adjust if you need headed
        }),
    ],
    testFramework: {
        config: {
            timeout: 20000,
        },
    },
};
