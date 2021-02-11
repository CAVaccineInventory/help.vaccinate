module.exports = function (config) {
    config.setBrowserSyncConfig({
	ghostMode: false
  });
    config.addPassthroughCopy({ "assets/css": "assets/css" });
    return {
        dir: {
            input: 'pages',
            output: '_site',
            includes: '../_includes'
        },
    };
};

