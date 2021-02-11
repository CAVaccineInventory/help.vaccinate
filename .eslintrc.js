module.exports = {
  "env": {
    "browser": true,
    "commonjs": true,
    "es2021": true,
    "node": true
  },
  "extends": [
    "google",
    "plugin:es/restrict-to-es2017",
    "plugin:es/no-new-in-esnext",
  ],
  "parserOptions": {
    "ecmaVersion": 12,
  },
  "rules": {
    "comma-dangle": ["error", {
      "arrays": "always-multiline",
      "objects": "always-multiline",
      "imports": "always-multiline",
      "exports": "always-multiline",
      "functions": "never",
    }],
    "indent": ["error", 2, { "MemberExpression": 1, "SwitchCase": 1 }],
    "max-len": ["off"],
    "new-cap": ["error", { "newIsCapExceptions": ["autoComplete"] }],
    "object-curly-spacing": ["error", "always"],
    "operator-linebreak": ["error", "after", { "overrides": { "?": "before", ":": "before" } }],
    "quotes": ["error", "double", { "avoidEscape": true }],
    "require-jsdoc": ["off"],
    "space-before-function-paren": ["error", {
      "anonymous": "always",
      "named": "never",
    }],
    "es/no-rest-spread-properties": ["off"],
  },
  "settings": {
    "es": { "aggressive": true },
  },
};
