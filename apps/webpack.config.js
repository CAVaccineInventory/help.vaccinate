const path = require("path");
const webpack = require("webpack");

module.exports = {
  mode: "production",
  entry: {
    scooby: "./assets/js/scooby.js",
    velma: "./assets/js/velma.js",
  },
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, "_site/assets/js"),
    environment: {
      arrowFunction: false,
      bigIntLiteral: false,
      const: false,
      destructuring: false,
      dynamicImport: false,
      forOf: false,
      module: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.m?jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
      {
        test: /\.handlebars$/,
        loader: "handlebars-loader",
        options: {
          helperDirs: [path.resolve(__dirname, "assets/js/handlebars-helpers")],
        },
      },
    ],
  },
  plugins: [new webpack.EnvironmentPlugin({ DEPLOY: "testing", CUSTOM_API_TARGET: null})],
};
