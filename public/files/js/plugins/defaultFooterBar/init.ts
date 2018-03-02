/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../../types/plugins.d.ts" />

import RSVP from 'rsvp';
import {IPluginApi} from '../../types/plugins';
import {Kontext} from '../../types/common';

declare var require:any;
require('./style.less'); // webpack

export class FooterPlugin {
}

export default function create(pluginApi:IPluginApi):RSVP.Promise<FooterPlugin> {
    return new RSVP.Promise<FooterPlugin>((resolve:(d:any)=>void, reject:(e:any)=>void) => {
        resolve(new FooterPlugin());
    });
}