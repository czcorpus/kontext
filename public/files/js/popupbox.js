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

    var lib = {},
        fetchOptionFunc;

    /**
     *
     * @param opts
     * @returns {Function}
     */
    fetchOptionFunc = function (opts) {
        /**
         * @param {String} name
         * @param {String} [defaultVal]
         */
        return function (name, defaultVal) {
            var ans = null;

            if (opts.hasOwnProperty(name)) {
                ans = opts[name];

            } else if (defaultVal !== undefined) {
                ans = defaultVal;
            }
            return ans;
        };
    };

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

        this.onClose = null;
    }

    /**
     *
     * @returns {HTMLElement}
     */
    TooltipBox.prototype.getRootElement = function () {
        return this.newElem;
    };

    /**
     * Returns 'left', 'top' position plus 'width' and 'height'
     *
     * @returns {{}}
     */
    TooltipBox.prototype.getPosition = function () {
        var jqElem = $(this.newElem),
            ans = jqElem.position();

        ans.width = jqElem.width();
        ans.height = jqElem.height();
        return ans;
    };

    /**
     * Sets a CSS property of wrapping HTML Element
     *
     * @param {String} name
     * @param {String} value
     */
    TooltipBox.prototype.setCss = function (name, value) {
        $(this.newElem).css(name, value);
    };

    /**
     * Closes the box
     */
    TooltipBox.prototype.close = function () {
        if (this.newElem) {
            $(this.newElem).remove();
            this.newElem = null;

            if (this.timer) {
                clearInterval(this.timer);
            }
        }
        if (typeof this.onClose === 'function') {
            this.onClose.call(this);
        }
    };

    /**
     *
     * @param {String} type
     * @returns {String}
     */
    TooltipBox.prototype.mapTypeToIcon = function (type) {
        var ans = {
            info : "../files/img/info-icon.png",
            warning : "../files/img/warning-icon.png",
            error : "../files/img/error-icon.png",
            plain : null
        }[type];

        if (!ans) {
            throw new Error('unknown tooltip type: ' + type);
        }
        return ans;
    };

    /**
     *
     * @param options
     */
    TooltipBox.prototype.calcPosition = function (options) {
        var pageWidth = $(document).width(),
            horizPadding = 12,
            borderWidth,
            fetchOption = fetchOptionFunc(options),
            boxWidth = fetchOption('width', '620px'),
            boxHeight = fetchOption('height', 'auto'),
            boxIntWidth,
            boxTop = 0;

        $(this.newElem).css({
            'padding-left': horizPadding + 'px',
            'padding-right': horizPadding + 'px',
            width: boxWidth,
            height: boxHeight
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
    };

    /**
     *
     * @param whereElement
     * @param {string|function} contents if a function is provided,
     * following signature is expected: function(htmlElement) where htmlElement is the tooltip box itself
     * @param {{}} [options] accepted options are: width, height, fontSize, timeout, type (info, warning, error, plain,
     * onClose),
     * domId, calculatePosition (true, false)
     *
     */
    TooltipBox.prototype.open = function (whereElement, contents, options) {
        var opts = options || {},
            fetchOption = fetchOptionFunc(opts),
            jqWhereElement = $(whereElement),
            fontSize = fetchOption('fontSize', 'inherit'),
            closeClickHandler,
            escKeyHandler,
            self = this,
            msgType = fetchOption('type', 'info'),
            boxId = fetchOption('domId', null),
            calculatePosition = fetchOption('calculatePosition', true),
            finalizationCallback;

        this.timeout = fetchOption('timeout', this.timeout);
        this.onClose = fetchOption('onClose', null);

        this.newElem = win.document.createElement('div');
        if (boxId) {
            this.newElem.setAttribute('id', boxId);
        }
        jqWhereElement.append(this.newElem);

        if (typeof contents === 'function') {
            if (calculatePosition) {
                finalizationCallback = function () {
                    self.calcPosition(opts);
                };

            } else {
                finalizationCallback = function () {};
            }
            contents(this, finalizationCallback);

        } else {
            $(this.newElem).empty().append(contents);
            if (calculatePosition) {
                this.calcPosition(opts);
            }
        }
        if (msgType !== 'plain') {
            $(this.newElem).prepend('<img class="info-icon" src="' + this.mapTypeToIcon(msgType) + '" alt="info" />');
        }
        $(this.newElem).addClass('tooltip-box');
        $(this.newElem).css('font-size', fontSize);

        closeClickHandler = function (event) {
            if (event) {
                $(event.target).off('click', closeClickHandler);
            }
            $(document).off('click', closeClickHandler);
            TooltipBox.prototype.close.call(self);
        };

        escKeyHandler = function (event) {
            if (event.keyCode === 27) {
                self.close();
                $(window).off('keyup', escKeyHandler);
            }
        };

        $(window).on('keyup', escKeyHandler);

        if (this.timeout) {
            this.timer = setInterval(closeClickHandler, this.timeout);
        }
    };

    // export TooltipBox constructor
    lib.TooltipBox = TooltipBox;

    /**
     * Immediately opens a pop-up box. Because it is not bound to any element in this
     * case, a position and a size information of 'virtual' anchoring element must be always specified.
     *
     * @param contents
     * @param {{}} position - an object containing 'left', 'top', 'height' information about visual anchor
     * @param options
     * @return {TooltipBox} box
     */
    lib.open = function (contents, position, options) {
        var box,
            windowClickHandler,
            whereElm = $('body');

        options = options || {};

        box = new TooltipBox(position);
        box.open(whereElm, contents, options);

        windowClickHandler = function (event) {
            if (event.target !== box.newElem) {
                $(win).off('click', windowClickHandler);
                box.close();
            }
        };
        $(win).on('click', windowClickHandler);
        return box;
    };

    /**
     * Binds a pop-up box to a specified (clickable) anchoring element.
     * Position of the box is calculated according to the position and size of
     * anchoring element. Default behaviour of anchoring element's click event is suppressed.
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