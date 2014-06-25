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

/**
 * A widget to extend CQL query input field by a pop-up box containing user's query history.
 */
define(['jquery', 'win'], function ($, win) {
    'use strict';

    var lib = {};

    lib.pluginApi = null; // this must be initialized via lib.init(plugInApi)

    /**
     *
     * @param inputElm
     * @param parentElm
     * @constructor
     */
    function Box(inputElm, parentElm) {
        this.inputElm = $(inputElm);
        this.parentElm = $(parentElm);
        this.boxElm = null;
        this.inputElm.attr('autocomplete', 'off');
        this.bindActivationEvent();
        this.highlightedRow = 0;
        this.data = null; // currently appended data
    }

    /**
     *
     * @param refElm
     * @returns {{width: number, height: number, top: number, left: number}}
     */
    Box.prototype.calcSizeAndPosition = function (refElm) {
        var jqRef = $(refElm);
        return {
            width : jqRef.width(),
            height : jqRef.outerHeight(),
            top : jqRef.position().top,
            left : jqRef.position().left
        };
    };

    /**
     *
     * @returns {Number}
     */
    Box.prototype.numRows = function () {
        return this.data ? this.data.length : 0;
    };

    /**
     *
     * @param val
     */
    Box.prototype.setInputVal = function (val) {
        this.inputElm.val(val);
    };

    /**
     *
     */
    Box.prototype.bindActivationEvent = function () {
        var self = this;

        this.inputElm.on('keyup.histOn', function (event) {
            if (event.keyCode === 40) {
                self.inputElm.off('keyup.histOn');
                self.init();
            }
        });
    };

    /**
     *
     */
    Box.prototype.bindEvents = function () {
        var self = this;

        $(win).on('keyup.histOff', function (event) {
            if (event.keyCode === 13 || event.keyCode === 27) { // ENTER or ESC key
                event.preventDefault();
                event.stopPropagation();
                self.close();
            }
        });

        this.inputElm.on('keyup.moveSelection', function (event) {
            if (event.keyCode === 38) { // UP arrow
                self.highlightPrevRow();

            } else if (event.keyCode === 40) { // DOWN arrow
                self.highlightNextRow();
            }
        });

        // we have to block main form Enter key event to prevent submission
        $('#make-concordance-button').attr('disabled', 'disabled');
    };

    /**
     *
     */
    Box.prototype.cleanRowSelection = function () {
        this.boxElm.find('ul.rows li').removeClass('selected');
    };

    /**
     *
     */
    Box.prototype.highlightCurrentRow = function () {
        this.cleanRowSelection();
        this.boxElm.find('ul.rows li:nth-child(' + (this.highlightedRow + 1) + ')').addClass('selected');
        this.setInputVal(this.data[this.highlightedRow].query);
    };

    /**
     *
     */
    Box.prototype.highlightNextRow = function () {
        if (this.highlightedRow < this.numRows() - 1) {
            this.highlightedRow += 1;
            this.highlightCurrentRow();
        }
    };

    /**
     *
     */
    Box.prototype.highlightPrevRow = function () {
        if (this.highlightedRow > 0) {
            this.highlightedRow -= 1;
            this.highlightCurrentRow();
        }
    };

    /**
     *
     */
    Box.prototype.init = function () {
        var self = this,
            prom;

        this.data = [];
        if (this.inputElm.val()) {
            this.data.push({
                query : this.inputElm.val(),
                query_type : $('#queryselector').val(),
                corpname : lib.pluginApi.conf.corpname
            });
        }
        this.inputElm.blur();  // These two lines prevent Firefox from deleting
        this.inputElm.focus(); // the input after ESC is hit (probably a bug).

        prom = $.ajax('ajax_query_history', {
                dataType : 'json'
            }).promise();

        prom.then(
            function (data) {
                if (data.hasOwnProperty('error')) {
                    lib.pluginApi.showMessage('error', '.... ERROR.....'); // TODO
                    // TODO

                } else {
                    if (!this.boxElm) {
                        self.render();
                    }
                    self.appendData(data.data);
                }
            },
            function (err) {
                // TODO
                console.log(err);
                lib.pluginApi.showMessage('error', '.... ERROR.....'); // TODO
            }
        );
    };

    /**
     *
     */
    Box.prototype.render = function () {
        var frame = this.calcSizeAndPosition(this.inputElm);

        this.boxElm = $('<div>');
        this.boxElm.addClass('history-widget');
        $(this.parentElm).append(this.boxElm);
        this.boxElm.css({
            position : 'absolute',
            left : frame.left,
            top : frame.top + frame.height,
            width : frame.width,
            height: '300px'
        });
        this.boxElm.html('<ul class="rows"></ul>');
        this.bindEvents();
    };

    /**
     * Cleans-up currently rendered history rows and appends new data
     * as obtained in parameter data.
     *
     * @param {{}} data
     * @param {string} data.corpname
     */
    Box.prototype.appendData = function (data) {
        var tbl = this.boxElm.find('ul.rows'),
            listItem,
            link,
            self = this;

        this.data = this.data.concat(data);
        tbl.empty();
        $.each(this.data, function (i, v) {
            listItem = $(win.document.createElement('li'));

            link = $(win.document.createElement('a'));
            link.attr('data-rownum', i);
            link.attr('href', v.url);
            link.append('<strong>' + v.corpname + '</strong>:&nbsp;');
            link.append(v.query);
            listItem.on('click', function (event) {
                self.highlightedRow = parseInt($(event.target).attr('data-rownum'));
                self.highlightCurrentRow();
                self.setInputVal(self.data[self.highlightedRow].query);
                event.preventDefault();
                event.stopPropagation();
                self.close();
            });

            tbl.append(listItem);
            listItem.append(link);
        });
        this.highlightCurrentRow();

    };

    /**
     * Closes history widget.
     */
    Box.prototype.close = function () {
        //this.data = null; // TODO maybe we can cache the data here
        this.highlightedRow = 0;
        this.boxElm.remove();
        this.boxElm = null;
        this.inputElm.off('keyup.moveSelection');
        $(win).off('keyup.histOff');
        $('#make-concordance-button').attr('disabled', null);
        this.bindActivationEvent();
    };

    /**
     * Binds the query history widget to a passed element (typically, this is an input elm)
     *
     * @param elm
     * @returns {Box}
     */
    lib.bind = function (elm) {
        if ({}.toString.call(lib.pluginApi) !== '[object Object]') {
            throw new Error('Plugin [ucnkQueryStorage] not initialized. Please call init() first.');
        }
       return new Box(elm, $(elm).parent());
    };

    /**
     *
     * @param pluginApi
     */
    lib.init = function (pluginApi) {
        lib.pluginApi = pluginApi;
    };

    return lib;
});