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
        $.each(data.data, function () {
            var href = 'first_form?corpname=' + this.corpname
                + '&' + this.query_type + '=' + encodeURIComponent(this.query)
                + '&queryselector=' + this.query_type + 'row';

            if (this.subcorpname) {
                href += '&usesubcorp=' + this.subcorpname;
            }
            $('table.query-history .expand-line').before('<tr class="data-item">'
                + '<td class="query">' + this.query + '</td>'
                + '<td class="corpname">' + this.humanCorpname + '</td>'
                + '<td class="corpname">' + this.subcorpname + '</td>'
                + '<td>' + this.query_type_translated + '</td>'
                + '<td class="date">' + this.created[1] + ' <strong>' + this.created[0] + '</strong></td>'
                + '<td><a href="' + href + '">' + layoutModel.translate('use_query') + '</a></td>'
                );
        });
    }

    function getAjaxParams() {
        var params = [],
            form = $('.query-history-filter'),
            queryType = form.find('select[name=\'query_type\']').val();

        if (form.find('input[name=\'current_corpus\']:checked').length > 0) {
            params.push('current_corpus=1');
        }
        if (queryType) {
            params.push('query_type=' + encodeURIComponent(queryType));
        }
        params.push('offset=' + calcCurrNumberRows());
        params.push('limit=' + lib.conf.page.page_append_records);
        return params.join('&');
    }

    function dynamizeFormControls() {
        var form = $('.query-history-filter');

        form.find('button[type=\'submit\']').remove();
        form.find('input[name=\'current_corpus\']').on('click', function () {
            $(this).closest('form').submit();
        });
        form.find('select[name=\'query_type\']').on('change', function () {
            $(this).closest('form').submit();
        });
    }

    function addExpandLink() {
        $('table.query-history').append('<tr class="expand-line"><td colspan="6"><a class="expand-list">'
            + layoutModel.translate('Load more') + '</a></td></tr>');

        $('table.query-history').find('a.expand-list').on('click', function () {
            var prom,
                linkElm,
                actionCell = $('table.query-history .expand-line td'),
                loaderImg;

            prom = $.ajax('ajax_query_history?' + getAjaxParams(), {
                dataType : 'json'
            }).promise();

            linkElm = actionCell.find('a').detach();
            loaderImg = layoutModel.appendLoader(actionCell);

            function cleanUpLoader(fn) {
                loaderImg.remove();
                if (typeof fn === 'function') {
                    fn();
                    win.setTimeout(function () {
                        actionCell.empty().append(linkElm);
                    }, 1000);

                } else {
                    actionCell.append(linkElm);
                }
            }

            prom.then(
                function (data) {
                    if (data.hasOwnProperty('error')) {
                        cleanUpLoader();
                        lib.pluginApi.showMessage('error', data.error);

                    } else {
                        if (data.data.length > 0) {
                            cleanUpLoader();

                        } else {
                            cleanUpLoader(function () {
                                actionCell.append('[' + layoutModel.translate('No more lines') + ']');
                            });
                        }
                        appendData(data);
                    }
                },
                function (err) {
                    cleanUpLoader();
                    lib.pluginApi.showMessage('error', err.statusText);
                }
            );
        });
    }

    lib.init = function (conf) {
        layoutModel.init(conf);
        lib.conf = conf;
        addExpandLink();
        dynamizeFormControls();
    };

    return lib;
});