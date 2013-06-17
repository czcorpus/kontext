/*
 * Copyright (c) 2013 Institute of the Czech National Corpus
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

/**
 * This module contains functionality related directly to the wordlist.tmpl template
 */
define(['win', 'jquery', 'jquery.periodic', 'tpl/document'], function (win, $, jqueryPeriodic, documentPage) {
    'use strict';

    var lib = {};

    /**
     *
     * @param corpNameUrl
     * @param subcName
     * @param attrName
     * @param reloadUrl
     */
    lib.updateProcessBar = function (corpNameUrl, subcName, attrName, reloadUrl) {
        var params = corpNameUrl + '&amp;usesubcorp=' + subcName + '&amp;attrname=' + attrName;

        jqueryPeriodic({ period: 1000, decay: 1.2, max_period: 60000 }, function () {
            $.ajax({
                url : 'wordlist_process',
                data : params,
                method : 'get',
                complete : function (request) {
                    $('#processbar').css('width', request.responseText);
                    if (request.responseText === '100%') {
                        win.location = reloadUrl;
                    }
                }
            });
        });
    };

    lib.init = function (conf) {
        documentPage.init(conf);
        lib.startWatching = function () {
            lib.updateProcessBar(conf.corpnameUrl, conf.subcName, conf.attrName, conf.reloadUrl);
        };
    };

    return lib;
});