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

    Box.prototype.numRows = function () {
        return this.data ? this.data.length : 0;
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
            if (event.keyCode === 27) {
                $(win).off('keyup.histOff');
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
    };

    Box.prototype.cleanRowSelection = function () {
        this.boxElm.find('ul.rows li').removeClass('selected');
    };

    Box.prototype.highlightNextRow = function () {
        if (this.highlightedRow < this.numRows()) {
            this.cleanRowSelection();
            this.highlightedRow += 1;
            this.boxElm.find('ul.rows li:nth-child(' + this.highlightedRow + ')').addClass('selected');
        }
    };

    Box.prototype.highlightPrevRow = function () {
        if (this.highlightedRow > 0) {
            this.cleanRowSelection();
            this.highlightedRow -= 1;
            this.boxElm.find('ul.rows li:nth-child(' + this.highlightedRow + ')').addClass('selected');
        }
    };

    /**
     *
     */
    Box.prototype.init = function () {
        var self = this,
            prom = $.ajax('ajax_query_history', {
                dataType : 'json'
            }).promise();

        prom.then(
            function (data) {
                if (!this.boxElm) {
                    self.render();
                }
                self.appendData(data.data);
            },
            function (err) {
                // TODO
                console.log(err);
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
        var tbl = this.boxElm.find('ul.rows');

        this.data = data;
        tbl.empty();
        $.each(this.data, function (i, v) {
            tbl.append('<li><strong>' + v.corpname + '</strong>: <a href="'+ v.url + '">' + v.params + '</a></li>');
        });
    };

    /**
     * Closes history widget.
     */
    Box.prototype.close = function () {
        this.data = null; // TODO maybe we can cache the data here
        this.highlightedRow = 0;
        this.boxElm.remove();
        this.boxElm = null;
        this.bindActivationEvent();
        this.inputElm.off('keyup.moveSelection');
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