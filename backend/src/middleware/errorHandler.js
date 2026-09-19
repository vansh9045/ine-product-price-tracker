export function notFoundHandler(request, _response, next) {
  const error = new Error(`Route not found: ${request.method} ${request.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, _request, response, _next) {
  const statusCode = error.statusCode ?? 500;

  if (statusCode >= 500) {
    console.error('[API_ERROR]', error);
  }

  response.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? 'An unexpected server error occurred.' : error.message,
  });
}
