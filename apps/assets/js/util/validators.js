/**
 * Validators reused in netlify lambdas, so we must use common js syntax
 */

const phoneNumberRegex = /\s+(\+?\d{1,2}(\s|-)*)?(\(\d{3}\)|\d{3})(\s|-)*\d{3}(\s|-)*\d{4}/;
const emailRegex = /\S+@\S+\.\S+/; // This is very much not RFC-compliant, but generally matches common addresses.

module.exports.validatePublicNotes = (notes) => {
  const issues = [];
  if (notes.match(phoneNumberRegex)) {
    issues.push("Phone number detected");
  }
  if (notes.match(emailRegex)) {
    issues.push("Email detected");
  }
  return issues;
};
