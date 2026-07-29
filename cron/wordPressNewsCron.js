import cron from 'node-cron';
import NewsService from '../service/newsService.js';
import dotenv from 'dotenv';
import path from 'path';
import { pathToFileURL } from 'url';
import { connectToDatabase } from '../db/connect.js';

dotenv.config();

// Run every 10 minutes
// cron.schedule('*/10 * * * *', async () => {
//     try {
//         console.log('Running WordPress news fetch cron job');
//         await connectToDatabase();
//         const wordpressUrl = process.env.WORDPRESS_NEWS_URL;
//         if (wordpressUrl) {
//             const result = await NewsService.fetchFromWordPress(wordpressUrl, 'recent');
//             console.log(`WordPress cron job finished. New: ${result.new}, Updated: ${result.updated}`);
//         } else {
//             console.log('WORDPRESS_NEWS_URL not set in environment variables. content fetch skipped.');
//         }
//         process.exit(0);
//     } catch (error) {
//         console.error('WordPress news fetch cron job failed:', error);
//         process.exit(1);
//     }
// });

// Manual run for immediate testing (ESM compatible)
const isDirectRun = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
    (async () => {
        try {
            await connectToDatabase();
            console.log('Manual run: Running WordPress news fetch cron job');
            const wordpressUrl = process.env.WORDPRESS_NEWS_URL;
            if (wordpressUrl) {
                const result = await NewsService.fetchFromWordPress(wordpressUrl, 'recent');
                console.log(`Manual run finished. New: ${result.new}, Updated: ${result.updated}`);
            } else {
                console.log('WORDPRESS_NEWS_URL not set in environment variables. content fetch skipped.');
            }
            process.exit(0);
        } catch (error) {
            console.error('Manual run failed:', error);
            process.exit(1);
        }
    })();
}
