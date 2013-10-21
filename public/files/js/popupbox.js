/*
 * Copyright (c) 2012 Institute of the Czech National Corpus
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

define(['win', 'jquery'], function (win, $) {
    'use strict';

    var lib = {};

    /**
     * @constructor
     * @param {{}} anchorPosition object with 'left', 'top' and 'height' attributes specifying
     * height and anchorPosition of an element the pop-up box will be (visually) bound to
     */
    function TooltipBox(anchorPosition) {

        this.anchorPosition = anchorPosition;

        this.timer = null;

        this.newElem = null;

        this.timeout = 25000;
    }

    /**
     *
     */
    TooltipBox.prototype.close = function () {
        if (this.newElem) {
            $(this.newElem).remove();
            this.newElem = null;

            if (this.timer) {
                clearInterval(this.timer);
            }
        }
    };

    TooltipBox.prototype.mapTypeToIcon = function (type) {
        var ans = {
            info : "../files/img/info-icon.png",
            warning : "../files/img/warning-icon.png",
            error : "../files/img/error-icon.png"
        }[type];

        if (!ans) {
            throw Error('unknown tooltip type: ' + type);
        }
        return ans;
    };

    /**
     *
     * @param whereElement
     * @param {string|function} contents if a function is provided,
     * following signature is expected: function(htmlElement) where htmlElement is the tooltip box itself
     * @param {object} [options] accepted options are: width, height, fontSize, timeout
     *
     */
    TooltipBox.prototype.open = function (whereElement, contents, options) {
        var pageWidth = $(document).width(),
            horizPadding = 12,
            borderWidth,
            boxWidth = '620px',
            boxHeight = 'auto',
            boxIntWidth,
            boxTop = 0,
            jqWhereElement = $(whereElement),
            fontSize,
            closeClickHandler,
            self = this,
            msgType = 'info';

        options = options || {};

        if (options.hasOwnProperty('type')) {
            msgType = options.type;
        }

        if (options.hasOwnProperty('height')) {
            boxHeight = options.height;
        }

        if (options.hasOwnProperty('width')) {
            boxWidth = options.width;
        }

        this.timeout = options.timeout || this.timeout;

        fontSize = options.hasOwnProperty('fontSize') ? options.fontSize : 'inherit';

        this.newElem = win.document.createElement('div');
        jqWhereElement.append(this.newElem);

        if (typeof contents === 'function') {
            contents(this.newElem);

        } else {
            $(this.newElem).empty().append(contents);
        }
        $(this.newElem).prepend('<img class="info-icon" src="' + this.mapTypeToIcon(msgType) + '" alt="info" />');
        $(this.newElem).addClass('tooltip-box');
        $(this.newElem).css({
            'padding-left': horizPadding + 'px',
            'padding-right': horizPadding + 'px',
            width: boxWidth,
            height: boxHeight,
            'font-size': fontSize
        });
        if (options.top === 'attached-bottom') {
            boxTop = (this.anchorPosition.top - $(this.newElem).outerHeight(true) - 2) + 'px';

        } else { // includes 'attached-top' option
            boxTop = (this.anchorPosition.top + this.anchorPosition.height) + 'px';
        }

        $(this.newElem).css('top', boxTop);

        boxIntWidth = $(this.newElem).outerWidth(true);
        if (pageWidth - boxIntWidth > this.anchorPosition.left) {
            $(this.newElem).css('left', this.anchorPosition.left + 'px');

        } else {
            borderWidth = $(this.newElem).css('border-left-width').replace(/([0-9]+)[a-z]+/, '$1');
            $(this.newElem).css({
                left: '100%',
                'margin-left': '-' + (boxIntWidth + 2 * horizPadding + 2 * borderWidth) + 'px'
            });
        }

        closeClickHandler = function (event) {
            if (event) {
                $(event.target).off('click', closeClickHandler);
            }
            $(document).unbind('click', closeClickHandler);
            TooltipBox.prototype.close.call(self);
        };

        this.timer = setInterval(closeClickHandler, this.timeout);
    };

    // export TooltipBox constructor
    lib.TooltipBox = TooltipBox;

    /**
     *
     * @param {jQuery|HTMLElement|string} elm
     * @param {function|string} contents
     * @param {object} [options]
     */
    lib.bind = function (elm, contents, options) {
        var box,
            whereElm;

        options = options || {};
        whereElm = $('body');

        $(elm).on('click', function (event) {
            var windowClickHandler,
                elmOffset;

            if ($(elm).data('popupBox')) {
                box = $(elm).data('popupBox');
                box.close();
                $(elm).data('popupBox', null);

            } else {
                elmOffset = $(event.target).offset();
                box = new TooltipBox({
                    left: elmOffset.left,
                    top: elmOffset.top,
                    height: $(event.target).height()
                });
                $(elm).data('popupBox', box);
                box.open(whereElm, contents, options);

                windowClickHandler = function (event) {
                    if (event.target !== box.newElem) {
                        $(win).off('click', windowClickHandler);
                        box.close();
                        $(elm).data('popupBox', null);
                    }
                };
                $(win).on('click', windowClickHandler);
            }
            event.preventDefault();
            event.stopPropagation();
        });
    };

    return lib;
});