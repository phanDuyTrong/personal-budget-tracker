function errorHandler(err, req, res, next) {
    console.error(err);
    const status = err.status || 500;
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.message || 'An unexpected error occurred';
    res.status(status).json({ error: { code, message } });
}

module.exports = errorHandler;
