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

/**
 * This module contains functionality related directly to the concdesc.tmpl template
 *
 */
define(['jquery', 'tpl/document'], function ($, mainPage) {
    'use strict';

    var lib = {};

    /**
     *
     */
    lib.bindEvents = function () {
        $('#query-desc-view').on('click', function () {
            $('#query-desc-view').css('display', 'none');
            $('#query-desc-editor').css('display', 'block');
        });

        $('#exit-editation').on('click', function () {
            $('#query-desc-view').css('display', 'block').html($('#query-desc-editor textarea').val());
            lib.saveQuery();
            $('#query-desc-editor').css('display', 'none');
        });
    };

    /**
     *
     */
    lib.saveQuery = function () {
        var query = 'foo and bar',
            description = $('#query-desc-editor textarea').val();

        $.ajax({
            url: 'ajax_save_query',
            type: 'POST',
            data: {query : query, description : description},
            complete: function (data) {
                $('#query-desc-view').css('display', 'block').html(data.responseText);
            },
            error : function () {
                lib.showErrorMessage(translatMessages.failed_to_save_the_query);
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