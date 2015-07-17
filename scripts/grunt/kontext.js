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

    var fs = require('fs'),
        jsModules = { // TODO this should be dynamic
            'application_bar' : 'applicationBar',
            'query_storage' : 'queryStorage',
            'live_attributes' : 'liveAttributes',
            'corparch' : 'corparch'
        };

    /**
     * Produces mapping for specific modules:
     * 1) modules which should be excluded from optimization
     *    - JQuery and similar (vendor) stuff
     *    - runtime-generated modules
     * 2) modules implemented by custom installation (e.g. the 
     *    'applicationBar' is in fact 'acmeApplicationBar')
     *
     * @param {string} path to the main app configuration XML
     * @return {{}}
     */
    module.exports.loadPluginMap = function (confPath, isProduction) {
        var data = fs.readFileSync(confPath, {encoding: 'utf8'}),
            DOMParser = require('xmldom').DOMParser,
            doc = new DOMParser().parseFromString(data),
            reactModule = isProduction ? 'vendor/react.min' : 'vendor/react.dev',
            pluginMap = {
                'win' : 'empty:',
                'conf' : 'empty:',
                'jquery' : 'vendor/jquery.min',
                'vendor/rsvp' : 'vendor/rsvp.min',
                'vendor/react': reactModule,
                'SoundManager' : 'vendor/soundmanager2.min',
                'vendor/jscrollpane' : 'vendor/jscrollpane.min'
            },
            p,
            elms,
            jsElm;

        for (p in jsModules) {
            elms = doc.getElementsByTagName(p);
            if (elms[0]) {
                jsElm = elms[0].getElementsByTagName('js_module');
                pluginMap['plugins/' + jsModules[p]] = 'plugins/' + jsElm[0].textContent;

            } else {
                pluginMap['plugins/' + jsModules[p]] = 'empty:';
            }
        }
        return pluginMap;
    };

    /**
     * Configures a special module "vendor/common" which contains all the 3rd
     * party libs merged into a single file
     */
    module.exports.listVendorModules = function () {
        return [
            {
                'name': 'vendor/common',
                'include': [
                    'jquery',
                    'vendor/rsvp',
                    'vendor/react',
                    'vendor/Dispatcher',
                    'SoundManager',
                    'vendor/typeahead',
                    'vendor/bloodhound',
                    'vendor/jscrollpane'
                ]
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
        var ans = [];

        function isExcluded(p) {
            return ['document.js'].indexOf(p) > -1;
        }

        fs.readdirSync(tplDir).forEach(function (item) {
            var srch = /^(.+)\.js$/.exec(item);
            if (srch && !isExcluded(item)) {
                ans.push({
                    name: 'tpl/' + srch[1],
                    exclude: ['vendor/common'] // we do not want to include vendor stuff in page code
                });
            }
        });
        return ans;
    };

}(module));