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
        opts = opts || {};
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
     * @param {*} [beforeOpenVal]
     * @param {HTMLElement} triggerElm (optional) element which triggered this tooltip box
     */
    function TooltipBox(anchorPosition, beforeOpenVal, triggerElm) {

        this.anchorPosition = anchorPosition;

        this.beforeOpenVal = beforeOpenVal; // optional value returned by user's beforeOpen() callback

        this.triggerElm = triggerElm;

        this.onShowVal = null; // optional value returned by user's onShow() callback

        this.timer = null;

        this.rootElm = null;

        this.headerElm = null;

        this.contentElm = null;

        this.timeout = 25000;

        this.onClose = null;

        this.onShow = null;

        this.onError = null;

        this.jqCloseIcon = null;

        this.origContentParent = null;

        this.importedElement = null;

        this.expandLeft = false;

        this._suppressKeys = false;
    }

    /**
     * @deprecated use getContentElement instead
     */
    TooltipBox.prototype.getRootElement = function () {
        return this.headerElm;
    };

    /**
     *
     * @returns {null|Element|*}
     */
    TooltipBox.prototype.getContentElement = function () {
        return this.contentElm;
    };

    /**
     * Returns 'left', 'top' position plus 'width' and 'height'
     *
     * @returns {{}}
     */
    TooltipBox.prototype.getPosition = function () {
        var jqElem = $(this.rootElm),
            ans = jqElem.position();

        ans.width = jqElem.width();
        ans.height = jqElem.height();
        return ans;
    };

    /**
     *
     */
    TooltipBox.prototype.getTriggerElm = function () {
        return this.triggerElm;
    };

    /**
     *
     * @param {HTMLElement|String|jQuery} elm
     */
    TooltipBox.prototype.importElement = function (elm) {
        this.origContentParent = $(elm).parent();
        this.importedElement = $(elm);
        this.importedElement.css('display', 'block'); // TODO
        $(this.getRootElement()).append(this.importedElement);
    };

    /**
     * Searches for elements in the context of current popup box.
     * Compatible with jQuery's find.
     *
     * @param {jQuery|string|HTMLElement} query
     * @return jQuery
     */
    TooltipBox.prototype.findElement = function (query) {
        return $(this.rootElm).find(query);
    };

    /**
     * Sets a CSS property of wrapping HTML Element
     *
     * @param {String} name
     * @param {String} value
     */
    TooltipBox.prototype.setCss = function (name, value) {
        $(this.rootElm).css(name, value);
    };

    /**
     * Closes the box
     */
    TooltipBox.prototype.close = function () {
        if (this.rootElm) {
            if (typeof this.onClose === 'function') {
                this.onClose.call(this, this.onShowVal);
            }
            if (this.importedElement) {
                this.importedElement.css('display', 'none');
                this.origContentParent.append(this.importedElement);
            }
            $(this.rootElm).remove();
            this.rootElm = null;

            if (this.timer) {
                clearInterval(this.timer);
            }
        }
    };

    /**
     *
     * @param {String} type
     * @returns {String}
     */
    TooltipBox.prototype.mapTypeToIcon = function (type) {
        var ans = {
            info : "../files/img/info-icon.svg",
            message : "../files/img/message-icon.png",
            warning : "../files/img/warning-icon.png",
            error : "../files/img/error-icon.svg",
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
            fetchOption = fetchOptionFunc(options),
            boxWidth = fetchOption('width', 'auto'),
            boxHeight = fetchOption('height', 'auto'),
            boxIntWidth,
            boxTop;

        $(this.rootElm).css({
            width: boxWidth !== 'nice' ? boxWidth : pageWidth * (1 -  1 / 1.618),
            height: boxHeight
        });

        if (options.top === 'attached-bottom') {
            boxTop = (this.anchorPosition.top - $(this.rootElm).outerHeight(true) - 2) + 'px';

        } else { // includes 'attached-top' option
            boxTop = (this.anchorPosition.top + this.anchorPosition.height) + 'px';
        }

        $(this.rootElm).css('top', boxTop);

        boxIntWidth = $(this.rootElm).outerWidth(true);

        if (!this.expandLeft) {
            if (pageWidth - boxIntWidth > this.anchorPosition.left) {
                $(this.rootElm).css('left', this.anchorPosition.left + 'px');

            } else {
                $(this.rootElm).css({
                    left: '100%',
                    'margin-left': '-' + $(this.rootElm).outerWidth() + 'px'
                });
            }

        } else {
            if (this.anchorPosition.left + $(this.triggerElm).outerWidth() - boxIntWidth >= 0) {
                $(this.rootElm).css('left', (this.anchorPosition.left + $(this.triggerElm).outerWidth() - boxIntWidth)
                    + 'px');

            } else {
                $(this.rootElm).css('left', '0');
            }
        }
    };

    /**
     * @typedef {object} PopupBoxOptions
     * @property {number} options.width
     * @property {number} options.height
     * @property {number} options.fontSize
     * @property {number} options.timeout
     * @property {string} options.type (info, warning, error, plain)
     * @property {boolean} options.closeIcon if true then the box can be closed only by the ESC key and special closing icon
     * @property {function} options.onClose
     * @property {function} options.beforeOpen
     * @property {function} options.onShow
     * @property {function} options.onError
     * @property {function} options.domId
     * @property {string} options.htmlClass
     * @property {boolean} options.calculatePosition
     * @property {boolean} options.expandLeft
     * @property {{}} options.translator a function fn(message, vals?) able to translate messages
     */

    /**
     *
     * @param whereElement
     * @param {string|function} contents if a function is provided,
     * following signature is expected: function(TooltipBox, finalizeCallback) where first argument is a TooltipBox
     * instance and second argument is a finalization callback which is expected to be called by a user once he
     * finishes content generation.
     * @param {PopupBoxOptions} [options]
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
            boxClass = fetchOption('htmlClass', null),
            calculatePosition = fetchOption('calculatePosition', true);

        this.expandLeft = fetchOption('expandLeft', false);
        this.timeout = fetchOption('timeout', this.timeout);
        this.onClose = fetchOption('onClose', null);
        this.onShow = fetchOption('onShow', null);
        this.onError = function () {
            var customErrorHandler = fetchOption('onError', null);

            if (typeof customErrorHandler === 'function') {
                customErrorHandler(this.beforeOpenVal, this.onShowVal);
            }
        };

        this.translator = fetchOption('translator', function (s) { return s; });

        this.rootElm = win.document.createElement('div');
        $(this.rootElm).addClass('tooltip-box').hide();

        this.headerElm = win.document.createElement('div');
        $(this.rootElm).append(this.headerElm);

        this.contentElm = win.document.createElement('div');
        $(this.rootElm).append(this.contentElm);

        if (fetchOption('closeIcon', false)) {
            this.jqCloseIcon = $('<a class="close-link" title="' + this.translator('close') + '"></a>');
            $(this.rootElm).addClass('framed');
        }
        if (boxId) {
            this.rootElm.setAttribute('id', boxId);
        }
        if (boxClass) {
            $(this.rootElm).addClass(boxClass);
        }
        jqWhereElement.append(this.rootElm);

        if (typeof contents === 'function') {
            contents(this, function () {
                if (self.jqCloseIcon) {
                    $(self.headerElm).append(self.jqCloseIcon);
                }
                if (calculatePosition) {
                    self.calcPosition(opts);
                }
                $(self.rootElm).show();
                if (typeof self.onShow === 'function') {
                    self.onShowVal = self.onShow.call(self, self.beforeOpenVal);
                }
            });

        } else {
            $(this.contentElm).append(contents);
            if (this.jqCloseIcon) {
                $(this.headerElm).append(this.jqCloseIcon);
            }
            if (calculatePosition) {
                this.calcPosition(opts);
            }
            if (typeof this.onShow === 'function') {
                this.onShowVal = this.onShow.call(this, this.beforeOpenVal);
            }
            $(self.rootElm).show();
        }
        if (msgType !== 'plain') {
            $(this.headerElm).prepend('<img class="info-icon" src="' + this.mapTypeToIcon(msgType) + '" alt="info" />');
        }
        $(this.rootElm).css('font-size', fontSize);

        closeClickHandler = function (event) {
            if (event) {
                $(event.target).off('click', closeClickHandler);
            }
            $(win.document).off('click', closeClickHandler);
            TooltipBox.prototype.close.call(self);
        };

        escKeyHandler = function (event) {
            if (!self._suppressKeys) {
                if (event.keyCode === 27) {
                    self.close();
                    $(win.document).off('keyup', escKeyHandler);
                }
            }
        };
        $(win.document).on('keyup', escKeyHandler);

        if (this.timeout) {
            this.timer = setInterval(closeClickHandler, this.timeout);
        }
    };

    /**
     *
     * @param v
     */
    TooltipBox.prototype.suppressKeys = function (v) {
        this._suppressKeys = v;
    };

    /**
     *
     * @returns {string}
     */
    TooltipBox.prototype.toString = function () {
        return '[object TooltipBox]';
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
            whereElm = $('body'),
            beforeOpen = fetchOptionFunc(options)('beforeOpen', null),
            beforeOpenValue = null;

        options = options || {};

        if (typeof beforeOpen === 'function') {
            beforeOpenValue = beforeOpen.call(self);
        }

        box = new TooltipBox(position, beforeOpenValue, null);
        box.open(whereElm, contents, options);

        windowClickHandler = function (event) {
            if (event.target !== box.rootElm) {
                $(win.document).off('click', windowClickHandler);
                box.close();
            }
        };

        if (box.jqCloseIcon) { // explicit closing element is defined
            box.jqCloseIcon.on('click', windowClickHandler);

        } else { // click anywhere closes the box
            $(win.document).on('click', windowClickHandler);
        }
        return box;
    };

    /**
     * Binds a pop-up box to a specified (clickable) anchoring element.
     * Position of the box is calculated according to the position and size of
     * anchoring element. Default behaviour of anchoring element's click event is suppressed.
     *
     * @param {jQuery|HTMLElement|string} elm
     * @param {Function|String} contents if function then following signature
     * is expected: function(TooltipBox, finalizeCallback)
     * where function updates the box (i.e. no return value is involved here) by accessing TooltipBox object
     * @param {PopupBoxOptions} [options]
     */
    lib.bind = function (elm, contents, options) {
        var box,
            whereElm,
            beforeOpen = fetchOptionFunc(options)('beforeOpen', null),
            beforeOpenValue = null,
            self = this;

        options = options || {};
        whereElm = $('body');

        $(elm).data('popupBox', true); // true => box is bound but not opened

        $(elm).on('click', function (event) {
            var windowClickHandler,
                elmOffset;

            if (typeof beforeOpen === 'function') {
                beforeOpenValue = beforeOpen.call(self);
            }

            if ($(elm).data('popupBox')
                        && $(elm).data('popupBox').toString() === '[object TooltipBox]') {
                box = $(elm).data('popupBox');
                box.close();
                $(elm).data('popupBox', true);
            }

            elmOffset = $(event.target).offset();
            box = new TooltipBox({
                left: elmOffset.left,
                top: elmOffset.top,
                height: $(event.target).height()
            }, beforeOpenValue, $(elm).get(0));
            $(elm).data('popupBox', box);
            box.open(whereElm, contents, options);

            windowClickHandler = function (event) {
                if (event.target !== box.rootElm) {
                    $(win.document).off('click', windowClickHandler);
                    box.close();
                    $(elm).data('popupBox', true);
                }
            };

            if (box.jqCloseIcon) { // explicit closing element is defined
                box.jqCloseIcon.on('click', windowClickHandler);

            } else { // click anywhere closes the box
                $(win.document).on('click', windowClickHandler);
            }

            event.preventDefault();
            event.stopPropagation();
        });
    };

    /**
     * Modifies all the ABBR elements within 'context'
     * so that instead of mouse-over title there is a
     * clickable question mark appended.
     *
     * @param {String|HTMLElement|jQuery} [context]
     */
    lib.abbr = function (context) {
        var dataKey = 'abbr-popupbox-applied';

        function isModifiedAbbr(item) {
            return Boolean($(item).data(dataKey));
        }

        context = context || win.document;

        $(context).find('abbr').each(function () {
            var supElm,
                linkElm;
            if (!isModifiedAbbr(this)) {
                $(this).css('border', 'none');
                supElm = $(win.document.createElement('sup'));
                $(this).after(supElm);
                linkElm = $('<a class="context-help"><img class="over-img" src="../files/img/question-mark.png" data-alt-img="../files/img/question-mark_s.png" /></a>');
                lib.bind(linkElm, $(this).attr('title'), {calculatePosition : true});
                $(this).attr('title', null);
                supElm.append(linkElm);
                $(this).data(dataKey, true);
            }
        });
    };

    /**
     *
     * @param elm
     * @returns {boolean}
     */
    lib.hasAttachedPopupBox = function (elm) {
        var data = $(elm).data('popupBox');

        return (data && data.toString() === '[object TooltipBox]') || data === true;
    };

    /**
     * Closes attached popupBox if there is one within passed element elm
     *
     * @param elm
     */
    lib.close = function (elm) {
        var data = $(elm).data('popupBox');

        if (data && data.toString() === '[object TooltipBox]') {
            data.close();
        }
    };

    return lib;
});