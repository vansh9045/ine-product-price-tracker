import { scrapeProduct } from './backend/src/services/scraper/productScraper.js';

const result = await scrapeProduct({
  product_url: 'https://demo.inelabteamdev.com/product/22',
  product_name: 'INE Demo Product',
});

console.log(JSON.stringify(result, null, 2));
