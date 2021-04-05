/**
 * Validators reused in netlify lambdas, so we must use common js syntax
 */

const PUBLIC_NOTES_WARNING =
  "Looks like there is a phone number or email address in the public notes field. Contact information and booking links are already displayed, so usually they shouldn't be included in public notes. Are you sure you want to include them?";

const AGE_WARNING =
  "It's unlikely that a site in this county will be open to people that young without other restrictions. You need to update the private notes field with details.";

const CONTACT_INFO_BLOCK = "It's unexpected to have the wrong number. You need to update the private notes field with details.";
const NEVER_BLOCK =
  "It's unexpected for a site to never become a vaccination site. You need to update the private notes field with details.";
const PERM_CLOSED_BLOCK =
  "It's unexpected for a site to be permanently closed. You need to update the private notes field with details.";
const PRIVATE_ONLY_BLOCK =
  "It's unexpected for a site to not be open to the public. You need to update the private notes field with details.";
const WALKINS_ACCEPTED_BLOCK =
  "It's unexpected for a site to allow walk-ins. You need to update the private notes field with details.";

const AVAIL_TO_BLOCKING_ISSUES = {
  "No: incorrect contact information": CONTACT_INFO_BLOCK,
  "No: will never be a vaccination site": NEVER_BLOCK,
  "No: location permanently closed": PERM_CLOSED_BLOCK,
  "No: not open to the public": PRIVATE_ONLY_BLOCK,
  "Yes: walk-ins accepted": WALKINS_ACCEPTED_BLOCK,
};

const ALWAYS_REVIEW_TAGS = new Set(["Yes: walk-ins accepted"]);

const phoneNumberRegex = /\s+(\+?\d{1,2}(\s|-)*)?(\(\d{3}\)|\d{3})(\s|-)*\d{3}(\s|-)*\d{4}/;
const emailRegex = /\S+@\S+\.\S+/; // This is very much not RFC-compliant, but generally matches common addresses.

module.exports.validateReport = (report) => {
  const reportState = {
    blockingIssues: [], // issues we block on
    warningIssues: [], // issues we warn on
    requiresReview: false, // whether or not we require QA review on this report
  };

  // check against public notes for email and phone numbers
  const publicNotes = report.Notes;
  if (publicNotes) {
    if (publicNotes.match(phoneNumberRegex) || publicNotes.match(emailRegex)) {
      reportState.warningIssues.push(PUBLIC_NOTES_WARNING);
    }
  }

  // check against min age
  if (report.internal_notes_unchanged && report.unexpected_min_age) {
    reportState.blockingIssues.push(AGE_WARNING);
  }

  report.Availability.forEach((a) => {
    // check against availabilities that require private note changes
    if (report.internal_notes_unchanged && AVAIL_TO_BLOCKING_ISSUES[a]) {
      reportState.blockingIssues.push(AVAIL_TO_BLOCKING_ISSUES[a]);
    }

    // check against availabilities that always should be reviewed
    if (ALWAYS_REVIEW_TAGS.has(a)) {
      reportState.requiresReview = true;
    }
  });

  reportState.requiresReview =
    reportState.requiresReview || !!reportState.blockingIssues.length || !!reportState.warningIssues.length;
  return reportState;
};
