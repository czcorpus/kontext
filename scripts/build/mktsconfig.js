/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import * as kontext from './kontext.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mkpath = (p) => resolve(__dirname, '../../public/files', p);

const JS_PATH = mkpath('js');
const CSS_PATH = mkpath('css');
const CONF_DOC = kontext.loadKontextConf(resolve(__dirname, '../../conf/config.xml'));


const aliasesTmp = kontext.loadModulePathMap(CONF_DOC, JS_PATH, CSS_PATH, true);
const aliases = {};
Object.keys(aliasesTmp).forEach((k) => {
    aliases[k] = [aliasesTmp[k]];
});

const tsConfig = {
    compilerOptions: {
        baseUrl: ".",
        sourceMap: false,
        noImplicitAny: false,
        module: "node16",
        esModuleInterop: true,
        target: "esnext",
        jsx: "react-jsx",
        moduleResolution: "node16",
        paths: {}
    },
    include: [
        "./public/files/js/**/*"
    ],
    exclude: [
        "./node_modules"
    ]
};

tsConfig.compilerOptions.paths = aliases;
const tsPath = resolve(__dirname, '..', '..', '.tsconfig.tmp.json');
const outf = fs.openSync(tsPath, 'w');
fs.writeSync(outf, JSON.stringify(tsConfig, null, 2) + '\n');
