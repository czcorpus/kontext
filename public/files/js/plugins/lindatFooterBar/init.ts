/*
 * Copyright (c) 2016 Department of Linguistics
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

import * as PluginInterfaces from '../../types/plugins/index.js';

declare var require:any;
require('./style.css'); // webpack

export class FooterPlugin {

    isActive():boolean {
        return true;
    }

    init():void {
        // do the custom initialization (tracking/analytics script)
        console.log('FooterPlugin.init() finished');
    }
}

const create:PluginInterfaces.FooterBar.Factory = (pluginApi) => {
    const plugin = new FooterPlugin();
    plugin.init();
    return plugin;
}

export default create;