import { env } from '../config/env.js';

import {
  deleteTrackedProduct,
  getTrackedProductById,
  listTrackedProducts,
  refreshAllTrackedProducts,
  refreshTrackedProduct,
  trackStoreProduct,
  getTrackedProductHistory,
  getTrackedProductLogs,
} from '../services/trackedProductService.js';

function getStoreProductId(value) {
  const productId = Number(value);

  if (!Number.isSafeInteger(productId) || productId <= 0) {
    const error = new Error(
      'storeProductId must be a positive integer.',
    );

    error.statusCode = 400;

    throw error;
  }

  return productId;
}

export async function createTrackedProduct(
  request,
  response,
  next,
) {
  try {
    const product = await trackStoreProduct(
      getStoreProductId(request.body.storeProductId),
    );

    response.status(201).json({
      success: true,
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTrackedProducts(
  _request,
  response,
  next,
) {
  try {
    const products = await listTrackedProducts();

    response.status(200).json({
      success: true,
      data: {
        products,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTrackedProduct(
  request,
  response,
  next,
) {
  try {
    const product = await getTrackedProductById(
      request.params.id,
    );

    response.status(200).json({
      success: true,
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function removeTrackedProduct(
  request,
  response,
  next,
) {
  try {
    await deleteTrackedProduct(
      request.params.id,
    );

    response.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function refreshTrackedProductById(
  request,
  response,
  next,
) {
  try {
    const product =
      await refreshTrackedProduct(
        request.params.id,
      );

    response.status(200).json({
      success: true,
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTrackedProductHistoryById(
  request,
  response,
  next,
) {
  try {
    const history =
      await getTrackedProductHistory(
        request.params.id,
      );

    response.status(200).json({
      success: true,
      data: {
        history,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTrackedProductLogsById(
  request,
  response,
  next,
) {
  try {
    const logs =
      await getTrackedProductLogs(
        request.params.id,
      );

    response.status(200).json({
      success: true,
      data: {
        logs,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function refreshAllTrackedProductsForCron(
  request,
  response,
  next,
) {
  try {
    console.log('🔥🔥🔥 CRON CONTROLLER ENTERED');

    const providedSecret =
      request.headers['x-cron-secret'] ??
      request.headers.authorization?.replace(
        /^Bearer\s+/i,
        '',
      );

    if (providedSecret !== env.cronSecret) {
      console.log('❌ CRON SECRET FAILED');

      const error = new Error(
        'Unauthorized cron request.',
      );

      error.statusCode = 401;

      throw error;
    }

    console.log('✅ CRON SECRET PASSED');

    const summary =
      await refreshAllTrackedProducts();

    console.log(
      '✅ REFRESH FUNCTION RETURNED:',
      summary,
    );

    response.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error(
      '❌ CRON CONTROLLER ERROR:',
      error,
    );

    next(error);
  }
}