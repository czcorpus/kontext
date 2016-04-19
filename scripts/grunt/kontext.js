/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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
 *
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

    let fs = require('fs');
    let merge = require('merge');

    function camelizeName(s) {
        return s.split('_')
                .map((x, i) => i > 0 ? x.substr(0, 1).toUpperCase() + x.substr(1) : x)
                .join('');
    }

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

    function findAllPluginCss(pluginDir, doc) {
        function endsWith(s, subs) {
            return s.indexOf(subs) === s.length - subs.length;
        }
        let ans = [];
        findPluginTags(doc).forEach((item) => {
            let dirPath;
            if (item['jsModule']) {
                dirPath = pluginDir + '/' + item['jsModule'];
                fs.readdirSync(dirPath).forEach(function (filename) {
                    if (endsWith(filename, '.css') || endsWith(filename, '.less')) {
                        ans.push(dirPath + '/' + filename);
                    }
                });
            }
        });
        return ans;
    }

    function resourceIsLocal(path) {
        return !(path.indexOf('//') === 0 || path.indexOf('http') === 0);
    }

    function findAllThemeCss(doc) {
        let kontextNode = doc.getElementsByTagName('kontext')[0];
        let themeNode = null;
        let cssNode = null;
        let styles = [];

        let themeName = null;
        let srch = kontextNode.getElementsByTagName('name')[0];
        if (srch) {
            themeName = srch.textContent.trim();
        }

        for (let i = 0; i < kontextNode.childNodes.length; i += 1) {
            if (kontextNode.childNodes[i].nodeName === 'theme') {
                themeNode = kontextNode.childNodes[i];
                 break;
            }
        }
        if (themeNode) {
            cssNode = themeNode.getElementsByTagName('css')[0];
            if (cssNode) {
                for (let i = 0; i < cssNode.childNodes.length; i += 1) {
                    if (cssNode.childNodes[i].nodeType === 1 || cssNode.childNodes[i].nodeType === 3) {
                        let cssPath = cssNode.childNodes[i].textContent.trim();
                        if (cssPath && resourceIsLocal(cssPath)) {
                            styles.push('public/files/themes/' + themeName + '/'
                                + cssNode.childNodes[i].textContent.trim());
                        }
                    }
                }
            }
        }
        return styles;
    }

    /**
     * Finds CSS paths defined in a custom KonText theme. This is merged during the
     * build process with the rest of CSS.
     */
    module.exports.getCustomStyles = function (confPath, pluginsPath) {
        let xmldom = require('xmldom');
        let data = fs.readFileSync(confPath, {encoding: 'utf8'});
        let doc = new xmldom.DOMParser().parseFromString(data);
        return findAllThemeCss(doc).concat(findAllPluginCss(pluginsPath, doc));
    };

    /**
     * Produces mapping for modules with 'fake' (= non filesystem) paths.
     * E.g. 'jquery' maps to 'vendor/jquery.min', 'plugins/queryStorage'
     * maps to 'plugins/myCoolQueryStorage'.
     *
     * @param {string} path to KonText XML configuration file (config.xml)
     * @param {boolean} sets whether a production setup should be exported
     * @return {[fakePath:string]:string}
     */
    module.exports.loadModulePathMap = function (confPath, isProduction) {
        let data = fs.readFileSync(confPath, {encoding: 'utf8'});
        let DOMParser = require('xmldom').DOMParser;
        let doc = new DOMParser().parseFromString(data);
        let reactModule = isProduction ? 'vendor/react.min' : 'vendor/react.dev';
        let reactDomModule = isProduction ? 'vendor/react-dom.min' : 'vendor/react-dom.dev';
        let pluginMap = {
            'win' : 'empty:',
            'conf' : 'empty:',
            'plugins/applicationBar/toolbar': 'empty:',
            'jquery' : 'vendor/jquery.min',
            'vendor/rsvp' : 'vendor/rsvp.min',
            'vendor/react': reactModule,
            'vendor/react-dom': reactDomModule,
            'vendor/immutable': 'vendor/immutable.min',
            'vendor/d3': 'vendor/d3.min',
            'SoundManager' : 'vendor/soundmanager2.min',
        };
        findPluginTags(doc).forEach((item) => {
            pluginMap['plugins/' + item.canonicalName] = item.jsModule ? 'plugins/' + item.jsModule : 'empty:';
        });
        return pluginMap;
    };

    /**
     * Configures a special module "vendor/common" which contains all the 3rd
     * party libs merged into a single file
     */
    module.exports.listPackedModules = function (isProduction) {
        let modules = [
            'jquery',
            'popupbox',
            'vendor/rsvp',
            'vendor/rsvp-ajax',
            'vendor/react',
            'vendor/react-dom',
            'vendor/immutable',
            'vendor/Dispatcher',
            'SoundManager',
            'vendor/typeahead',
            'vendor/bloodhound',
            'vendor/intl-messageformat',
            'vendor/virtual-keyboard',
            'vendor/d3'
        ];
        if (isProduction) {
            modules.push('translations');
        }
        return [
            {
                'name': 'vendor/common',
                'include': modules
            }
        ];
    };

    /**
     * Generates a list of modules representing models of individual pages.
     *
     * @param {string} path to a directory where models reside
     * @return Array<string>
     */
    module.exports.listAppModules = function (tplDir) {
        let ans = [];

        function isExcluded(p) {
            return ['document.js'].indexOf(p) > -1;
        }

        fs.readdirSync(tplDir).forEach(function (item) {
            let srch = /^(.+)\.[jt]s$/.exec(item);
            if (srch && !isExcluded(item)) {
                ans.push({
                    name: 'tpl/' + srch[1],
                    exclude: ['vendor/common'] // we do not want to include vendor stuff in page code
                });
            }
        });
        return ans;
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

    module.exports.mergeTranslations = function (startDir, destFile) {
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

}(module));