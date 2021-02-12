module.exports = function (config) {
    config.setBrowserSyncConfig({
	ghostMode: false
  });
    config.addPassthroughCopy({ "assets/css": "assets/css" });
    config.addPassthroughCopy({ "assets/img": "assets/img" });
    return {
        dir: {
            input: 'pages',
            output: '_site',
            includes: '../_includes'
        },
    };
};

