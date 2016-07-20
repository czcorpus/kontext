/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../ts/declarations/jquery.d.ts" />

import $ = require('jquery');


function getColumnId(element:HTMLElement):string {
    return $(element).attr('id').substr($(element).attr('id').length - 1, 1);
}

/**
 *
 * @param state one of {left, right}
 * @param columnIdx column to update (indexing from 1 to 3)
 */
function switchAlignment(state:string, columnIdx:string):void {
    let srch, repl, select;

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

/**
 * This function fixes some flaws of original bonito2 application without
 * massive rewriting of related HTML templates and controller logic.
 * It initializes "KWIC alignment" select-box event handlers and sets form values
 * according to the state of these select-boxes.
 */
export function extendKwicAlignmentSelector(searchContext?:HTMLElement) {
    let srch = searchContext ? $(searchContext) : $(window.document);


    srch.find('select.kwic-alignment').each(function () {
        switchAlignment($(this).val(), getColumnId(this));
    });
    srch.find('select.kwic-alignment').each(function () {
        $(this).off('changeKwicAlign');
        $(this).on('change.kwicAlign', function (event) {
            switchAlignment($(event.target).val(), getColumnId(this));
        });
    });
};