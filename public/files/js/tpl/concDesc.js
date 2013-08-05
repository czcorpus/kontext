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
 * This module contains functionality related directly to the concdesc.tmpl template
 *
 */
define(['jquery', 'tpl/document', 'win'], function ($, mainPage, win) {
    'use strict';

    var lib = {};

    /**
     *
     */
    lib.bindEvents = function () {
        $('#query-desc-view').on('click', function () {
            $('#query-desc-view').css('display', 'none');
            $('#query-desc-editor').css('display', 'block');
            $('#query-desc-editor textarea').focus();
        });

        $('#exit-editation').on('click', function () {
            $('#query-desc-view').css('display', 'block').html($('#query-desc-editor textarea').val());
            lib.saveQuery();
            $('#query-desc-editor').css('display', 'none');
        });

        $('input[name="export-url"]').on('focus', function (event) {
            $(event.target).select();
        });
    };

    /**
     *
     */
    lib.saveQuery = function () {
        var description = $('#query-desc-editor textarea').val();
        $('#query-desc-view').css('display', 'block').html('<img src="../files/img/ajax-loader.gif" style="display: block; width: 24px; height: 24px; margin: 50px auto;" />');

        $.ajax({
            url: 'ajax_save_query?corpname=' + mainPage.conf.corpname + '&query_id=' + mainPage.conf.queryId,
            type: 'POST',
            data: {
                description : description,
                url: win.location.href,
                'public': $('#public-flag-checkbox').is(':checked') ? 1 : 0
            },
            dataType: 'json',
            success: function (data) {
                if (!data.error) {
                    mainPage.conf.queryId = data.queryId;
                    $('#query-desc-view').css('display', 'block').html(data.rawHtml);

                } else {
                    mainPage.showErrorMessage(mainPage.conf.messages.failed_to_save_the_query);
                    $('#query-desc-view').empty();
                }
            },
            error : function () {
                mainPage.showErrorMessage(mainPage.conf.messages.failed_to_save_the_query);
                $('#query-desc-view').empty();
            }
        });
    };

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        mainPage.init(conf);
        lib.bindEvents();
    };

    return lib;
});