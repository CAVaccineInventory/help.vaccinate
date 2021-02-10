const bunyan = require("bunyan");
const { LoggingBunyan } = require("@google-cloud/logging-bunyan");

const initLogging = (event) => {
  const streams = [
    // Log to the console at 'info' and above
    { stream: process.stdout, level: "info" },
  ];
  let endRequest = () => true;

  if (!process.env.GCP_CLIENT_EMAIL || !process.env.GCP_PRIVATE_KEY) {
    console.log("No Stackdriver logging configured, skipping");
  } else {
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
    streams.push(stackdriverStream);

    endRequest = () => {
      if (stackdriverStream.writableFinished) return;
      return new Promise((res) => {
        stackdriver.end(res);
      });
    };
  }

  // Create a Bunyan logger that streams to Cloud Logging
  // Logs will be written to: "projects/cavaccineinventory/logs/netlify"
  const logger = bunyan.createLogger({
    name: "netlify",
    streams: streams,
    serializers: bunyan.stdSerializers,
  });

  const requestLogger = logger.child({
    request_id: event.headers["x-nf-request-id"],
    deploy: process.env.DEPLOY || "testing",
  });

  return [requestLogger, endRequest];
};

const loggedHandler = (handler) => {
  return async (event, context) => {
    const [logger, cleanup] = await initLogging(event);
    logger.info({ req: event }, "%s %s", event.httpMethod, event.path);
    const retval = await handler(event, context, logger);
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
