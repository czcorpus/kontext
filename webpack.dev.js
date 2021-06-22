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

const { merge } = require('webpack-merge');
const common = require('./scripts/build/webpack.common');
const path = require('path');

module.exports = (env) => merge(common.wpConf(env), {
    mode: 'development',
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    { loader: 'style-loader'},
                    { loader: 'css-loader' }
                ]
            },
            {
                test: /\.less$/,
                use: [
                    { loader: 'style-loader'},
                    { loader: 'css-loader' },
                    {
                        loader: 'less-loader',
                        options: {
                            lessOptions: {
                                strictMath: true,
                                noIeCompat: true
                            }
                        }
                    }
                ]
            },
        ]
    },
    devServer: {
        /* for NFS etc. use:
        watchOptions: {
           poll: true
        },
        */
        contentBase: path.resolve(__dirname, "../../public/files/dist"),
        compress: true,
        port: process.env.DEV_SERVER_PORT || 9000,
        host: process.env.DEV_SERVER_HOST || 'localhost',
        public: 'kontext6.korpus.test',
        publicPath: common.PUBLIC_PATH + '/files/dist/',
        inline: false,
        sockPath: common.PUBLIC_PATH + '/socket',
        serveIndex: true,
        liveReload: false,
        disableHostCheck: true, // TODO
        before: function(app) {
            // In the devel-server mode, all the css is delivered via Webpack
            // but at the same time our hardcoded <link rel="stylesheet" ... />
            // elements cause browser to load non-available styles.
            // So we always return an empty stuff with proper content type.
            app.get(common.PUBLIC_PATH + '/files/dist/*.css', function(req, res) {
                res.set('Content-Type', 'text/css');
                res.send('');
            });
          }
    },
    devtool: "inline-source-map",
    target: ['web', 'es5']
});