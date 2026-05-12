import puppeteer from 'puppeteer';

(async () => {
    console.log("Launching browser...");
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('BROWSER_CONSOLE_ERROR:', msg.text());
        } else {
            console.log('BROWSER_CONSOLE_LOG:', msg.text());
        }
    });
    
    page.on('pageerror', error => {
        console.log('BROWSER_PAGE_ERROR:', error.message);
    });
    
    console.log("Navigating to http://localhost:5177/...");
    await page.goto('http://localhost:5177/');
    
    console.log("Waiting 3 seconds...");
    await new Promise(r => setTimeout(r, 3000));
    
    console.log("Done.");
    await browser.close();
})();
