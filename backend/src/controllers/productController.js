import { searchStoreProducts } from '../services/storeCatalogService.js';

export async function searchProducts(request, response, next) {
  try {
    const query = request.query.q;

    if (typeof query !== 'string' || query.trim().length === 0) {
      const error = new Error('Query parameter "q" is required.');
      error.statusCode = 400;
      throw error;
    }

    const products = await searchStoreProducts(query);

    response.status(200).json({
      success: true,
      data: {
        query: query.trim(),
        count: products.length,
        products,
      },
    });
  } catch (error) {
    next(error);
  }
}
