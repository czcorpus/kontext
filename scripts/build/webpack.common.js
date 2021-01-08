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

const path = require('path');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const kontext = require('./kontext');
const kplugins = require('./plugins');

const mkpath = (p) => path.resolve(__dirname, '../../public/files', p);

const JS_PATH = mkpath('js');
const CSS_PATH = mkpath('css');
const THEMES_PATH = mkpath('themes');
const CONF_DOC = kontext.loadKontextConf(path.resolve(__dirname, '../../conf/config.xml'));
const PUBLIC_PATH = kontext.findActionPathPrefix(CONF_DOC);
const STATIC_FILES_PATH = kontext.findStaticPathPrefix(CONF_DOC);
const DIST_PATH = mkpath('dist');

module.exports = {
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
            freq: mkpath('js/pages/freq.ts'),
            message: mkpath('js/pages/message.ts'),
            subcorpForm: mkpath('js/pages/subcorpForm.ts'),
            subcorpList: mkpath('js/pages/subcorpList.ts'),
            pubSubcorpList: mkpath('js/pages/pubSubcorpList.ts'),
            view: mkpath('js/pages/view.ts'),
            restoreConc: mkpath('js/pages/restoreConc.ts'),
            wordlist: mkpath('js/pages/wordlist.ts'),
            wordlistForm: mkpath('js/pages/wordlistForm.ts'),
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
                'node_modules'
            ],
            extensions: ['.webpack.js', '.web.js', '.ts', '.tsx', '.jsx', '.js', '.json', '.css', '.less']
        },
        module: {
            rules: [
                {
                    test: /\.(png|jpg|gif|svg)$/,
                    use: [
                        {
                            loader: 'file-loader',
                            options: {
                                emitFile: false,
                                name: '[name].[ext]',
                                publicPath: STATIC_FILES_PATH + '/img',
                            }
                        }
                    ]
                },
                {
                    test: /\.tsx?$/,
                    use: [
                        {
                            loader: 'ts-loader',
                            options: {
                                transpileOnly: env ? !!env.TS_TRANSPILE_ONLY : false
                            }
                        }
                    ]
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
            new kplugins.PreparePlugin({
                confDoc: CONF_DOC,
                jsPath: JS_PATH,
                cssPath: CSS_PATH,
                themesPath: THEMES_PATH,
                isProduction: false
            })
        ]
    })
};
