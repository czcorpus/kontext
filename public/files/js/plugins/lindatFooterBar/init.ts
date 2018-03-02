/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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

import RSVP from 'rsvp';
import {Kontext} from '../../types/common';
import {IPluginApi} from '../../types/plugins';

declare var require:any;
require('./style.less'); // webpack

export class FooterPlugin {

    constructor() {
    }

    init():void {
        // do the custom initialization (tracking/analytics script)
        console.log('FooterPlugin.init() finished');
    }
}

export default function create(pluginApi:IPluginApi):RSVP.Promise<FooterPlugin> {
    return new RSVP.Promise<FooterPlugin>((resolve:(d:FooterPlugin)=>void, reject:(e:any)=>void) => {
        let plugin = new FooterPlugin();
        plugin.init();
        resolve(plugin);
    });
}
