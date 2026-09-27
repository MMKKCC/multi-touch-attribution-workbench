import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

console.log('Navigating...');
await page.goto('http://localhost:5200', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(2000);
await page.waitForTimeout(1000);

// Screenshot 1: Home overview (before generate)
await page.screenshot({ path: 'docs/screenshots/mta_01_home_overview.png' });
console.log('✓ Screenshot 1: Home overview');

// Click Generate & Calculate
const btns = await page.locator('button').allTextContents();
console.log('Buttons found:', btns);

// Find the generate button
await page.locator('button').filter({ hasText: /Generate/ }).first().click();
console.log('Clicked generate, waiting 12s for calculations...');
await page.waitForTimeout(12000);

// Screenshot 2: Flow visualizer (after calculate)
await page.screenshot({ path: 'docs/screenshots/mta_02_flow_visualizer.png' });
console.log('✓ Screenshot 2: Flow visualizer');

// Get all right-panel tab buttons
const rightTabBtns = await page.locator('.right-panel .tab-btn').allTextContents();
console.log('Right tabs:', rightTabBtns);

// Click Model Comparison
await page.locator('.right-panel .tab-btn').filter({ hasText: 'Model Comparison' }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: 'docs/screenshots/mta_03_model_comparison.png' });
console.log('✓ Screenshot 3: Model Comparison');

// Click Velocity
await page.locator('.right-panel .tab-btn').filter({ hasText: 'Velocity' }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'docs/screenshots/mta_04_velocity_heatmap.png' });
console.log('✓ Screenshot 4: Velocity heatmap');

// Click Dice Roll
await page.locator('.right-panel .tab-btn').filter({ hasText: 'Dice Roll' }).click();
await page.waitForTimeout(500);
const loadBtn = page.locator('button').filter({ hasText: 'Load Journey' });
if (await loadBtn.count() > 0) {
  await loadBtn.click();
  await page.waitForTimeout(500);
}
await page.screenshot({ path: 'docs/screenshots/mta_05_dice_roll.png' });
console.log('✓ Screenshot 5: Dice Roll');

// Back to Flow, switch left panel to Budget
await page.locator('.right-panel .tab-btn').filter({ hasText: 'Flow' }).click();
await page.locator('.left-panel .tab-btn').filter({ hasText: 'Budget' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: 'docs/screenshots/mta_06_budget_panel.png' });
console.log('✓ Screenshot 6: Budget panel');

// Left panel: Lessons
await page.locator('.left-panel .tab-btn').filter({ hasText: 'Lessons' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: 'docs/screenshots/mta_07_preset_lessons.png' });
console.log('✓ Screenshot 7: Preset lessons');

await browser.close();
console.log('\nAll screenshots captured!');
