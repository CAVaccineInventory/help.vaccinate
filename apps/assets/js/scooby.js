import * as Sentry from "@sentry/browser";
import { Integrations } from "@sentry/tracing";

import { initScooby } from "./main.js";

document.addEventListener("DOMContentLoaded", function () {
  Sentry.init({
    dsn: "https://f4f6dd9c4060438da4ae154183d9f7c6@o509416.ingest.sentry.io/5737071",
    integrations: [new Integrations.BrowserTracing()],
    tracesSampleRate: 0.2,
  });
  initScooby();
});
