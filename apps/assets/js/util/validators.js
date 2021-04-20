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
const AGE_BLOCK =
  "Before we mark a site as requiring 65+ outside special groups to be vaccinated, we'd like some more information about why. Fill in the private notes field with as much information as you can about what the location told you.";
const SECOND_DOSE_AGE_BLOCK =
  "It's unexpected for a site to be limited to second dose only if the minimum age to get vaccinated outside special groups is 16 or 18 years old. Please fill in the private notes field with as much information as you can about what the location told you.";

const MAX_AGE_FOR_SECOND_DOSE_BLOCK = 18;
const MIN_AGE_TO_BLOCK = 65;

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
const ageAvailabilityRegex = /Yes: vaccinating (\d+)\+/;

export const validateReport = (report) => {
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

  const markedSecondDoseOnly = !!report.Availability.filter((avail) => avail === "Scheduling second dose only").length;
  report.Availability.forEach((a) => {
    // check against availabilities that require private note changes
    if (report.internal_notes_unchanged) {
      const ageMatch = a.match(ageAvailabilityRegex);
      if (ageMatch && ageMatch[1]) {
        const age = parseInt(ageMatch[1]);
        if (age >= MIN_AGE_TO_BLOCK) {
          reportState.blockingIssues.push(AGE_BLOCK);
        } else if (age <= MAX_AGE_FOR_SECOND_DOSE_BLOCK && markedSecondDoseOnly) {
          reportState.blockingIssues.push(SECOND_DOSE_AGE_BLOCK);
        }
      }

      if (AVAIL_TO_BLOCKING_ISSUES[a]) {
        reportState.blockingIssues.push(AVAIL_TO_BLOCKING_ISSUES[a]);
      }
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
