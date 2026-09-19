import cors from 'cors';
import express from 'express';

import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/healthRoutes.js';
import productRouter from './routes/productRoutes.js';
import trackedProductRouter from './routes/trackedProductRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/products', productRouter);
app.use('/api/tracked-products', trackedProductRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
