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
 * This module contains functionality related directly to the query_history.tmpl template
 *
 */
define(['jquery', 'tpl/document', 'win'], function ($, layoutModel, win) {
    'use strict';

    var lib = {};

    function calcCurrNumberRows() {
        return $('table.query-history tr.data-item').length;
    }

    function appendData(data) {
        $.each(data.data, function (i, item) {
            $('table.query-history .expand-line').before('<tr class="data-item">'
                + '<td class="query">' + item.query + '</td>'
                + '<td class="corpname">' + item.humanCorpname + '</td>'
                + '<td class="corpname">' + item.subcorpname + '</td>'
                + '<td>' + item.query_type + '</td>'
                + '<td class="date">' + item.created[1] + ' <strong>' + item.created[0] + '</strong></td>'
                + '<td><a>' + layoutModel.translate('use_query') + '</a></td>'

            );
        });
    }

    lib.init = function (conf) {
        layoutModel.init(conf);

        $('table.query-history').append('<tr class="expand-line"><td colspan="6"><a class="expand-list">' + 'load more' + '</a></td></tr>');

        $('table.query-history').find('a.expand-list').on('click', function () {
            var prom;

            prom = $.ajax('ajax_query_history?offset=' + calcCurrNumberRows() + '&limit=' + conf.page.page_append_records, {
                dataType : 'json'
            }).promise();

            prom.then(
                function (data) {
                    if (data.hasOwnProperty('error')) {
                        lib.pluginApi.showMessage('error', data.error);
                        // TODO

                    } else {
                        appendData(data);
                    }
                },
                function (err) {
                    lib.pluginApi.showMessage('error', err.statusText);
                }
            );
        });
    };

    return lib;
});