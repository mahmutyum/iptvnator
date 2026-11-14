import { chromium } from '@playwright/test';
import { expect, test } from './fixtures';
import { configureMockProviderBackend } from './provider-target-route';
import {
    addXtreamPortal,
    DEFAULT_PASSWORD,
    DEFAULT_USERNAME,
    interceptXtreamRequests,
    MOCK_SERVER,
} from './xtream-series-playback.fixture';

test('@xtream @pwa standalone series details stop vertical overscroll', async ({
    browserName,
    baseURL,
    request,
}) => {
    test.skip(browserName !== 'chromium', 'Requires Chromium app mode');
    const context = await chromium.launchPersistentContext('', {
        baseURL,
        channel: 'chromium',
        args: [`--app=${baseURL}`],
        serviceWorkers: 'block',
    });
    try {
        const [page] = context.pages();
        await configureMockProviderBackend(page);
        await interceptXtreamRequests(page);
        await page.goto('/');
        await expect
            .poll(() =>
                page.evaluate(
                    () => matchMedia('(display-mode: standalone)').matches
                )
            )
            .toBe(true);
        await addXtreamPortal(page);
        const response = await request.get(`${MOCK_SERVER}/player_api.php`, {
            params: {
                username: DEFAULT_USERNAME,
                password: DEFAULT_PASSWORD,
                action: 'get_series',
            },
        });
        expect(response.ok()).toBe(true);
        const [series] = (await response.json()) as {
            category_id: number;
            series_id: number;
        }[];
        if (!series) throw new Error('Missing Xtream series fixture');
        const seriesLink = page.getByRole('link', {
            name: 'Series',
            exact: true,
        });
        const seriesUrl = await seriesLink.getAttribute('href');
        if (!seriesUrl) throw new Error('Missing Xtream series route');
        await page.goto(
            `${seriesUrl}/${series.category_id}/${series.series_id}`
        );
        const shell = page.locator('app-portal-detail-shell');
        await expect(shell.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(shell).toHaveCSS('overscroll-behavior-y', 'none');
    } finally {
        await context.close();
    }
});
