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

const webpack = require('webpack');
const path = require('path');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');

const extractLess = new ExtractTextPlugin({
    filename: '[name].css'
});

const mkpath = (p) => path.resolve(__dirname, '../../public/files', p);

module.exports = (env) => {

    return {
        entry: {
            coll: mkpath('js/pages/coll.ts'),
            corplist: mkpath('js/pages/corplist.ts'),
            fcs: mkpath('js/pages/fcs.ts'),
            firstForm: mkpath('js/pages/firstForm.ts'),
            freq: mkpath('js/pages/freq.ts'),
            message: mkpath('js/pages/message.ts'),
            queryHistory: mkpath('js/pages/queryHistory.ts'),
            subcorpForm: mkpath('js/pages/subcorpForm.ts'),
            subcorpList: mkpath('js/pages/subcorpList.ts'),
            view: mkpath('js/pages/view.ts'),
            wordlist: mkpath('js/pages/wordlist.ts'),
            wordlistForm: mkpath('js/pages/wordlistForm.ts'),
            login: mkpath('js/pages/login.ts'),
            userProfile: mkpath('js/pages/userProfile.ts')
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
                    test: /\.css$/,
                    use: extractLess.extract(['css-loader'])
                },
                {
                    test: /\.less$/,
                    use: extractLess.extract(['css-loader', 'less-loader']),
                },
                {
                    test: /\.(png|jpg|gif|svg)$/,
                    use: [
                        {
                            loader: 'file-loader',
                            options: {
                                emitFile: false,
                                name: '../img/[name].[ext]'
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
        externals: [], // KonText build script adds things here (plug-ins' build.json conf)
        plugins: [
            new webpack.optimize.CommonsChunkPlugin({
                name: 'common',
                filename: 'common.js'
            }),
            extractLess,
            new ProgressBarPlugin()
        ]
    }
};
