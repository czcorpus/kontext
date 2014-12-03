/*
 * Copyright (c) 2014 Institute of the Czech National Corpus
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

define(['win'], function (win) {

    var lib = {},
        accessKey = 'concLines';

    /**
     * Loads all the selection data from local storage.
     * If nothing is found then new entry is created
     *
     * @returns {*}
     */
    function loadAll() {
        var data;

        try {
            data = JSON.parse(win.sessionStorage[accessKey]);

        } catch (e) {
            win.sessionStorage[accessKey] = '{}';
            data = {};
        }
        return data;
    }

    /**
     * This object is used for accessing stored concordance lines and is based on
     * browser's sessionStorage. Individual changes (via addLine(), removeLine())
     * are not stored immediately. It is up to programmer to use method serialize()
     * (e.g. using window's unload event) to make changes session-permanent.
     *
     * @constructor
     * @param {function} [errorHandler] error handler with signature fn(error), 'this' refers to current ConcLinesStorage
     */
    function ConcLinesStorage(errorHandler) {
        this.data = loadAll();
        this.errorHandler = errorHandler;
    }

    /**
     *
     * @returns {boolean} true if browser supports sessionStorage else false
     */
    ConcLinesStorage.prototype.supportsSessionStorage = function () {
        try {
            return 'sessionStorage' in window && window['sessionStorage'] !== null;

        } catch (e) {
            return false;
        }
    };

    /**
     * Adds a selected concordance line.
     *
     * @param {number} id position number of first kwic word
     * @param {number} kwiclen number of kwic words
     */
    ConcLinesStorage.prototype.addLine = function (id, kwiclen) {
        this.data[id] = kwiclen;
    };

    /**
     *
     * @param id
     */
    ConcLinesStorage.prototype.removeLine = function (id) {
        delete this.data[id];
    };

    /**
     *
     * @param id
     * @returns {boolean}
     */
    ConcLinesStorage.prototype.containsLine = function (id) {
        return this.data.hasOwnProperty(id);
    };

    /**
     *
     */
    ConcLinesStorage.prototype.getAll = function () {
        var ans = [],
            p;

        for (p in this.data) {
            if (this.data.hasOwnProperty(p)) {
                ans.push([parseInt(p, 10), this.data[p]]);
            }
        }
        return ans;
    };

    /**
     * Removes all the elements and writes the change into sessionStorage
     */
    ConcLinesStorage.prototype.clear = function () {
        this.data = {};
        win.sessionStorage.removeItem(accessKey);
    };

    /**
     * Returns number of selected rows
     *
     * @returns {number}
     */
    ConcLinesStorage.prototype.size = function () {
        var total = 0;

        if (!Object.keys) {  // let IE8 and his older friends suffer
            (function () {
                var p;

                for (p in this.data) {
                    if (this.data.hasOwnProperty(p)) {
                        total += 1;
                    }
                }
            }());

        } else {
            total = Object.keys(this.data).length;
        }
        return total;
    }

    /**
     * Stores data into a sessionStorage as a JSON object
     */
    ConcLinesStorage.prototype.serialize = function () {
        try {
            win.sessionStorage[accessKey] = JSON.stringify(this.data);
        } catch (e) {
            if (e.name === 'QUOTA_EXCEEDED_ERR') {
                console.error('Failed to store selected concordance lines due to exceeded data limit.');
                if (typeof this.errorHandler === 'function') {
                    this.errorHandler.call(this, e);
                }
            }
        }
    };

    /**
     * @param {function} [errorHandler] see ConcLinesStorage documentation
     * @returns {ConcLinesStorage}
     */
    lib.openStorage = function (errorHandler) {
        return new ConcLinesStorage(errorHandler);
    };

    return lib;
});
