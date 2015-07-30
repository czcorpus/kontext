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
define(['win', 'jquery', 'vendor/jquery.periodic', 'tpl/document', 'popupbox'], function (win,
        $, jqueryPeriodic, documentModule, popupBox) {
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

    /**
     *
     */
    lib.setupContextHelp = function (message) {
        popupBox.bind($('#progress_message a.context-help'), message, {width: 'nice'});
    };

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        lib.layoutModel = new documentModule.PageModel(conf);
        lib.layoutModel.init();
        lib.setupContextHelp(lib.layoutModel.translate('global__wl_calc_info');
        lib.startWatching = function () {
            lib.updateProcessBar(lib.layoutModel.conf.corpnameUrl, lib.layoutModel.conf.subcName,
                lib.layoutModel.conf.attrName, lib.layoutModel.conf.reloadUrl);
        };
    };

    return lib;
});