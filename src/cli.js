#!/usr/bin/env node

import fs from 'fs';
import meow from 'meow';
import mkdirp from 'mkdirp';
import path from 'path';
import resolveFrom from 'resolve-from';
import standalone from './standalone';

const cli = meow(`
    Usage
        $ webfont [input] [options]

    Input
        Files(s) or glob(s).
        If an input argument is wrapped in quotation marks, it will be passed to node-glob
        for cross-platform glob support.

    Options
        --config                       Path to a specific configuration file (JSON, YAML, or CommonJS)
                                       or the name of a module in \`node_modules\` that points to one.
                                       If no \`--config\` argument is provided, webfont will search for
                                       configuration  files in the following places, in this order:
                                           - a \`webfont\` property in \`package.json\`
                                           - a \`.webfontrc\` file (with or without filename extension:
                                               \`.json\`, \`.yaml\`, and \`.js\` are available)
                                           - a \`webfont.config.js\` file exporting a JS object
                                       The search will begin in the working directory and move up the
                                       directory tree until a configuration file is found.
        -f, --font-name                The font family name you want, default: "webfont".
        -h, --help                     Output usage information.
        -v, --version                  Output the version number.
        -r, --formats                  Only this formats generate.
        -d, --dest                     Destination for generated fonts.
        -t, --src-css-template         Path to custom template.
        -c, --css-template-class-name  Class name in css template.
        -p, --css-template-font-path   Font path in css template.
        -n, --css-template-font-name   Font name in css template.
        -s, --dest-css-template        Destination for generated css template.
        --quite                        Tell me everything!.

    For "svgicons2svgfont":
        --font-id                      The font id you want, default as "--font-name".
        --style                        The font style you want.
        --weight                       The font weight you want.
        --fixed-width                  Creates a monospace font of the width of the largest input icon.
        --center-horizontally          Calculate the bounds of a glyph and center it horizontally.
        --normalize                    Normalize icons by scaling them to the height of the highest icon.
        --height                       The outputted font height [MAX(icons.height)].
        --round                        Setup the SVG path rounding [10e12].
        --descent                      The font descent [0].
        --ascent                       The font ascent [height - descent].
        --start-unicode                The start unicode codepoint for unprefixed files [0xEA01].
        --prepend-unicode              Prefix files with their automatically allocated unicode codepoint.
        --metadata                     Content of the metadata tag.
`, {
    alias: {
        /* eslint-disable id-length */
        c: 'css-template-class-name',
        d: 'dest',
        f: 'font-name',
        h: 'help',
        n: 'css-template-font-name',
        p: 'css-template-font-path',
        r: 'formats',
        s: 'dest-css-template',
        t: 'src-css-template',
        v: 'version'
        /* eslint-enable id-length */
    },
    boolean: [
        'css',
        'help',
        'version',
        'quite',
        'fixed-width',
        'center-horizontally',
        'normalize',
        'prepend-unicode'
    ],
    default: {
        config: false
    },
    string: [
        'font-name',
        'dest',
        'src-css-template',
        'css-template-class-name',
        'css-template-font-path',
        'css-template-font-name',
        'dest-css-template',
        'font-id',
        'style',
        'weight',
        'height',
        'round',
        'descent',
        'ascent',
        'start-unicode'
    ]
});

const optionsBase = {};

if (cli.flags.config) {
    // Should check these possibilities:
    //   a. name of a node_module
    //   b. absolute path
    //   c. relative path relative to `process.cwd()`.
    // If none of the above work, we'll try a relative path starting
    // in `process.cwd()`.
    optionsBase.configFile = resolveFrom(process.cwd(), cli.flags.config)
        || path.join(process.cwd(), cli.flags.config);
}

if (cli.flags.fontName) {
    optionsBase.fontName = cli.flags.fontName;
}

if (cli.flags.formats) {
    optionsBase.formats = cli.flags.formats;
}

if (cli.flags.dest) {
    optionsBase.dest = cli.flags.dest;
}

if (cli.flags.srcCssTemplate) {
    optionsBase.srcCssTemplate = cli.flags.srcCssTemplate;
}

