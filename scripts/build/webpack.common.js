/*
 * Copyright (c) 2017 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import path from 'path';
import ProgressBarPlugin from 'progress-bar-webpack-plugin';
import * as kontext from './kontext.js';
import { PreparePlugin } from './plugins.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mkpath = (p) => path.resolve(__dirname, '../../public/files', p);

const JS_PATH = mkpath('js');
const CSS_PATH = mkpath('css');
const THEMES_PATH = mkpath('themes');
const CONF_DOC = kontext.loadKontextConf(path.resolve(__dirname, '../../conf/config.xml'));
const PUBLIC_PATH = kontext.findActionPathPrefix(CONF_DOC);
const DIST_PATH = mkpath('dist');

export default {
    JS_PATH: JS_PATH,
    CSS_PATH: CSS_PATH,
    THEMES_PATH: THEMES_PATH,
    CONF_DOC: CONF_DOC,
    PUBLIC_PATH: PUBLIC_PATH,
    DIST_PATH: DIST_PATH,
    wpConf: (env) => ({
        entry: {
            coll: mkpath('js/pages/coll.ts'),
            corplist: mkpath('js/pages/corplist.ts'),
            fcs: mkpath('js/pages/fcs.ts'),
            query: mkpath('js/pages/query.ts'),
            pquery: mkpath('js/pages/pquery.ts'),
            pqueryResult: mkpath('js/pages/pqueryResult.ts'),
            freq: mkpath('js/pages/freq.ts'),
            dispersion: mkpath('js/pages/dispersion.ts'),
            message: mkpath('js/pages/message.ts'),
            subcorpForm: mkpath('js/pages/subcorpForm.ts'),
            subcorpList: mkpath('js/pages/subcorpList.ts'),
            pubSubcorpList: mkpath('js/pages/pubSubcorpList.ts'),
            view: mkpath('js/pages/view.ts'),
            restoreConc: mkpath('js/pages/restoreConc.ts'),
            wordlist: mkpath('js/pages/wordlist.ts'),
            wordlistForm: mkpath('js/pages/wordlistForm.ts'),
            restoreWordlist: mkpath('js/pages/restoreWordlist.ts'),
            keywords: mkpath('js/pages/keywords.ts'),
            keywordsForm: mkpath('js/pages/keywordsForm.ts'),
            restoreKeywords: mkpath('js/pages/restoreKeywords.ts'),
            login: mkpath('js/pages/login.ts'),
            userProfile: mkpath('js/pages/userProfile.ts'),
            userSignUp: mkpath('js/pages/userSignUp.ts'),
            userTokenConfirm: mkpath('js/pages/userTokenConfirm.ts')
        },
        output: {
            filename: '[name].js',
            path: mkpath('dist'),
            libraryTarget: 'var',
            library: '[name]Page'

        },
        resolve: {
            alias: {}, // filled in dynamically
            modules: [
                mkpath('js/.compiled'),
                mkpath('js/plugins'),
                'node_modules'
            ],
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.less'],
            extensionAlias: {
                '.js': ['.ts', '.tsx', '.js', '.jsx'],
                '.mjs': ['.mts', '.mjs']
            }
        },
        module: {
            rules: [
                {
                    test: /\.(png|jpg|gif|svg)$/,
                    type: 'asset/resource'
                },
                {
                    test: /\.tsx?$/,
                    exclude: /(node_modules|bower_components)/,
                    use: {
                        loader: 'swc-loader',
                        options: {
                            jsc: {
                                parser: {
                                    syntax: 'typescript',
                                    tsx: true,
                                    decorators: false,
                                    dynamicImport: false
                                },
                                target: 'es2016'
                            },
                            module: {
                                type: 'es6'
                            }
                        }
                    }
                }
            ]
        },
        optimization: {
            splitChunks: {
                chunks: 'all',
                name: 'common'
            }
        },
        externals: [], // KonText build script adds things here (plug-ins' build.json conf)
        plugins: [
            new ProgressBarPlugin(),
            new PreparePlugin({
                confDoc: CONF_DOC,
                jsPath: JS_PATH,
                cssPath: CSS_PATH,
                themesPath: THEMES_PATH,
                isProduction: false
            })
        ]
    })
};
