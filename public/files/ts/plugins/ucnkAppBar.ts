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

/// <reference path="../declarations/jquery.d.ts" />
/// <reference path="../../ts/declarations/document.d.ts" />


export class AppBar implements Model.Plugin {

    /**
     *
     */
    toolbarReloader(): void {
        var promise = $.ajax(conf['rootURL'] + 'ajax_get_toolbar', {dataType : 'html'});

        promise.done(function(data, textStatus, jqXHR) {
            $('#common-bar').html(data);
        });

        promise.fail(function(jqXHR, textStatus, errorThrown) {
             layoutModel.showMessage(Model.MsgType.error, errorThrown); // TODO
        });
    }

    /**
     *
     * @param pluginApi
     */
    init(pluginApi:Model.PluginApi): void {
        var code,
            ans:boolean;

        try {
            code = JSON.parse($('#cnc-toolbar-data').text());
            if (!pluginApi.userIsAnonymous() && !code['id']) {
                ans = confirm(pluginApi.translate('you have been logged out'));

                if (ans === true) {
                    win.location = pluginApi.conf('loginUrl');

                } else {
                    pluginApi.resetToHomepage({remote: 1});
                }

            } else if (pluginApi.userIsAnonymous() && typeof code['id'] === 'number') {
                pluginApi.resetToHomepage({remote: 1});
            }

        } catch (e) {
            console.error(e);
        }
    }
}



