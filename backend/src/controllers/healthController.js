export function getHealth(_request, response) {
  response.status(200).json({
    success: true,
    message: 'Product Price Tracker API is running.',
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
}
