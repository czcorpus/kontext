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
const common = require('./scripts/build/webpack.common.js');
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
            }
        ]
    },
    devServer: {
        /* for NFS etc. use:
        watchOptions: {
           poll: true
        },
        */
        allowedHosts: ['localhost', 'kontext.korpus.test'],
        port: process.env.DEV_SERVER_PORT || 9000,
        host: process.env.DEV_SERVER_HOST || 'localhost',
        static: {
            directory: path.resolve(__dirname, "../../public/files/dist"),
            publicPath: (process.env.DEV_PUBLIC_PATH === undefined ? common.PUBLIC_PATH : process.env.DEV_PUBLIC_PATH)
        },
        client: {
              webSocketURL: 'ws://localhost:8084/wds-ws',
        },
        liveReload: false,
        setupMiddlewares: (middlewares, devServer) => {
            if (!devServer) {
                throw new Error('webpack-dev-server is not defined');
            }
            const cssPath = (process.env.DEV_PUBLIC_PATH === undefined ? common.PUBLIC_PATH : process.env.DEV_PUBLIC_PATH) + '/*.css';
            middlewares.push({
                name: 'css-handler',
                middleware: (req, res, next) => {
                    if (req.url.match(cssPath)) {
                        res.set('Content-Type', 'text/css');
                        res.send('');
                    } else {
                        next();
                    }
                }
            });
            return middlewares;
        }
    },
    devtool: "inline-source-map",
    target: ['web', 'es5']
});