if (cli.flags.cssTemplateClassName) {
    optionsBase.cssTemplateClassName = cli.flags.cssTemplateClassName;
}

if (cli.flags.cssTemplateFontPath) {
    optionsBase.cssTemplateFontPath = cli.flags.cssTemplateFontPath;
}

if (cli.flags.cssTemplateFontName) {
    optionsBase.cssTemplateFontName = cli.flags.cssTemplateFontName;
}

if (cli.flags.destCssTemplate) {
    optionsBase.destCssTemplate = cli.flags.destCssTemplate;
}

if (cli.flags.fontId) {
    optionsBase.fontId = cli.flags.fontId;
}

if (cli.flags.style) {
    optionsBase.style = cli.flags.style;
}

if (cli.flags.weight) {
    optionsBase.weight = cli.flags.weight;
}

if (cli.flags.fixedWidth) {
    optionsBase.fixedWidth = cli.flags.fixedWidth;
}

if (cli.flags.centerHorizontally) {
    optionsBase.centerHorizontally = cli.flags.centerHorizontally;
}

if (cli.flags.normalize) {
    optionsBase.normalize = cli.flags.normalize;
}

if (cli.flags.height) {
    optionsBase.height = cli.flags.height;
}

if (cli.flags.round) {
    optionsBase.round = cli.flags.round;
}

if (cli.flags.descent) {
    optionsBase.descent = cli.flags.descent;
}

if (cli.flags.ascent) {
    optionsBase.ascent = cli.flags.ascent;
}

if (cli.flags.startUnicode) {
    optionsBase.startUnicode = cli.flags.startUnicode;
}

if (cli.flags.prependUnicode) {
    optionsBase.prependUnicode = cli.flags.prependUnicode;
}

if (cli.flags.metadata) {
    optionsBase.metadata = cli.flags.metadata;
}

Promise.resolve().then(
    () => Object.assign({}, optionsBase, {
        files: cli.input
    })
)
    .then((options) => {
        if (!options.files.length) {
            cli.showHelp();
        }

        if (!options.dest) {
            return Promise.reject(new Error('Require `--dest` options'));
        }

        if (options.srcCssTemplate && !options.destCssTemplate) {
            return Promise.reject(new Error('Require `--dest-css-template` options'));
        }

        if (options.destCssTemplate) {
            options.css = true;

            const extname = path.extname(options.destCssTemplate);

            options.cssFormat = extname ? extname.slice(1, extname.length) : 'css';
        }

        return standalone(options)
            .then((result) => Promise.resolve(result))
            .then((result) => {
                result.config = Object.assign({}, {
                    dest: options.dest,
                    destCssTemplate: options.destCssTemplate
                }, result.config);

                return Promise.resolve(result);
            });
    })
    .then((result) => {
        const fontName = result.config.fontName;

        return new Promise((resolve, reject) => {
            mkdirp(path.resolve(result.config.dest), (error) => {
                if (error) {
                    return reject(error);
                }

                return resolve();
            });
        })
            .then(() => {
                if (!result.css) {
                    return Promise.resolve();
                }

                const cssTemplateDirectory = path.resolve(path.dirname(result.config.destCssTemplate));

                return new Promise((resolve, reject) => {
                    mkdirp(cssTemplateDirectory, (error) => {
                        if (error) {
                            return reject(error);
                        }

                        return resolve();
                    });
                });
            })
            .then(() => Promise.all(Object.keys(result).map((type) => {
                if (type === 'config') {
                    return Promise.resolve();
                }

                const content = result[type];
                let destFilename = null;

                if (type !== 'css') {
                    destFilename = path.resolve(path.join(result.config.dest, `${fontName}.${type}`));
                } else {
                    destFilename = path.resolve(result.config.destCssTemplate);
                }

                return new Promise((resolve, reject) => {
                    fs.writeFile(destFilename, content, (error) => {
                        if (error) {
                            return reject(new Error(error));
                        }

                        return resolve();
                    });
                });
            })))
            .then(() => Promise.resolve(result));
    })
    .catch((error) => {
        console.log(error.stack); // eslint-disable-line no-console
        process.exit(error.code || 1); // eslint-disable-line no-process-exit
    });
