/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

(function (module) {

const path = require('path');
const fs = require('fs');
const kontext = require('./kontext');

/**
 * PreparePlugin configures dynamically Webpack's compiler object
 * based on KonText config.xml configuration and enabled plug-ins'
 * build.json config files. The result is a defined set of aliases
 * and externals.
 *
 * @param {*} options
 */
class PreparePlugin {

    constructor(options) {
        this._confDoc = options.confDoc;
        this._jsPath = options.jsPath;
        this._cssPath = options.cssPath;
        this._themesPath = options.themesPath;
        this._isProduction = options.isProduction;
    }


    apply(compiler) {
        compiler.hooks.afterPlugins.tap('PreparePlugin', (compilation) => {
            const tmpJsDir = path.resolve(this._jsPath, '.compiled');
            if (fs.existsSync(tmpJsDir)) {
                fs.readdirSync(tmpJsDir).forEach(item => {
                    fs.unlinkSync(path.resolve(tmpJsDir, item));
                });
                fs.rmdirSync(tmpJsDir);
            }
            fs.mkdirSync(tmpJsDir);

            compiler.options.resolve.alias = kontext.loadModulePathMap(this._confDoc, this._jsPath, this._cssPath);
            console.log("\x1b[44m", 'Defined aliases:', "\x1b[0m");
            Object.keys(compiler.options.resolve.alias).forEach(item => {
                console.log("\x1b[32m", item, "\x1b[0m", '\u21D2', compiler.options.resolve.alias[item]);
            });
            console.log("\x1b[44m", 'Defined external modules:', "\x1b[0m");
            const externals = kontext.findPluginExternalModules(this._confDoc, this._jsPath);
            externals.forEach(item => {
                compiler.options.externals.push({[item[0]]: item[1]});
            });
            externals.forEach(item => {
                console.log("\x1b[32m", item[0], "\x1b[0m", '\u21D2', item[1]);
            });
        });
    }
}

module.exports.PreparePlugin = PreparePlugin;

})(module);
