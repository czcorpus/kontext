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

(function (context) {
    'use strict';

    var mlkfu;

    /**
     *
     * @param cookiename
     * @return {String}
     */
    context.getCookieValue = function (cookiename) {
        var allcookies = document.cookie,
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
    mlkfu = {

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

    context.multiLevelKwicFormUtil = mlkfu;

}(window));