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
define(['jquery', 'tpl/document', 'popupbox'], function ($, layoutModel, popupBox) {
    'use strict';

    var lib = {},
        createUndeleteActionSettings;


    /**
     * This function creates settings for jQuery.ajax() call to undelete query history item.
     *
     * @param queryId
     * @returns {{type: string, dataType: string, data: {query_id: *}, success: Function, error: Function}}
     */
    createUndeleteActionSettings = function (queryId) {
        return {
            type: 'POST',
            dataType: 'json',
            data: {
                query_id: queryId
            },
            success: function (data) {
                if (!data.error) {
                    $('#removed-query-history-item').replaceWith(data.html);
                    lib.bindEvents($('div.query-history-item[data-query-id="' + queryId + '"]'));
                    layoutModel.showMessage('info', layoutModel.conf.messages.undeleted_query);

                } else {
                    layoutModel.showMessage('error', layoutModel.conf.messages.failed_to_undelete_the_query);
                }
            },
            error: function () {
                layoutModel.showMessage('error', layoutModel.conf.messages.failed_to_undelete_the_query);
            }
        };
    };

    /**
     * @param {optional string} selector to specify elements to apply event handlers to
     */
    lib.bindEvents = function (selector) {
        var jqElem;

        if (selector) {
            jqElem = $(selector);

        } else {
            jqElem = $('.query-history-item .delete');
        }
        jqElem.on('click', function (event) {
            var queryId,
                undoUrl = '#',
                infoMessage,
                bindUndeleteAction;


            queryId = $(event.target).closest('.query-history-item').data('query-id');
            infoMessage = layoutModel.conf.messages.deleted_query
                            + ' <a id="undo-delete-query-desc" href="' + undoUrl + '">' + layoutModel.conf.messages.undo + '</a>';

            bindUndeleteAction = function () {
                $('#undo-delete-query-desc').on('click', function () {
                    $.ajax('ajax_undelete_query', createUndeleteActionSettings(queryId));
                });
            };

            $.ajax('ajax_delete_query', {
                type: 'POST',
                dataType: 'json',
                data: {
                    query_id: queryId
                },
                success : function (data) {
                    if (!data.error) {
                        layoutModel.showMessage('info', infoMessage, bindUndeleteAction);
                        $('#removed-query-history-item').remove();
                        $(event.target).closest('.query-history-item').replaceWith('<div id="removed-query-history-item"></div>');

                    } else {
                        layoutModel.showMessage('error', layoutModel.conf.messages.failed_to_delete_the_query);
                    }

                },
                error: function () {
                    layoutModel.showMessage('error', layoutModel.conf.messages.failed_to_delete_the_query);
                }
            });
        });
    };

    lib.setupQueryOverviewLinks = function () {
        $('.query-history .link a').each(function () {
            var self = this;
            $(this).attr('data-json-href', $(this).attr('href').replace('/concdesc?', '/concdesc_json?'));

            popupBox.bind(this,
                function (box, finalize) {
                    $.ajax($(self).data('json-href'), {
                        success: function (data) {
                            layoutModel.renderOverview(data, box);
                            finalize();
                            box.setCss('left', '0');
                        }
                    });
                },
                {
                    type: 'plain',
                    htmlClass: 'query-overview',
                    closeIcon: true,
                    timeout: null
                }
            );
        });
    };

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        layoutModel.init(conf);
        lib.bindEvents();
        lib.setupQueryOverviewLinks();
    };

    return lib;
});