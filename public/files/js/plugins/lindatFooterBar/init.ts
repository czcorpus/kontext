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

/// <reference path="../../../ts/declarations/abstract-plugins.d.ts" />
/// <reference path="../../../ts/declarations/common.d.ts" />

import RSVP = require('vendor/rsvp');

class FooterPlugin implements Kontext.Plugin {
    
    constructor() {        
    }
    
    init():void {
        // do the custom initialization (tracking/analytics script)
        console.log('FooterPlugin.init() finished');
    }
}

export function create(pluginApi:Kontext.PluginApi):RSVP.Promise<Kontext.Plugin> {
    return new RSVP.Promise<Kontext.Plugin>((resolve:(d:any)=>void, reject:(e:any)=>void) => {
        let plugin = new FooterPlugin();  
        plugin.init();      
        resolve(plugin);    
    });
}
