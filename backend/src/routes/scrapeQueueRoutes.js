import { Router } from 'express';

import {
    processScrapeQueueForCron,
} from '../controllers/scrapeQueueController.js';

const scrapeQueueRouter = Router();

scrapeQueueRouter
    .route('/process')
    .post(processScrapeQueueForCron);

export default scrapeQueueRouter;