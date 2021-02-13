module.exports = {
  "parserOptions": {
    "ecmaVersion": 12,
    "sourceType": "module",
  },
  "overrides": [
    {
      "files": ["*.js"], 
      "rules": {
        "es/no-optional-chaining": "off"  // These internal tools are targeting current modern browsers. I want optional chaining
      }
    }
   ]
};
