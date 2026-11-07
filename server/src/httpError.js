// Builds an error that the error handler in app.js turns into a JSON response with this status.
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = httpError;