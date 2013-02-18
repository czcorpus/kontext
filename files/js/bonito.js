/*
 * Copyright (c) 2003-2009 Pavel Rychly
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

define(['jquery', 'win', 'jquery.cookies'], function ($, win, cookies) {
    'use strict';

    var lib = {};

    /**
     *
     * @param cookiename
     * @return {String}
     */
    lib.getCookieValue = function (cookiename) {
        var allcookies = win.document.cookie,
            pos = allcookies.indexOf(cookiename + "="),
            start,
            end;

        if (pos !== -1) {
            start = pos + cookiename.length + 1;
            end = allcookies.indexOf(";", start);
            if (end === -1) {
                end = allcookies.length;
            }
            return allcookies.substring(start, end);
        }
        return ".";
    };

    /**
     * This objects serves as a service object for "multi-level KWIC HTML form".
     * It in fact fixes some flaws of original bonito2 application without massive rewriting of
     * related HTML templates and controller logic.
     */
    lib.multiLevelKwicFormUtil = {

        /**
         *
         * @param element a Prototype Element object
         * @return {String}
         */
        getColumnId : function (element) {
            return $(element).attr('id').substr($(element).attr('id').length - 1, 1);
        },

        /**
         * Initializes "KWIC alignment" select-box event handlers and sets form values according to the state
         * of these select-boxes.
         */
        init : function () {
            var mlkfu = lib.multiLevelKwicFormUtil;
            $('#kwic-alignment-box').css({ display : 'table-row' });
            $('select.kwic-alignment').each(function () {
                mlkfu.switchAlignment($(this).val(), mlkfu.getColumnId(this));
            });
            $('select.kwic-alignment').each(function () {
                $(this).bind('change', function (event) {
                    mlkfu.switchAlignment($(event.target).val(), mlkfu.getColumnId(this));
                });
            });
        },

        /**
         *
         * @param state one of {left, right}
         * @param columnIdx column to update (indexing from 1 to 3)
         */
        switchAlignment : function (state, columnIdx) {
            var srch, repl, select;

            if (state === 'left') {
                srch = '>';
                repl = '<';

            } else {
                srch = '<';
                repl = '>';
            }
            select = $("select[name='ml" + columnIdx + "ctx']");
            if (select.length === 1) {
                select.first().children().each(function () {
                    if ($(this).val() === '0~0>0') {
                        // This resets the default behaviour which just displays all the KWIC words.
                        // It should be executed only when the page is loaded.
                        $(this).val('0<0');

                    } else {
                        $(this).val($(this).val().replace(srch, repl));
                    }
                });
            }
        }
    };

    /**
     * toggle show / hide and update cookie
     * @param id
     * @param status
     */
    lib.toggleViewStore = function (id, status) {
        var exp = new Date(),
            opts;

        exp.setDate(exp.getDate() + 1); // expires in 1 day
        opts = { domain: '', path: '/', expiresAt: exp, secure: false };
        if ($('#' + id).is(':visible') || status === ':hidden') { // toggle visible and hidden
            cookies.set(id + '_view', 'hide', opts);
            $('#' + id).hide();
        }
        else if ($('#' + id).is(':hidden') || status === ':visible') {
            cookies.set(id + '_view', 'show', opts);
            $('#' + id).show();
        }
    };

    /**
     * Returns position (in number of characters) of cursor in a text input
     *
     * @param {Element|jQuery} inputElm
     * @return {number} position of cursor (starting from zero)
     */
    lib.getCaretPosition = function (inputElm) {
        var range,
            jqInputElm;

        if (inputElm instanceof jQuery) {
            jqInputElm = inputElm;
            inputElm = inputElm.get(0);

        } else {
            jqInputElm = $(inputElm);
        }
        if (window.getSelection) {
            jqInputElm.focus();
            return inputElm.selectionStart;

        } else if (document.selection) { // < IE9
            jqInputElm.focus();
            range = document.selection.createRange();
            range.moveStart('character', -jqInputElm.val().length);
            return range.text.length;
        }
        return 0;
    };

    return lib;

});