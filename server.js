const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let browser = null;

// Initialize browser on startup
async function initBrowser() {
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920x1080'
            ]
        });
        console.log('Browser initialized successfully');
    } catch (error) {
        console.error('Error initializing browser:', error);
    }
}

// Scrape Play Store app
app.post('/scrape', async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ 
            success: false, 
            error: 'URL is required' 
        });
    }
    
    if (!browser) {
        await initBrowser();
    }
    
    let page = null;
    
    try {
        page = await browser.newPage();
        
        // Set realistic viewport and user agent
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Navigate to Play Store page
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Wait for content to load
        await page.waitForTimeout(3000);
        
        // Extract app data
        const appData = await page.evaluate(() => {
            const data = {};
            
            // Extract name
            const nameEl = document.querySelector('h1') || document.querySelector('[itemprop="name"]');
            if (nameEl) {
                data.name = nameEl.textContent.trim();
                // Remove " - Apps on Google Play" suffix
                data.name = data.name.replace(/\s*-\s*Apps?\s+on\s+Google\s+Play.*$/i, '');
            }
            
            // Extract description - look for "Acerca de esta app" section
            const aboutSection = Array.from(document.querySelectorAll('h2')).find(h2 => 
                h2.textContent.includes('Acerca de esta app') || 
                h2.textContent.includes('About this app')
            );
            
            if (aboutSection) {
                let descElement = aboutSection.nextElementSibling;
                let description = '';
                
                // Get all text until next h2
                while (descElement && descElement.tagName !== 'H2') {
                    if (descElement.textContent) {
                        description += descElement.textContent.trim() + '\n\n';
                    }
                    descElement = descElement.nextElementSibling;
                }
                
                // Also try to get from bARER class divs
                const descDivs = document.querySelectorAll('div.bARER, div[class*="bARER"]');
                if (descDivs.length > 0) {
                    let combinedDesc = '';
                    descDivs.forEach(div => {
                        combinedDesc += div.textContent.trim() + '\n\n';
                    });
                    if (combinedDesc.length > description.length) {
                        description = combinedDesc;
                    }
                }
                
                data.description = description.trim();
            }
            
            // Extract icon
            const iconEl = document.querySelector('img[alt*="Icon"], img[itemprop="image"]');
            if (iconEl) {
                data.icon_url = iconEl.src || iconEl.getAttribute('data-src');
                // Convert to high-res
                if (data.icon_url) {
                    data.icon_url = data.icon_url.replace(/=w\d+-h\d+/, '=w512-h512');
                    data.icon_url = data.icon_url.replace(/=s\d+/, '=s512');
                }
            }
            
            // Extract screenshots
            const screenshots = [];
            const screenshotImgs = document.querySelectorAll('img[alt*="Screenshot"], img[alt*="screenshot"]');
            
            screenshotImgs.forEach(img => {
                let src = img.src || img.getAttribute('data-src');
                if (src && src.includes('googleusercontent.com') && 
                    !src.includes('icon') && !src.includes('logo')) {
                    // Convert to high-res
                    src = src.replace(/=w\d+-h\d+/, '=w720-h1280');
                    src = src.replace(/=s\d+/, '=s720');
                    if (!screenshots.includes(src)) {
                        screenshots.push(src);
                    }
                }
            });
            
            // Also look for screenshots in carousels
            const carousels = document.querySelectorAll('[role="list"], .screenshot-carousel');
            carousels.forEach(carousel => {
                const imgs = carousel.querySelectorAll('img');
                imgs.forEach(img => {
                    let src = img.src || img.getAttribute('data-src');
                    if (src && src.includes('googleusercontent.com') && 
                        !src.includes('icon') && !src.includes('logo') &&
                        !screenshots.includes(src)) {
                        src = src.replace(/=w\d+-h\d+/, '=w720-h1280');
                        src = src.replace(/=s\d+/, '=s720');
                        screenshots.push(src);
                    }
                });
            });
            
            data.screenshot_urls = screenshots;
            
            // Extract rating
            const ratingEl = document.querySelector('[itemprop="ratingValue"], .TT9eCd');
            if (ratingEl) {
                const ratingText = ratingEl.textContent.trim();
                const match = ratingText.match(/(\d+\.?\d*)/);
                if (match) {
                    data.rating = parseFloat(match[1]);
                }
            }
            
            // Extract price
            const priceEl = document.querySelector('[itemprop="price"], .VfPpkd-StrnGf-rymPhb');
            if (priceEl) {
                const priceText = priceEl.textContent.trim();
                if (priceText.toLowerCase().includes('gratis') || 
                    priceText.toLowerCase().includes('free')) {
                    data.price = 0;
                } else {
                    const match = priceText.match(/\$?(\d+\.?\d*)/);
                    if (match) {
                        data.price = parseFloat(match[1]);
                    }
                }
            } else {
                data.price = 0; // Default to free
            }
            
            return data;
        });
        
        await page.close();
        
        res.json({
            success: true,
            data: appData
        });
        
    } catch (error) {
        if (page) {
            await page.close().catch(() => {});
        }
        console.error('Scraping error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error scraping Play Store'
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        browser: browser ? 'initialized' : 'not initialized' 
    });
});

// Initialize browser on startup
initBrowser();

// Graceful shutdown
process.on('SIGTERM', async () => {
    if (browser) {
        await browser.close();
    }
    process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Play Store Scraper service running on port ${PORT}`);
});

