//const isProduction = process.env.NODE_ENV === 'production';

module.exports = function (config) {
    config.setDataDeepMerge(true);
    config.setTemplateFormats([
        'html',
        'njk',
        'md',        
    ]);
    config.addPassthroughCopy("site/assets/**/*.*");
    config.htmlTemplateEngine = "njk";
    config.dir = {
        input: "./site",
        output: "./.dist",
        layouts: "_layouts"
    };
    return config;
};