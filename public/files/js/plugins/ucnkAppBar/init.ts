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

/// <reference path="../../../ts/declarations/jquery.d.ts" />
/// <reference path="../../../ts/declarations/common.d.ts" />

import $ = require('jquery');

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
        var self = this,
            promise = $.ajax(this.pluginApi.createActionUrl('user/ajax_get_toolbar'),
                {dataType : 'html'});

        promise.done(function(data, textStatus, jqXHR) {
            $('#common-bar').html(data);
        });

        promise.fail(function(jqXHR, textStatus, errorThrown) {
             self.pluginApi.showMessage("error", errorThrown); // TODO
        });
    };

    init(): void {
        $('#cnc-toolbar-user').find('a').each(function () {
            let href = $(this).attr('href');
            let hrefElms = href.split('?');
            let contSetting = 'continue=' + encodeURIComponent(window.location.href);
            $(this).attr('href', href + (hrefElms.length < 2 ? '?' : '&') + contSetting);
        });
    }
}

export function createInstance(pluginApi:Kontext.PluginApi) {
    var appBar = new AppBar(pluginApi);
    if ($('.appbar-loading-msg').data('reload-toolbar') == 1) {
        pluginApi.registerInitCallback({plugin: 'applicationBar', method: 'toolbarReloader'});

    } else {
        appBar.init();
    }
    return appBar;
}



