/**
 * Validators reused in netlify lambdas, so we must use common js syntax
 */

const REVIEW_IF_UNCHANGED_NOTES_TAGS = new Set([
  "No: incorrect contact information",
  "No: will never be a vaccination site",
  "No: location permanently closed",
  "No: not open to the public",
]);
const REVIEW_ALWAYS_TAGS = new Set(["Yes: walk-ins accepted"]);

const phoneNumberRegex = /\s+(\+?\d{1,2}(\s|-)*)?(\(\d{3}\)|\d{3})(\s|-)*\d{3}(\s|-)*\d{4}/;
const emailRegex = /\S+@\S+\.\S+/; // This is very much not RFC-compliant, but generally matches common addresses.

module.exports.validateReport = (report) => {
  const reportState = {
    warningIssues: [],
    blockingIssues: [],
  }

  // check against public notes for email and phone numbers
  const publicNotes = report.Notes;
  if (publicNotes) {
    if (publicNotes.match(phoneNumberRegex)) {
      reportState.warningIssues.push("Phone number detected");
    }
    if (publicNotes.match(emailRegex)) {
      reportState.warningIssues.push("Email detected");
    }
  }

  // check against availability tags for suspect entries
  let suspectTags;
  if (report.internal_notes_unchanged) {
    suspectTags = new Set([
      ...REVIEW_ALWAYS_TAGS,
      ...REVIEW_IF_UNCHANGED_NOTES_TAGS,
    ]);
  } else {
    suspectTags = new Set(REVIEW_ALWAYS_TAGS);
  }

  if (report.Availability) {
    if (report.Availability.filter(a => suspectTags.has(a)).length) {
      reportState.blockingIssues.push("lol");
    }
  }

  // TODO: age

  return reportState;
};

