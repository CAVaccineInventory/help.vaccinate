import "core-js/stable";
import "regenerator-runtime/runtime";

import * as Sentry from "@sentry/browser";
import { Integrations } from "@sentry/tracing";

import { initAuth0, getAccessToken, loginWithRedirect, logout, getUser } from "./util/auth.js";
import { validateReport } from "./util/validators.js";
import {
  bindClick,
  fillTemplateIntoDom,
  enableInputDataBinding,
  hideElement,
  showElement,
  isHidden,
  showLoadingScreen,
  hideLoadingScreen,
  showModal,
} from "./util/fauxFramework.js";

import locationTemplate from "./templates/scooby/location.handlebars";
import youAreCallingTemplate from "./templates/scooby/youAreCalling.handlebars";
import ctaTemplate from "./templates/scooby/cta.handlebars";
import nextCallPromptTemplate from "./templates/scooby/nextCallPrompt.handlebars";
import loggedInAsTemplate from "./templates/loggedInAs.handlebars";
import notLoggedInTemplate from "./templates/notLoggedIn.handlebars";
import dialResultTemplate from "./templates/scooby/dialResult.handlebars";
import callLogTemplate from "./templates/scooby/callLog.handlebars";
import toastTemplate from "./templates/scooby/toast.handlebars";
import affiliationNotesTemplate from "./templates/scooby/affiliationNotes.handlebars";
import callScriptTemplate from "./templates/scooby/callScript.handlebars";
import errorModalTemplate from "./templates/scooby/errorModal.handlebars";
import callerStatsTemplate from "./templates/scooby/callerStats.handlebars";
import submissionWarningModalTemplate from "./templates/scooby/submissionWarningModal.handlebars";

const MINUTE = 60 * 1000;
const HOUR = MINUTE * 60;

const AVAIL_BAD_CONTACT_INFO = "No: incorrect contact information";
const AVAIL_PERMANENTLY_CLOSED = "No: location permanently closed";
const AVAIL_SKIP = "Skip: call back later";

let userRoles = null;
let currentReport = {};
let currentLocation = null;
let previousLocation = null;
let previousId = null;

let previousCallScriptDom = null;

let providerSchedulingUrl = null;
let callerStats = null;
let noteTimestampPrefix = null;
let prefilledInternalNotes = null;

document.addEventListener("DOMContentLoaded", function () {
  Sentry.init({
    dsn: "https://f4f6dd9c4060438da4ae154183d9f7c6@o509416.ingest.sentry.io/5737071",
    integrations: [new Integrations.BrowserTracing()],
    tracesSampleRate: 0.2,
  });
  initScooby();
});

const initCallerStats = async () => {
  callerStats = await fetchJsonFromEndpoint("/callerStats");
  if (callerStats.error) {
    // just swallow and hide since not critical
    console.warn("error fetching callerStats: ", callerStats);
    callerStats = null;
  }
  initCallerStatsTemplate();
};

const initCallerStatsTemplate = () => {
  fillTemplateIntoDom(callerStatsTemplate, "#callerStats", {
    displayCallerStats: !!callerStats,
    callsToday: callerStats?.today,
    callsTotal: callerStats?.total,
  });
};

const updateLogin = (user) => {
  if (user && user.email) {
    fillTemplateIntoDom(loggedInAsTemplate, "#loggedInAs", {
      email: user.email,
      cta: "Done Calling - Log out"
    });
    bindClick("#logoutButton", logout);

    // earliest point at which the user is guaranteed logged in, prefetch caller stats
    initCallerStats();
  } else {
    fillTemplateIntoDom(notLoggedInTemplate, "#loggedInAs", {});
    bindClick("#loginButton", loginWithRedirect);
  }
};

