import { DateTime } from "luxon";

// Calls the JSON feed to pull down sites data
let isFetching = false;
const subscribers = [];
let _fetchedSites;

async function fetchSites() {
  if (isFetching) {
    return new Promise((resolve) => {
      // TODO: handle errors in fetchSites
      subscribers.push(resolve);
    });
  }
  isFetching = true;
  const response = await fetch("https://api.vaccinateca.com/v1/locations.json");

  if (!response.ok) {
    alert(window.messageCatalog["data_js_alert"]);
    return;
  }
  const _fetchedData = await response.json();
  _fetchedSites = _fetchedData["content"];
  isFetching = false;
  subscribers.forEach((cb) => cb(_fetchedSites));
  return _fetchedSites;
}

async function fetchZipCodesData() {
  const res = await fetch("assets/json/zipCodes.json");
  if (res.ok) {
    return await res.json();
  }
  return null;
}

// Utilities for working with the JSON feed
function getHasVaccine(p) {
  try {
    return (
      p["Latest report yes?"] == 1 && p["Location Type"] != "Test Location"
    );
  } catch (_err) {
    return false;
  }
}

function getHasReport(p) {
  if (
    p["Location Type"] === "Test Location" ||
    !p.hasOwnProperty("Has Report")
  ) {
    return false;
  }
  return p["Has Report"];
}

function getCoord(p) {
  return { latitude: p["Latitude"], longitude: p["Longitude"] };
}

function getCounty(p) {
  return p["County"];
}

function getDisplayableVaccineInfo(p) {
  function getVaccineStatus(p) {
    const info = p["Availability Info"];
    if (!Array.isArray(info)) return false;
    return info
      .map((info) =>
        info
          .replace("Yes: ", "")
          .replace("No: ", "")
          .replace(
            "Skip: call back later",
            window.messageCatalog["data_js_call_back"]
          )
      )
      .join(" | ");
  }
  function getSchedulingInstructions(p) {
    const instructions = p["Appointment scheduling instructions"];
    if (!Array.isArray(instructions)) {
      return null;
    }
    return replaceAnyLinks(instructions.join(", "));
  }
  function getRepNotes(p) {
    const notes = p["Latest report notes"];
    if (!Array.isArray(notes)) {
      return null;
    }
    const linkifiedNotes = replaceAnyLinks(notes.join(" | "));
    if (linkifiedNotes.trim() === "") {
      return null;
    }
    return notes;
  }

  function replaceAnyLinks(body) {
    // Regex from https://stackoverflow.com/a/3890175.
    const urlRegex = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
    if (!body) {
      return "";
    }
    return body.replace(urlRegex, "<a href='$1' target='_blank'>$1</a>");
  }

  const hasReport = getHasReport(p);

  function isSuperSite(p) {
    return p["Location Type"] === "Super Site";
  }

  function getAgeRestriction(p) {
    for (const prop of p["Availability Info"]) {
      switch (prop) {
        case "Yes: vaccinating 85+":
          return 85;
        case "Yes: vaccinating 75+":
          return 75;
        case "Yes: vaccinating 65+":
          return 65;
      }
    }
    return undefined;
  }

  function doesLocationHaveProp(p, value) {
    return p["Availability Info"].some((prop) => prop === value);
  }

  function getAvailabilityProps(p) {
    return {
      ageRestriction: getAgeRestriction(p),
      isCountyRestricted: doesLocationHaveProp(
        p,
        "Yes: restricted to county residents"
      ),
      isAppointmentRequired:
        doesLocationHaveProp(p, "Yes: appointment required") ||
        doesLocationHaveProp(p, "Yes: appointment calendar currently full"),
      isLimitedToPatients: doesLocationHaveProp(
        p,
        "Yes: must be a current patient"
      ),
    };
  }

  function getYesNo(p) {
    if (hasReport) {
      return getHasVaccine(p) ? "Yes" : "No";
    } else {
      return "Unknown";
    }
  }

  return {
    status: getVaccineStatus(p),
    hasReport: hasReport,
    name: p["Name"],
    schedulingInstructions: getSchedulingInstructions(p),
    address: p["Address"] || null,
    reportNotes: getRepNotes(p),
    longitude: p["Longitude"],
    latitude: p["Latitude"],
    address: p["Address"],
    county: p["County"],
    isSuperSite: isSuperSite(p),
    latestReportDate: p["Latest report"],
    hasVaccine: getYesNo(p),
    ...(getHasVaccine(p) ? getAvailabilityProps(p) : {}),
  };
}

function getTimeDiffFromNow(timestamp) {
  const locale = document.documentElement.getAttribute("lang");
  return DateTime.fromISO(timestamp, { locale }).toRelative();
}

function splitSitesByVaccineState(sites) {
  const sitesWithVaccine = [];
  const sitesWithoutVaccine = [];
  const sitesWithNoReport = [];

  sites.forEach(function (site) {
    if (getHasReport(site)) {
      if (getHasVaccine(site)) {
        sitesWithVaccine.push(site);
      } else {
        sitesWithoutVaccine.push(site);
      }
    } else {
      sitesWithNoReport.push(site);
    }
  });
  return { sitesWithVaccine, sitesWithoutVaccine, sitesWithNoReport };
}

function sortByRecency(sites) {
  sites.sort((a, b) => {
    try {
      const aDate = a["Latest report"];
      const bDate = b["Latest report"];
      if (aDate && bDate) {
        return new Date(aDate) > new Date(bDate) ? -1 : 1;
      } else {
        if (aDate) {
          return -1;
        } else {
          return 1;
        }
      }
    } catch (e) {
      return 0;
    }
  });
}

export {
  fetchSites,
  getHasVaccine,
  getDisplayableVaccineInfo,
  getHasReport,
  getCoord,
  getCounty,
  getTimeDiffFromNow,
  fetchZipCodesData,
  splitSitesByVaccineState,
  sortByRecency,
};
