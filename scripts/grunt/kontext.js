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
        jsModules = {
            'application_bar' : 'applicationBar',
            'query_storage' : 'queryStorage',
            'live_attributes' : 'liveAttributes'
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
    module.exports.loadPluginMap = function (confPath) {
        var data = fs.readFileSync(confPath, {encoding: 'utf8'}),
            DOMParser = require('xmldom').DOMParser,
            doc = new DOMParser().parseFromString(data),
            pluginMap = {
                'win' : 'empty:',
                'conf' : 'empty:',
                'jquery' : 'empty:',
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
            }
        };
        return pluginMap;
    };

    /**
     * Generates a list of modules representing models of individual pages.
     *
     * @param {string} path to a directory where models reside
     * @return Array<string>
     */
    module.exports.listPageModules = function (tplDir) {
        var ans = [];            

        function isExcluded(p) {
            return ['document.js'].indexOf(p) > -1;
        }

        fs.readdir(tplDir, function (err, listDir) {
            listDir.forEach(function (item) {
                var srch = /^(.+)\.js$/.exec(item);
                if (srch && !isExcluded(item)) {
                    ans.push({name: 'tpl/' + srch[1]});
                }
            });
        });
        return ans;
    };

}(module));