const fetchJsonFromEndpoint = async (endpoint, method, body) => {
  const apiTarget =
    process.env.DEPLOY === "prod" ? "https://vial.calltheshots.us/api" : "https://vial-staging.calltheshots.us/api";

  if (!method) {
    method = "POST";
  }
  const accessToken = await getAccessToken();
  const result = await fetch(`${apiTarget}${endpoint}`, {
    method,
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  try {
    return await result.json();
  } catch (e) {
    // didnt get json back - treat as an error
    return { error: true, error_description: result.statusText };
  }
};

const showErrorModal = (title, body, json) => {
  showModal(errorModalTemplate, {
    title,
    body,
    json: JSON.stringify(json, null, 2),
  });
};

const authOrLoadAndFillCall = async () => {
  const user = await getUser();
  if (user && user.email) {
    const urlParams = new URLSearchParams(window.location.search);
    const forceLocation = urlParams.get("location_id");
    requestCall(forceLocation);
  } else {
    loginWithRedirect();
  }
};

const requestCall = async (id) => {
  showLoadingScreen();
  if (id) {
    currentLocation = await fetchJsonFromEndpoint("/requestCall?location_id=" + id);
  } else {
    currentLocation = await fetchJsonFromEndpoint("/requestCall?state=all");
  }
  hideLoadingScreen();
  const user = await getUser();
  userRoles = user["https://help.vaccinateca.com/roles"];
  if (currentLocation.error) {
    showErrorModal(
      "Error fetching a call",
      "It looks like you might not yet have permission to use this tool. Please show this error message to your captain or lead on Slack: '" +
        currentLocation.error_description +
        "'. They may also need to know that you are logged in as " +
        user?.email +
        ".",
      { user: user, error: currentLocation }
    );
  } else {
    hideLoadingScreen();
    hideElement("#nextCallPrompt");
    showElement("#youAreCalling");
    showElement("#callerTool");
    showScriptForLocation(currentLocation);
    activateCallTemplate();
  }
};

const loadAndFillPreviousCall = () => {
  hideElement("#nextCallPrompt");
  showElement("#youAreCalling");
  showElement("#callerTool");
  hideToast(); // should do this somewhere smarter.

  currentLocation = previousLocation;
  if (previousId) {
    window.history.replaceState({}, "", `${window.location.pathname}?location_id=${previousId}`);
  }

  previousLocation = null;
  previousId = null;
  showScriptForLocation(currentLocation);
  // Replace the call script with the call script from the previous report
  const callScript = document.getElementById("callScript");
  callScript.parentNode.replaceChild(previousCallScriptDom, callScript);
  activateCallTemplate();
};

const showScriptForLocation = (place) => {
  // TODO Create a history entry for the new location
  // and bake all of our state into the state object. then also
  // implement a popstate handler, so we get proper back button support
  //  const url = new URL(window.location);
  //  url.searchParams.set("location_id", place.id);
  //  url.searchParams.delete("code");
  //  url.searchParams.delete("state");
  //  window.history.pushState({}, "", url);

  providerSchedulingUrl = null;
  fillCallTemplate(place);
};

const initScooby = async () => {
  showLoadingScreen();
  await initAuth0();
  const user = await getUser();
  updateLogin(user);
  hideLoadingScreen();
  fillTemplateIntoDom(nextCallPromptTemplate, "#nextCallPrompt", {});
  bindClick("#requestCallButton", authOrLoadAndFillCall);
  showElement("#nextCallPrompt");
  hideElement("#callerTool");
  const autoDial = document.querySelector("#autodial");
  autoDial?.addEventListener("change", () => {
    if (autoDial?.checked) {
      document.querySelector("#location-phone-url")?.click();
    }
  });

  if (isWebBanked()) {
    authOrLoadAndFillCall();
  }
};

const constructReportFromDom = () => {
  // reset report each time
  currentReport = { Location: currentLocation.id };

  const availability = [];
  const topLevelAnswer = document.querySelector("[name=yesNoSelect]:checked")?.value;

  if (topLevelAnswer === "no") {
    availability.push("No: may be a vaccination site in the future");
  } else if (topLevelAnswer === "noNever") {
    availability.push("No: will never be a vaccination site");
  } else if (topLevelAnswer === "sortOf") {
    const sortOfReason = document.querySelector("[name=sortOfReason]:checked")?.value;
    switch (sortOfReason) {
      case "private":
        availability.push("No: not open to the public");
        break;
      case "noStaffOnly":
        availability.push("No: only vaccinating staff");
        break;
      case "expectSoon":
        availability.push("Yes: coming soon");
        break;
      case "noNotYet":
        availability.push("No: may be a vaccination site in the future");
        break;
      case "pausedJJ":
        availability.push(
          "Vaccinations may be on hold due to CDC/FDA guidance regarding the Johnson & Johnson vaccine"
        );
        break;
      default:
        break;
    }
  }

  if (!isHidden("#vaccinatingPublicScript")) {
    if (!isHidden("#restrictionsList")) {
      // Thanks! Can anyone sign up to be vaccinated, or are there any restrictions or limits
      if (document.querySelector("#veteransOnly")?.checked) {
        availability.push("Yes: must be a veteran");
      }
      if (document.querySelector("#patientsOnly")?.checked) {
        availability.push("Yes: must be a current patient");
      }
      if (document.querySelector("#countyOnly")?.checked) {
        availability.push("Yes: restricted to county residents");
      }
      if (!isHidden("#otherRestriction")) {
        currentReport.restriction_notes = document.querySelector("#restrictionsReasonForm")?.innerText;
      }
    }

    // And do you require appointments, or are walk-ins accepted?
    const apptRequired = document.querySelector("[name=appointmentRequired]:checked")?.value;
    switch (apptRequired) {
      case "walkinOk":
        availability.push("Yes: walk-ins accepted");
        break;
      case "required":
        availability.push("Yes: appointment required");
        break;
      case "appointmentOrWalkin":
        availability.push("Yes: appointments or walk-ins accepted");
        break;
      default:
        // default to appointment required
        availability.push("Yes: appointment required");
        console.log("no appt required selected - defaulting to appt required");
        break;
    }

    if (!isHidden("#appointmentDetails")) {
      // How do you make an appointment?
      const apptMethod = document.querySelector("[name=appointmentMethod]:checked")?.value;
      switch (apptMethod) {
        case "myturn":
          currentReport["Appointment scheduling instructions"] = "https://myturn.ca.gov/";
          break;
        case "web":
          currentReport["Appointment scheduling instructions"] = document.querySelector("#appointmentWebsite")?.value;
          break;
        case "phone":
          currentReport["Appointments by phone?"] = true;
          currentReport["Appointment scheduling instructions"] = document.querySelector("#appointmentPhone")?.value;
          break;
        case "other":
          currentReport["Appointment scheduling instructions"] = document.querySelector(
            "#appointmentOtherInstructions"
          )?.value;
          break;
        default:
          break;
      }

      // Great! Do you know if you have any open appointments that someone could book right now? It’s okay if they’re not for a couple of weeks.
      const details = document.querySelector("[name=appointmentsAvailable]:checked")?.value;
      switch (details) {
        case "yes":
          availability.push("Yes: appointments available");
          break;
        case "no":
          availability.push("Yes: appointment calendar currently full");
          break;
        case "unknown":
        default:
          break;
        // do nothing
      }
    }

    // Which vaccines do you offer
    const vaccinesOffered = [];
    if (document.querySelector("#modernaProvided")?.checked) {
      vaccinesOffered.push("Moderna");
    }
    if (document.querySelector("#pfizerProvided")?.checked) {
      vaccinesOffered.push("Pfizer");
    }
    if (document.querySelector("#jjProvided")?.checked) {
      vaccinesOffered.push("Johnson & Johnson");
    }
    if (document.querySelector("#otherProvided")?.checked) {
      vaccinesOffered.push("Other");
    }
    if (vaccinesOffered.length > 0) {
      currentReport.vaccines_offered = vaccinesOffered;
    }
  }

  // Is it okay if I confirm...
  if (!isHidden("#contactConfirmations")) {
    const address = document.querySelector("#confirmAddress")?.value;
    const hours = document.querySelector("#confirmHours")?.value;
    const web = document.querySelector("#confirmSite")?.value;
    if (address) {
      currentReport.address = address;
    }
    if (hours) {
      currentReport.hours = hours;
    }
    if (web) {
      currentReport.web = web;
    }
  }

  // When will the site stop operating?
  const stopDate = document.querySelector("#plannedStopDate")?.value;
  if (!isHidden("#plannedStopDatePrompt") && stopDate) {
    currentReport.planned_closure = stopDate;
  }

  if (document.querySelector("#reviewRequested")?.checked) {
    currentReport.is_pending_review = true;
    currentReport.pending_review_because = "Reporter explicitly asked for review";
  }

  // End script

  currentReport.Availability = availability;

  // only save public notes if caller modified the prefilled date input
  const publicNotes = document.querySelector("#callScriptPublicNotes")?.innerText;
  currentReport.Notes = publicNotes?.trim() === noteTimestampPrefix?.trim() ? "" : publicNotes;

  const internalNotes = document.querySelector("#callScriptPrivateNotes")?.innerText;
  currentReport["Internal Notes"] = internalNotes;
  currentReport.County = currentLocation?.County;

  // fields used for validation
  currentReport.internal_notes_unchanged = prefilledInternalNotes === internalNotes;
  currentReport.web_banked = isWebBanked();
  console.log(currentReport);
};

const runValidators = (onSuccess) => {
  const reportState = validateReport(currentReport);
  if (reportState.reviewBecause.length) {
    currentReport.is_pending_review = true;
    currentReport.pending_review_because = reportState.reviewBecause.join("; ");
  }
  if (reportState.warningIssues.length || reportState.blockingIssues.length) {
    showModal(
      submissionWarningModalTemplate,
      {
        warnings: reportState.warningIssues,
        errors: reportState.blockingIssues,
      },
      (modal) => {
        bindClick("#submitReportAfterWarning", () => {
          onSuccess();
          modal.hide();
        });

        bindClick("#dismissAfterWarning", () => {
          document.getElementById("callScriptPrivateNotes")?.scrollIntoView();
        });
      }
    );
  } else {
    onSuccess();
  }
};

const saveCallReport = () => {
  constructReportFromDom();
  runValidators(() => {
    submitCallReport();
  });
};

const submitBadContactInfo = () => {
  submitWithAvail(AVAIL_BAD_CONTACT_INFO);
};

const submitPermanentlyClosed = () => {
  submitWithAvail(AVAIL_PERMANENTLY_CLOSED);
};

const submitWithAvail = (avail) => {
  constructReportFromDom();
  currentReport["Availability"] = [avail];
  runValidators(() => {
    submitCallReport();
  });
};

const submitSkipUntil = (when) => {
  constructReportFromDom();
  currentReport["Do not call until"] = when.toISOString();
  currentReport["Availability"] = [AVAIL_SKIP];
  runValidators(() => {
    submitCallReport();
  });
};

// Busy signals, no answer, voice mail, and long holds
const submitCallTwoHours = () => {
  const when = new Date();
  when.setTime(when.getTime() + 2 * HOUR);
  submitSkipUntil(when);
};

const submitCallTomorrow = () => {
  const when = new Date();
  // Advance the clock 24 hours to get to tomorrow, then bounce back to 8am localtime.
  // / TODO this shouldn't be in localtime
  when.setTime(when.getTime() + 24 * HOUR);
  when.setHours(8);
  when.setMinutes(0);
  submitSkipUntil(when);
};

const submitCallMonday = () => {
  const when = new Date();
  when.setDate(when.getDate() + ((1 + 7 - when.getDay()) % 7));
  when.setHours(8);
  when.setMinutes(0);
  submitSkipUntil(when);
};

const submitCallReport = async () => {
  showLoadingScreen();
  const data = await fetchJsonFromEndpoint("/submitReport", "POST", JSON.stringify(currentReport));
  hideLoadingScreen();
  if (data.error) {
    showErrorModal(
      "Error submitting your report",
      "I'm really sorry, but it looks like something has gone wrong while trying to submit your report. The specific error the system sent back was '" +
        data.error_description +
        "'. This is not your fault. You can try clicking the 'Close' button on this box and submitting your report again. If that doesn't work, copy the technical information below and paste it into Slack, so we can get this sorted out for you",
      { report: currentReport, result: data }
    );
  } else {
    const callId = data.created;

    if (callId) {
      callerStats = {
        today: callerStats ? callerStats.today + 1 : 1,
        total: callerStats ? callerStats.total + 1 : 1,
      };
      showCompletionToast(currentLocation.Name);

      previousLocation = currentLocation;
      previousCallScriptDom = document.getElementById("callScript").cloneNode(1);
      const urlParams = new URLSearchParams(window.location.search);
      previousId = urlParams.get("location_id");

      if (previousId) {
        // If using scooby via location_id, reset to home view instead of requesting more calls
        urlParams.delete("location_id");
        window.history.replaceState({}, "", `${window.location.pathname}?${urlParams.toString()}`);
        showElement("#nextCallPrompt");
        hideElement("#youAreCalling");
        hideElement("#callerTool");
      } else {
        requestCall();
      }
    }
  }
};

const fillCallTemplate = (data) => {
  fillTemplateIntoDom(affiliationNotesTemplate, "#affiliationNotes", {});

  let affiliation = data.Affiliation || "";
  affiliation = affiliation
    .toLowerCase()
    .replace(/pharmacy/, "")
    .replace(/\W/g, "");
  const affs = document.querySelectorAll("#affiliationNotes .provider");
  if (affs !== null) {
    affs.forEach((e) => {
      e.classList.add("hidden");
    });
  }

  if (affiliation) {
    const providerDiv = document.querySelector("#affiliationNotes .provider." + affiliation);
    if (providerDiv !== null) {
      providerDiv.classList.remove("hidden");
      providerSchedulingUrl = providerDiv.getAttribute("data-scheduling-url") || data.Website;
    }
  }

  fillTemplateIntoDom(youAreCallingTemplate, "#youAreCalling", {
    locationName: data.Name,
    locationAddress: data.Address || "No address information available",
    countyName: data.County,
    countyURL: data["County vaccine info URL"],
  });

  let localTime = null;
  if (data.timezone) {
    try {
      localTime = new Date().toLocaleTimeString("en-us", { timeZone: data.timezone, timeZoneName: "short" });
    } catch (e) {
      console.warn(e);
      Sentry.captureException(e);
    }
  }
  fillTemplateIntoDom(locationTemplate, "#locationInfo", {
    locationId: data.id,
    locationHours: data.Hours,
    localTime,
  });
  fillTemplateIntoDom(dialResultTemplate, "#dialResult", {});

  fillTemplateIntoDom(ctaTemplate, "#cta", {
    locationPhone: data["Phone number"],
  });

  noteTimestampPrefix = `${new Date().toLocaleString("en-US", { month: "short", day: "numeric" })}: `;
  prefilledInternalNotes = !!data["Latest Internal Notes"]
    ? `${noteTimestampPrefix}\n\n${data["Latest Internal Notes"] || ""}`
    : noteTimestampPrefix;
  const showMyTurn = data.State === "CA";
  const confirmAddress = data.confirm_address && !!data.Address;
  const confirmHours = data.confirm_hours && !!data.Hours;
  const confirmWebsite = data.confirm_website && !!providerSchedulingUrl;
  const anyConfirmations = confirmAddress || confirmHours || confirmWebsite;
  fillTemplateIntoDom(callScriptTemplate, "#callScript", {
    locationId: data.id,
    locationAddress: data.Address,
    locationWebsite: providerSchedulingUrl,
    locationPhone: data["Phone number"],
    locationPrivateNotes: prefilledInternalNotes,
    locationPublicNotes: noteTimestampPrefix,
    county: data.County,
    locationHours: data.Hours,
    isPharmacy: data["Location Type"] === "Pharmacy",
    showMyTurn,
    anyConfirmations,
    confirmAddress,
    confirmHours,
    confirmWebsite,
  });

  fillTemplateIntoDom(callLogTemplate, "#callLog", { callId: data["id"] });
  initCallerStatsTemplate();
};

const activateCallTemplate = () => {
  enableInputDataBinding();

  bindClick("#scoobyRecordCall", saveCallReport);
  bindClick("#wrongNumber", submitBadContactInfo);
  bindClick("#permanentlyClosed", submitPermanentlyClosed);
  bindClick("#closedForTheDay", submitCallTomorrow);
  bindClick("#closedForTheWeekend", submitCallMonday);
  bindClick("#noAnswer", submitCallTwoHours);
  bindClick("#longHold", submitCallTwoHours);

  // don't show "on hold for more than 4 minutes" until 4 min have elapsed
  const el = document.querySelector("#longHold");
  if (el !== null) {
    el.style.visibility = "hidden";
    setTimeout(() => {
      el.style.visibility = "visible";
    }, 4 * MINUTE);
  }
  if (document.querySelector("#autodial")?.checked) {
    document.querySelector("#location-phone-url")?.click();
  }
};

// assumes we only have one toast at a time
const showCompletionToast = (locationName) => {
  const goalCalls = callerStats.today % 5 === 0 ? callerStats.today + 5 : Math.ceil(callerStats.today / 5) * 5;
  const progress = (100 * callerStats.today) / goalCalls;

  const validRoles = ["Volunteer Caller", "Vaccinate CA Staff"];
  const withProgress = userRoles?.filter((role) => validRoles.includes(role)).length > 0;

  fillTemplateIntoDom(toastTemplate, "#toastContainer", {
    title: locationName,
    curCalls: callerStats.today,
    withProgress,
    goalCalls,
  });

  document.querySelector("#onlyToast").addEventListener("shown.bs.toast", () => {
    // bootstrap progress bars animate width - begin animation on show
    document.querySelector(".progress-bar")?.setAttribute("style", `width: ${progress}%`);
  });

  bindClick("#onlyToastButton", loadAndFillPreviousCall);
  new bootstrap.Toast(document.querySelector("#onlyToast"), {
    autohide: true,
  }).show();
};

const hideToast = () => {
  document.querySelector("#onlyToast")?.classList.add("hide");
};

const isWebBanked = () => {
  // TODO: possible we may also want to check against auth0 roles
  const urlParams = new URLSearchParams(window.location.search);
  return !!urlParams.get("location_id");
};
