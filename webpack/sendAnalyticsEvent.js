// This is a global function for sending detailed analytics.
// https://developers.google.com/analytics/devguides/collection/gtagjs/events
export default function (action, category, label, value) {
  if (typeof gtag != "undefined") {
    gtag("event", action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
}
