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

/// <reference path="../ts/declarations/common.d.ts" />

/**
 *
 */
export class SimplePageStore implements Kontext.PageStore {

    private changeListeners:Array<()=>void>;

    addChangeListener = (fn:()=>void) => {
        this.changeListeners.push(fn);
    };

    removeChangeListener = (fn:()=>void) => {
        for (var i = 0; i < this.changeListeners.length; i += 1) {
            if (this.changeListeners[i] === fn) {
                this.changeListeners.splice(i, 1);
                break;
            }
        }
    };

    notifyChangeListeners():void {
        for (var i = 0; i < this.changeListeners.length; i += 1) {
            this.changeListeners[i].call(this);
        }
    }

    constructor() {
        this.changeListeners = [];
    }
}


/**
 * Returns position (in number of characters) of cursor in a text input
 *
 * @param {Element|jQuery} inputElm
 * @return {number} position of cursor (starting from zero)
 */
export function getCaretPosition(inputElm) {
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

    } else if (window.document['selection']) { // < IE9
        jqInputElm.focus();
        range = window.document['selection'].createRange();
        range.moveStart('character', -jqInputElm.val().length);
        return range.text.length;
    }
    return 0;
}
