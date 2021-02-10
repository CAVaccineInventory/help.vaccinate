const bunyan = require("bunyan");
const { LoggingBunyan } = require("@google-cloud/logging-bunyan");

initLogging = (event) => {
  if (!process.env.GCP_CLIENT_EMAIL || !process.env.GCP_PRIVATE_KEY) {
    console.log("No Stackdriver logging configured, skipping");
    return [console, async (resp) => resp];
  }
  const options = {
    projectId: "cavaccineinventory",
    logName: "netlify",
    credentials: {
      client_email: process.env.GCP_CLIENT_EMAIL,
      private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
  };

  const stackdriver = new LoggingBunyan(options);
  const stackdriverStream = stackdriver.stream("info");

  // Create a Bunyan logger that streams to Cloud Logging
  // Logs will be written to: "projects/cavaccineinventory/logs/netlify"
  const logger = bunyan.createLogger({
    name: "netlify",
    streams: [
      // Log to the console at 'info' and above
      { stream: process.stdout, level: "info" },
      // And log to Cloud Logging, logging at 'info' and above
      stackdriverStream,
    ],
  });

  end_request = () => {
    if (stackdriverStream.writableFinished) return;
    return new Promise((res, rej) => {
      stackdriver.end(res);
    });
  };

  request_logger = logger.child({
    request_id: event.headers["x-nf-request-id"],
    deploy: process.env.DEPLOY || "testing",
  });

  return [request_logger, end_request];
};

loggedHandler = (handler) => {
  return async (event, context) => {
    [logger, cleanup] = await initLogging(event);
    console.log("About to log...");
    logger.info({ req: event }, event.httpMethod + " " + event.path);
    retval = await handler(event, context, logger);
    if (retval.statusCode >= 500) {
      logger.error({ res: retval }, "Response code: %d", retval.statusCode);
    } else if (retval.statusCode >= 400) {
      logger.warn({ res: retval }, "Response code: %d", retval.statusCode);
    } else {
      logger.info({ res: retval }, "Response code: %d", retval.statusCode);
    }
    await cleanup();
    return retval;
  };
};

module.exports.loggedHandler = loggedHandler;
