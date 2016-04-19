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

/// <reference path="../../../ts/declarations/jquery.d.ts" />
/// <reference path="../../../ts/declarations/common.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />
/// <reference path="../../../ts/declarations/abstract-plugins.d.ts" />

import $ = require('jquery');
import RSVP = require('vendor/rsvp');
import toolbar = require('plugins/applicationBar/toolbar');

/**
 *
 */
export class AppBar implements Kontext.Plugin {

    pluginApi:Kontext.PluginApi;

    constructor(pluginApi:Kontext.PluginApi) {
        this.pluginApi = pluginApi;
    }

    init(): void {
    }

    openLoginDialog():void {
        toolbar.openLoginDialog();
    }
}

export function create(pluginApi:Kontext.PluginApi):RSVP.Promise<Kontext.Plugin> {
    return new RSVP.Promise((resolve:(ans:Kontext.Plugin)=>void, reject:(e:any)=>void) => {
       var appBar = new AppBar(pluginApi);
        if ($('.appbar-loading-msg').data('reload-toolbar') == 1) {
            pluginApi.registerInitCallback({plugin: 'applicationBar', method: 'toolbarReloader'});

        } else {
            appBar.init();
        }
        resolve(appBar);
    });
}



