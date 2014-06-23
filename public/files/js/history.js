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
    };

    Box.prototype.init = function () {
        var self = this,
            prom = $.ajax('ajax_query_history', {
                dataType : 'json'
            });

        prom.promise().then(
            function (data) {
                console.log(data);
                if (!this.boxElm) {
                    self.render();
                }
                self.appendData(data);
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
        this.boxElm.html('<table class="rows"><tbody></tbody></table>');
        this.bindEvents();
    };

    /**
     * Cleans-up currently rendered history rows and appends new data
     * as obtained in parameter data.
     *
     * @param {{}} data
     * @param {{}} data.data
     */
    Box.prototype.appendData = function (data) {
        var tbl = this.boxElm.find('table.rows tbody');

        tbl.empty();
        $.each(data.data, function (i, v) {
            tbl.append('<tr><td><a href="'+ v.url + '">' + v.params + '</a></td></tr>');
        });
    };

    /**
     * Closes history widget.
     */
    Box.prototype.close = function () {
        this.boxElm.remove();
        this.bindActivationEvent();
    };

    /**
     * Binds the query history widget to a passed element (typically, this is an input elm)
     *
     * @param elm
     * @returns {Box}
     */
    lib.bind = function (elm) {
       return new Box(elm, $(elm).parent());
    };

    return lib;
});