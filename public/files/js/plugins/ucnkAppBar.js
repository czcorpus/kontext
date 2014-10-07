/*
 * Copyright (c) 2013 Institute of the Czech National Corpus
 * Copyright (c) 2003-2009  Pavel Rychly
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

define(['jquery', 'conf', 'tpl/document', 'win'], function ($, conf, layoutModel, win) {
    'use strict';

    var lib = {};


    lib.toolbarReloader = function () {
        var promise = $.ajax(conf.rootURL + 'ajax_get_toolbar', {dataType : 'html'});

        promise.done(function(data, textStatus, jqXHR) {
            $('#common-bar').html(data);
        });

        promise.fail(function(jqXHR, textStatus, errorThrown) {
             layoutModel.showMessage('error', errorThrown); // TODO
        });
    };

    lib.init = function (pluginApi) {
        var code,
            ans;

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
    };

    return lib;
});