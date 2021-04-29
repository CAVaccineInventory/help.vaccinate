const PUBLIC_NOTES_WARNING =
  "Looks like there is a phone number or email address in the public notes field. Phone numbers and email addresses should only appear in contact information and booking links, not in public notes. Double-check it's really necessary to put in the public notes.";
const CONTACT_INFO_BLOCK =
  "Fill in the private notes field with more details about this wrong number, especially if you were told what the right one is.";
const NEVER_BLOCK =
  "Before we mark a site as never being a vaccination site, we'd like some more information about why. Fill in the private notes field with as much information as you can about what the location told you.";
const PERM_CLOSED_BLOCK =
  "Before we mark a site as being permanently closed, we'd like some more information about why. Fill in the private notes field with as much information as you can about what the location told you.";
const PRIVATE_ONLY_BLOCK =
  "Before we mark a site as not being open to the public, we'd like some more information about why. Please fill in the private notes field with as much information as you can about what the location told you.";
const WALKINS_ACCEPTED_BLOCK =
  "In general, locations that allow walk-ins are rare. Fill in the private notes field with details about what the pharmacist told you.";
const INVALID_DATE_BLOCK =
  "The date that was entered for when the site will stop offering vaccines was in the past. Please double check you entered the date correctly.";
const INVALID_DATE_FORMAT_BLOCK =
  "The date that was entered for when the site will stop offering vaccines was not in a format we recognize. If you are using Safari, that would be yyyy-mm-dd. For example: 2021-05-25.";
const OTHER_VACCINE_BLOCK =
  "What other vaccines does this site offer? Please fill in the private notes field with details.";

const AVAIL_TO_BLOCKING_ISSUES = {
  "No: incorrect contact information": CONTACT_INFO_BLOCK,
  "No: will never be a vaccination site": NEVER_BLOCK,
  "No: location permanently closed": PERM_CLOSED_BLOCK,
  "No: not open to the public": PRIVATE_ONLY_BLOCK,
  "Yes: walk-ins accepted": WALKINS_ACCEPTED_BLOCK,
};

const ALWAYS_REVIEW_CALL_TAGS = new Set(["Yes: walk-ins accepted"]);

const phoneNumberRegex = /\s+(\+?\d{1,2}(\s|-)*)?(\(\d{3}\)|\d{3})(\s|-)*\d{3}(\s|-)*\d{4}/;
const emailRegex = /\S+@\S+\.\S+/; // This is very much not RFC-compliant, but generally matches common addresses.
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const validateReport = (report) => {
  const reportState = {
    blockingIssues: [], // issues we block on
    warningIssues: [], // issues we warn on
    requiresReview: false, // whether or not we require QA review on this report
  };

  // check against planned closure date. It should be in the future and should be yyyy-mm-dd format.
  if (report.planned_closure) {
    if (report.planned_closure.match(dateRegex)) {
      const closure = new Date(report.planned_closure);
      if (new Date() > closure) {
        reportState.blockingIssues.push(INVALID_DATE_BLOCK);
      }
    } else {
      reportState.blockingIssues.push(INVALID_DATE_FORMAT_BLOCK);
    }
  }

  // check against public notes for email and phone numbers
  const publicNotes = report.Notes;
  if (publicNotes) {
    if (publicNotes.match(phoneNumberRegex) || publicNotes.match(emailRegex)) {
      reportState.warningIssues.push(PUBLIC_NOTES_WARNING);
    }
  }

  report.Availability.forEach((a) => {
    if (report.internal_notes_unchanged && AVAIL_TO_BLOCKING_ISSUES[a]) {
      reportState.blockingIssues.push(AVAIL_TO_BLOCKING_ISSUES[a]);
    }

    // check against availabilities that always should be reviewed for calls
    if (ALWAYS_REVIEW_CALL_TAGS.has(a) && !report.web_banked) {
      reportState.requiresReview = true;
    }

    if (report.vaccines_offered && report.vaccines_offered.includes("Other")) {
      // always review if Other chosen for vaccines
      reportState.requiresReview = true;
      if (report.internal_notes_unchanged) {
        reportState.blockingIssues.push(OTHER_VACCINE_BLOCK);
      }
    }
  });

  reportState.requiresReview =
    reportState.requiresReview || !!reportState.blockingIssues.length || !!reportState.warningIssues.length;
  return reportState;
};
