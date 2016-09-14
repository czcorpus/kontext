/*
 * Copyright (c) 2014 Institute of the Czech National Corpus
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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../../ts/declarations/jquery.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />

import * as $ from 'jquery';
import * as RSVP from 'vendor/rsvp';


/**
 *
 */
export class AppBar implements Kontext.Plugin {

    pluginApi:Kontext.PluginApi;

    constructor(pluginApi:Kontext.PluginApi) {
        this.pluginApi = pluginApi;
    }

    /**
     *
     */
    toolbarReloader = () => {
        this.pluginApi.ajax<string>(
            'GET',
            this.pluginApi.createActionUrl('user/ajax_get_toolbar'),
            {}

        ).then(
            (data) => {
                $('#common-bar').html(data);
            },
            (err) => {
                this.pluginApi.showMessage('error', err);
        });
    };

    init():void {
        $('#cnc-toolbar-user').find('a').each(function () {
            let href = $(this).attr('href');
            let hrefElms = href.split('?');
            let contSetting = 'continue=' + encodeURIComponent(window.location.href);
            $(this).attr('href', href + (hrefElms.length < 2 ? '?' : '&') + contSetting);
        });
    }
}

export function create(pluginApi:Kontext.PluginApi):RSVP.Promise<Kontext.Plugin> {
    return new RSVP.Promise((resolve:(ans:Kontext.Plugin)=>void, reject:(e:any)=>void) => {
        let appBar = new AppBar(pluginApi);
        appBar.init();
        resolve(appBar);
    });
}



