import { Router } from 'express';

import {
  createTrackedProduct,
  getTrackedProduct,
  getTrackedProducts,
  refreshAllTrackedProductsForCron,
  refreshTrackedProductById,
  removeTrackedProduct,
  getTrackedProductHistoryById,
  getTrackedProductLogsById,
} from '../controllers/trackedProductController.js';

const trackedProductRouter = Router();

trackedProductRouter.route('/refresh-all').post(refreshAllTrackedProductsForCron);
trackedProductRouter.route('/').get(getTrackedProducts).post(createTrackedProduct);
trackedProductRouter.route('/:id').get(getTrackedProduct).delete(removeTrackedProduct);
trackedProductRouter.route('/:id/refresh').post(refreshTrackedProductById);
trackedProductRouter.route('/:id/history').get(getTrackedProductHistoryById);
trackedProductRouter.route('/:id/logs').get(getTrackedProductLogsById);

export default trackedProductRouter;
