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
define(['jquery', 'tpl/document'], function ($, mainPage) {
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
                    lib.bindEvents($('div[class="query-history-item"][data-query-id="' + queryId + '"]'));
                    mainPage.showMessage(mainPage.conf.messages.undeleted_query);

                } else {
                    mainPage.showErrorMessage(mainPage.conf.messages.failed_to_undelete_the_query);
                }
            },
            error: function () {
                mainPage.showErrorMessage(mainPage.conf.messages.failed_to_undelete_the_query);
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
            infoMessage = mainPage.conf.messages.deleted_query
                            + ' <a id="undo-delete-query-desc" href="' + undoUrl + '">' + mainPage.conf.messages.undo + '</a>';

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
                        mainPage.showMessage(infoMessage, bindUndeleteAction);
                        $('#removed-query-history-item').remove();
                        $(event.target).closest('.query-history-item').replaceWith('<div id="removed-query-history-item"></div>');

                    } else {
                        mainPage.showErrorMessage(mainPage.conf.messages.failed_to_delete_the_query);
                    }

                },
                error: function () {
                    mainPage.showErrorMessage(mainPage.conf.messages.failed_to_delete_the_query);
                }
            });
        });
    };

    lib.init = function (conf) {
        mainPage.init(conf);
        lib.bindEvents();
    };

    return lib;
});