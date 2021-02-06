const path = require("path");

module.exports = {
  "mode": "development",
  "entry": {
    "main": "./assets/js/index.js",
  },
  "devtool": "source-map",
  "output": {
    "path": path.resolve(__dirname, "_site/assets/js"),
    "environment": {
      "arrowFunction": false,
      "bigIntLiteral": false,
      "const": false,
      "destructuring": false,
      "dynamicImport": false,
      "forOf": false,
      "module": false,
    },
  },
  "module": {
    "rules": [
      {
        test: /\.m?jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
    ],
  },
};
