import { chromium } from '@playwright/test';

async function testRealBrowserAudio() {
  console.log('--- Real Browser Playback Test ---');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs = [];
  const errors = [];

  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  console.log('Navigating to http://localhost:3000/...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  // 1. Check FAB button presence
  const fabButton = page.locator('.accessibility-fab button').last();
  await fabButton.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Found Accessibility FAB button');

  // 2. Open accessibility drawer
  await fabButton.click();
  const readScreenBtn = page.getByRole('button', { name: /What is on this screen/i });
  await readScreenBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Accessibility Drawer opened');

  // 3. Click 'What is on this screen?' to start speech
  await readScreenBtn.click();
  await page.waitForTimeout(1000);

  const isSpeakingNow = await page.evaluate(() => {
    return (window).__TechFormBuddySpeech ? (window).__TechFormBuddySpeech.isSpeaking() : false;
  });
  console.log('Is speaking while reading:', isSpeakingNow);

  // 4. Click again to stop speaking
  const stopBtn = page.getByRole('button', { name: /Stop Speaking/i });
  if (await stopBtn.isVisible()) {
    await stopBtn.click();
    await page.waitForTimeout(500);
    console.log('✓ Clicked Stop Speaking');
  }

  const isSpeakingStopped = await page.evaluate(() => {
    return (window).__TechFormBuddySpeech ? (window).__TechFormBuddySpeech.isSpeaking() : false;
  });
  console.log('Is speaking after stop:', isSpeakingStopped);

  // 5. Test native multilingual speech across multiple languages directly in browser runtime
  const testLangs = ['hi', 'ta', 'te', 'bn', 'es', 'fr', 'ja', 'ar'];
  for (const lang of testLangs) {
    const result = await page.evaluate(async (l) => {
      const speech = (window).__TechFormBuddySpeech;
      let startFired = false;
      let endFired = false;

      const started = speech.speakText(
        `TechForm Buddy speech test for language ${l}`,
        l,
        () => { startFired = true; },
        () => { endFired = true; }
      );

      // Wait a tick for audio fetch/play
      await new Promise(r => setTimeout(r, 600));
      const active = speech.isSpeaking();
      const diag = speech.getSpeechDiagnostics();
      speech.stopSpeaking();

      return { started, active, diag };
    }, lang);

    console.log(`Language ${lang.toUpperCase()}: started=${result.started}, provider=${result.diag.lastProviderUsed}`);
  }

  await browser.close();

  if (errors.length > 0) {
    console.error('Page errors encountered:', errors);
    process.exit(1);
  } else {
    console.log('\n✓ Real browser speech tests completed with ZERO errors!');
  }
}

testRealBrowserAudio().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
