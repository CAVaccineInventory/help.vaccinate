export default (str1, str2, ignoreCase) => {
  return ignoreCase ? str1?.toLowerCase() === str2?.toLowerCase() : str1 === str2;
};
