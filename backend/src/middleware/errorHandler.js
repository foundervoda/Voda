// Wrap async route handlers so rejections reach the error handler instead of hanging
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Consistent { data, error } shape across all endpoints (Handbook §10 / §14)
const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const code = err.code || "INTERNAL_ERROR";
  res.status(status).json({ data: null, error: { message: err.message, code } });
};

module.exports = { asyncHandler, errorHandler };
