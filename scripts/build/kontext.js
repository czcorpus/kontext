/*
 * Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2
 * dated June, 1991.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

/**
 * A bunch of util functions used by Grunt.js to inject installation-specific (e.g. custom JS plug-ins)
 * and dynamic (e.g. list of current template JS models) information.
 */
(function (module) {
    'use strict';

    const fs = require('fs');
    const merge = require('merge');
    const path = require('path');
    const peg = require('pegjs');
    const DOMParser = require('xmldom').DOMParser;

    function camelizeName(s) {
        return s.split('_')
                .map((x, i) => i > 0 ? x.substr(0, 1).toUpperCase() + x.substr(1) : x)
                .join('');
    }

    /**
     * Find all the children XML tags within <plugin> section.
     * These represent all the plug-ins KonText can use (including
     * the ones not in use in the current configuration).
     *
     * @param {*} doc A DOM document representing parsed config.xml
     */
    function findPluginTags(doc) {
        let plugins = doc.getElementsByTagName('plugins');
        let ans = [];
        function findJsModule(root) {
            let jsm = root.getElementsByTagName('js_module');
            if (jsm.length > 0) {
                return jsm[0].textContent;
            }
            return null;
        }

        if (plugins) {
            for (let i = 0; i < plugins[0].childNodes.length; i += 1) {
                let node = plugins[0].childNodes[i];
                if (node.nodeType === 1) {
                    let jsm = findJsModule(node);
                    ans.push({canonicalName: camelizeName(node.nodeName), jsModule: jsm ? jsm : null});
                }
            }
        }
        return ans;
    }

    /**
     * Find all the build customization (file build.json) setup
     * of individual plug-ins. Such a customization is only needed
     * in specific situations (legacy JS modules etc.).
     *
     * @param {*} pluginDir A directory path where JS plugins are located
     * @param {*} doc A DOM document representing parsed config.xml
     */
    function findAllPluginBuildConf(pluginDir, doc) {
        let ans = {};
        findPluginTags(doc).forEach((item) => {
            let dirPath;
            if (item['jsModule']) {
                dirPath = pluginDir + '/' + item['jsModule'];
                fs.readdirSync(dirPath).forEach(function (filename) {
                    if (filename === 'build.json') {
                        ans[item['jsModule']] = JSON.parse(fs.readFileSync(dirPath + '/' + filename));
                    }
                });
            }
        });
        return ans;
    }

    module.exports.loadKontextConf = function (confPath) {
        const data = fs.readFileSync(confPath, {encoding: 'utf8'});
        return new DOMParser().parseFromString(data);
    };

    /**
     *
     */
    module.exports.findThemeCss = function (doc, cssPath, themesPath) {
        const kontextNode = doc.getElementsByTagName('kontext')[0];
        let themeNode = null;
        for (let i = 0; i < kontextNode.childNodes.length; i += 1) {
            if (kontextNode.childNodes[i].nodeName === 'theme') {
                themeNode = kontextNode.childNodes[i];
                 break;
            }
        }
        let themeName = null;
        let srch = themeNode.getElementsByTagName('name')[0];
        if (srch) {
            themeName = srch.textContent.trim();
        }

        if (themeNode && themeName) {
            const cssNode = themeNode.getElementsByTagName('css')[0];
            if (cssNode) {
                const css = cssNode.textContent.trim();
                if (css) {
                    return path.resolve(themesPath, themeName, css);
                }
            }
        }
        return path.resolve(cssPath, 'empty.less');
    }

    /**
     *
     */
    module.exports.findPluginExternalModules = function (confDoc, jsPath) {
        const pluginsPath = path.resolve(jsPath, 'plugins');
        const pluginBuildConf = findAllPluginBuildConf(pluginsPath, confDoc);
        const ans = [];
        for (let p in pluginBuildConf) {
            const externals = pluginBuildConf[p]['externalModules'] || {};
            for (let p2 in externals) {
                ans.push([p2, externals[p2]]);
            }
        }
        return ans
    };


    /**
     * Produces mapping for modules with 'fake' (= non filesystem) paths.
     * E.g. 'plugins/queryStorage' maps to 'plugins/myCoolQueryStorage'.
     *
     * @param {string} confDoc - parsed KonText XML config
     * @param {string} jsPath - a path to JS/TS plug-ins implementations
     * @param {string} cssPath - a path to core CSS/LESS files
     * @param {string} themesPath - a path to theme customization dir
     * @param {boolean} isProduction - set whether a production setup should be exported
     * @return {[fakePath:string]:string}
     */
    module.exports.loadModulePathMap = function (confDoc, jsPath, cssPath, themesPath, isProduction) {
        const pluginsPath = path.resolve(jsPath, 'plugins');
        const reactModule = isProduction ? 'vendor/react.min' : 'vendor/react.dev';
        const reactDomModule = isProduction ? 'vendor/react-dom.min' : 'vendor/react-dom.dev';
        mergeTranslations(jsPath, path.resolve(jsPath, '.compiled/translations.js'));
        const cqlParserPath = parseCqlGrammar(jsPath);
        const moduleMap = {
            'translations': path.resolve(jsPath, '.compiled/translations'),
            'views': path.resolve(jsPath, 'views'),
            'stores': path.resolve(jsPath, 'stores'),
            'vendor/rsvp' : path.resolve(jsPath, 'vendor/rsvp.min'),
            'vendor/rsvp-ajax' : path.resolve(jsPath, 'vendor/rsvp-ajax'),
            'vendor/react': path.resolve(jsPath, reactModule),
            'vendor/react-dom': path.resolve(jsPath, reactDomModule),
            'vendor/invariant' : path.resolve(jsPath, 'vendor/invariant'),
            'vendor/immutable': path.resolve(jsPath, 'vendor/immutable.min'),
            'vendor/d3': path.resolve(jsPath, 'vendor/d3.min'),
            'vendor/d3-color': path.resolve(jsPath, 'vendor/d3-color.min'),
            'vendor/Dispatcher': path.resolve(jsPath, 'vendor/Dispatcher'),
            'vendor/intl-messageformat': path.resolve(jsPath, 'vendor/intl-messageformat'),
            'vendor/SoundManager' : path.resolve(jsPath, 'vendor/soundmanager2.min'),
            'cqlParser/parser': cqlParserPath,
            'misc/keyboardLayouts': path.resolve(jsPath, 'kb-layouts.json'),
            'styles': cssPath,
            'custom-styles/theme.less': module.exports.findThemeCss(confDoc, cssPath, themesPath)
        };
        const pluginBuildConf = findAllPluginBuildConf(pluginsPath, confDoc);
        for (let p in pluginBuildConf) {
            const remapModules = pluginBuildConf[p]['remapModules'] || {};
            for (let p in remapModules) {
                moduleMap[p] = remapModules[p];
            }
        };
        findPluginTags(confDoc).forEach((item) => {
            if (item.jsModule) {
                moduleMap['plugins/' + item.canonicalName] = path.resolve(pluginsPath, item.jsModule);

            } else {
                moduleMap['plugins/' + item.canonicalName] = path.resolve(pluginsPath, 'empty');
            }
        });
        return moduleMap;
    };

    function parseCqlGrammar(jsPath) {
        const targetDir = path.resolve(jsPath, '.compiled');
        const grammar = fs.readFileSync(
            path.resolve(__dirname, 'cql.pegjs'),
            {encoding: 'utf-8'}
        );
        // cmd: 'mkdir -p public/files/js/.compiled/cqlParser;
        // ./node_modules/pegjs/bin/pegjs --format amd
        // --allowed-start-rules Query,RegExpRaw,PhraseQuery
        // -o public/files/js/.compiled/cqlParser/parser.js scripts/build/cql.pegjs'
        const parser = peg.generate(
            grammar,
            {
                allowedStartRules: ['Query', 'RegExpRaw' , 'PhraseQuery'],
                format: 'commonjs'
            }
        );
        const filePath = path.resolve(targetDir, 'parser.js');
        fs.writeFileSync(filePath);
        return filePath;
    }

    /**
     * Configures a special module "vendor/common" which contains all the 3rd
     * party libs merged into a single file
     */
    module.exports.listPackedModules = function (confDoc, pluginsPath, isProduction) {
        let modules = [
            'vendor/rsvp',
            'vendor/rsvp-ajax',
            'vendor/react',
            'vendor/react-dom',
            'vendor/immutable',
            'vendor/Dispatcher',
            'SoundManager',
            'vendor/intl-messageformat',
            'vendor/d3',
            'vendor/d3-color'
        ];
        if (isProduction) {
            modules.push('translations');

        } else {
            let pluginBuildConf = findAllPluginBuildConf(pluginsPath, confDoc);
            for (let p in pluginBuildConf) {
                const remapModules = pluginBuildConf[p]['remapModules'] || {};
                for (let p in remapModules) {
                    modules.push(p);
                }
            }
        }
        return [
            {
                'name': 'vendor/common',
                'include': modules
            }
        ];
    };

    function findAllMessageFiles(startDir) {
        let ans = [];
        fs.readdirSync(startDir).forEach((item) => {
            let fullPath = startDir + '/' + item;
            if (fs.lstatSync(fullPath).isDirectory() && ['min'].indexOf(item) === -1) {
                ans = ans.concat(findAllMessageFiles(fullPath));

            } else if (item === 'messages.json') {
                ans.push(fullPath);
            }
        });
        return ans;
    }

    function mergeTranslations(startDir, destFile) {
        let files = findAllMessageFiles(startDir);
        let translations = {};
        files.forEach((item) => {
           translations = merge.recursive(translations, JSON.parse(fs.readFileSync(item)));
        });
        if (!destFile || destFile.length === 0) {
            throw new Error('No target file for client-side translations specified');

        } else if (Object.prototype.toString.call(destFile) !== '[object Array]') {
            destFile = [destFile];
        }
        destFile.forEach((destItem) => {
            fs.writeFileSync(destItem, "define([], function () { return "
                + JSON.stringify(translations) + "; });");
        });
    }

    module.exports.minifyJSONFile = function (srcPath, dstPath) {
        let data = fs.readFileSync(srcPath);
        fs.writeFileSync(dstPath, JSON.stringify(JSON.parse(data), null, ''));
    }

}(module));