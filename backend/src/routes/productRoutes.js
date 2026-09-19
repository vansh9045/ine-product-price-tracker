import { Router } from 'express';

import { searchProducts } from '../controllers/productController.js';

const productRouter = Router();

productRouter.get('/search', searchProducts);

export default productRouter;
