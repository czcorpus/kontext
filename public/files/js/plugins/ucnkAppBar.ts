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

/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../../ts/declarations/document.d.ts" />
/// <reference path="../../ts/declarations/dynamic.d.ts" />

import model = require('tpl/document');

export class AppBar implements model.Plugin {

    pluginApi:model.PluginApi;

    constructor(pluginApi:model.PluginApi) {
        this.pluginApi = pluginApi;
    }

    /**
     *
     */
    toolbarReloader(): void {
        var self = this,
            promise = $.ajax(this.pluginApi.conf('rootURL') + 'ajax_get_toolbar', {dataType : 'html'});

        promise.done(function(data, textStatus, jqXHR) {
            $('#common-bar').html(data);
        });

        promise.fail(function(jqXHR, textStatus, errorThrown) {
             self.pluginApi.showMessage(model.MsgType.error, errorThrown); // TODO
        });
    }

    /**
     */
    init(): void {
        var code,
            ans:boolean;

        try {
            code = JSON.parse($('#cnc-toolbar-data').text());
            if (!this.pluginApi.userIsAnonymous() && !code['id']) {
                ans = confirm(this.pluginApi.translate('you have been logged out'));

                if (ans === true) {
                    window.location = this.pluginApi.conf('loginUrl');

                } else {
                    this.pluginApi.resetToHomepage({remote: 1});
                }

            } else if (this.pluginApi.userIsAnonymous() && typeof code['id'] === 'number') {
                this.pluginApi.resetToHomepage({remote: 1});
            }

        } catch (e) {
            console.error(e);
        }
    }
}

export function createInstance(pluginApi:model.PluginApi) {
    var appBar = new AppBar(pluginApi);
    appBar.init();
    return appBar;
}



