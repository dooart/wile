/**
 * Browser testing helper for Berserk agent
 *
 * Usage:
 *   npx tsx browser-test.ts screenshot <url> <output-path>
 *   npx tsx browser-test.ts verify <url> <selector>
 *
 * Examples:
 *   npx tsx browser-test.ts screenshot http://localhost:3000 .berserk-temp/screenshots/home.png
 *   npx tsx browser-test.ts verify http://localhost:3000/login "form#login"
 */

import { chromium, type Page, type Browser } from 'playwright';

const VIEWPORT = { width: 1280, height: 900 };
const TIMEOUT = 30000;

async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: TIMEOUT });
}

async function screenshot(url: string, outputPath: string): Promise<void> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { timeout: TIMEOUT });
    await waitForPageLoad(page);

    console.log(`Taking screenshot...`);
    await page.screenshot({ path: outputPath, fullPage: true });

    console.log(`Screenshot saved to ${outputPath}`);
  } finally {
    if (browser) await browser.close();
  }
}

async function verify(url: string, selector: string): Promise<boolean> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { timeout: TIMEOUT });
    await waitForPageLoad(page);

    console.log(`Looking for selector: ${selector}...`);
    const element = await page.$(selector);

    if (element) {
      console.log(`✓ Found element matching "${selector}"`);
      return true;
    } else {
      console.log(`✗ Element not found: "${selector}"`);
      return false;
    }
  } finally {
    if (browser) await browser.close();
  }
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case 'screenshot': {
      const [url, outputPath] = args;
      if (!url || !outputPath) {
        console.error('Usage: browser-test.ts screenshot <url> <output-path>');
        process.exit(1);
      }
      await screenshot(url, outputPath);
      break;
    }

    case 'verify': {
      const [url, selector] = args;
      if (!url || !selector) {
        console.error('Usage: browser-test.ts verify <url> <selector>');
        process.exit(1);
      }
      const found = await verify(url, selector);
      process.exit(found ? 0 : 1);
      break;
    }

    default:
      console.error('Commands: screenshot, verify');
      console.error('  screenshot <url> <output-path> - Take a full page screenshot');
      console.error('  verify <url> <selector>        - Check if selector exists on page');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
