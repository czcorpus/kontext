/*
 * Copyright (c) 2012 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2012 Tomas Machalek <tomas.machalek@gmail.com>
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
 * @module
 * @deprecated Please note that new views should use React-based
 * <layoutModel.PopupBox /> component.
 */

/// <reference path="../ts/declarations/jquery.d.ts" />
/// <reference path="./types/common.d.ts" />

import * as $ from 'jquery';


export interface PopupBoxMixins {
    createStaticUrl(path:string):string;
    translate(message:string, values?:{[key:string]:string}):string;
}

export interface Position {
    top: number;
    left: number;
    width?: any;
    height?: any;
}

export interface Options {
    top?:string;
    width?:number|string;
    height?:number|string;
    fontSize?:string;
    timeout?:number;
    type?:string;
    closeIcon?:boolean;
    onClose?:(e:Event) => void;
    afterClose?:(e:Event) => void;
    beforeOpen?:(e:Event) => void;
    onShow?:(obj:JQuery) => void;
    onError?:(obj:JQuery) => void;
    domId?:string;
    htmlClass?:string;
    calculatePosition?:boolean;
    movable?:boolean;
}

export interface Finalize {
    (box:TooltipBox, finalize:()=>void):void;
}

export type TooltipBoxContent = Finalize | string | HTMLElement | JQuery;

export interface Api {
    open(contents: any, position: Position, options: Options);
    openAt(where:HTMLElement, contents:TooltipBoxContent, position:Position, options:Options):TooltipBox;
    bind(elm:HTMLElement|JQuery, contents:TooltipBoxContent, options:Options):void;
    abbr(context?: any); // TODO type
    hasAttachedPopupBox(elm: any); // TODO type
    close(elm: any); // TODO type
}


let mixins:PopupBoxMixins = {
    createStaticUrl : function (s) { return '../files'; },
    translate: function (s, values) { return s; }
};

/**
 *
 * @param opts
 * @returns {Function}
 */
function fetchOptionFunc(opts) {
    opts = opts || {};
    /**
     * @param {String} name
     * @param {String} [defaultVal]
     */
    return function (name, defaultVal) {
        let ans = null;

        if (opts.hasOwnProperty(name)) {
            ans = opts[name];

        } else if (defaultVal !== undefined) {
            ans = defaultVal;
        }
        return ans;
    };
}

/**
 * @constructor
 * @param {{}} anchorPosition object with 'left', 'top' and 'height' attributes specifying
 * height and anchorPosition of an element the pop-up box will be (visually) bound to
 * @param {*} [beforeOpenVal]
 * @param {HTMLElement} triggerElm (optional) element which triggered this tooltip box
 */
export class TooltipBox implements Legacy.IPopupBox {


    private anchorPosition:any; // TODO type

    // optional value returned by user's beforeOpen() callback
    private beforeOpenVal:any; // TODO type

    private triggerElm:HTMLElement;

    private onShowVal:any; // optional value returned by user's onShow() callback

    private timer:number;

    private rootElm:HTMLElement;

    private headerElm:HTMLElement;

    private contentElm:HTMLElement;

    private timeout:number = 25000;

    private onClose:(TooltipBox) => void;

    private afterClose:(TooltipBox) => void;

    private onShow:(TooltipBox) => void;

    private onError:(TooltipBox) => void;

    private jqCloseIcon:JQuery;

    private origContentParent:JQuery;

    private importedElement:JQuery;

    private expandLeft:boolean = false;

    private suppressKeys:boolean = false;

    private escKeyHandler;


    constructor(anchorPosition, beforeOpenVal, triggerElm) {
        this.anchorPosition = anchorPosition;
        this.beforeOpenVal = beforeOpenVal;
        this.triggerElm = triggerElm;
    }

    getRootElement():HTMLElement {
        return this.rootElm;
    }

    getContentElement():HTMLElement {
        return this.contentElm;
    }

    hasCloseIcon():boolean {
        return !!this.jqCloseIcon;
    }

    addCloseIconHandler(handler:(evt:JQueryEventObject)=>void):void {
        if (this.hasCloseIcon()) {
            this.jqCloseIcon.on('click', handler);

        } else {
            throw new Error('Cannot add close icon handler - no icon defined');
        }
    }

    /**
     * Returns 'left', 'top' position plus 'width' and 'height'
     *
     */
    getPosition():Position {
        let jqElem = $(this.rootElm);
        let ans:any = jqElem.position();
        ans.width = jqElem.width();
        ans.height = jqElem.height();
        return ans;
    }

    getTriggerElm():HTMLElement {
        return this.triggerElm;
    }

    importElement(elm:HTMLElement|JQuery):void {
        this.origContentParent = $(elm).parent();
        this.importedElement = $(elm);
        this.importedElement.css('display', 'block'); // TODO
        $(this.getRootElement()).append(this.importedElement);
    }

    /**
     * Sets a CSS property of wrapping HTML Element
     *
     */
    setCss(name:string, value:any):TooltipBox {
        $(this.rootElm).css(name, value);
        return this;
    }

    /**
     * Closes the box
     */
    close():void {
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
            if (typeof this.afterClose === 'function') {
                this.afterClose.call(this);
            }
            if (typeof this.escKeyHandler === 'function') {
                $(window.document.documentElement).off('keyup', this.escKeyHandler);
            }
        }
    }

    /**
     *
     */
    private mapTypeToIcon(type:string):string {
        let ans = {
            info : mixins.createStaticUrl('img/info-icon.svg'),
            message : mixins.createStaticUrl('img/message-icon.png'),
            warning : mixins.createStaticUrl('img/warning-icon.svg'),
            error : mixins.createStaticUrl('img/error-icon.svg'),
            plain : null
        }[type];

        if (!ans) {
            throw new Error('unknown tooltip type: ' + type);
        }
        return ans;
    }

    private calcPosition(options):void {
        let pageWidth = $(document).width();
        let fetchOption = fetchOptionFunc(options);
        let boxWidth = fetchOption('width', 'auto');
        let boxHeight = fetchOption('height', 'auto');
        let boxIntWidth;
        let boxTop;

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
    }

    private makeBoxMovable():void {
        let self = this;
        function mkMouseMoveHandler(deltaX, deltaY) {
            return (evt) => {
                $(self.rootElm).css({
                    position: 'absolute',
                    top: (evt.pageY + deltaY) + 'px',
                    left: (evt.pageX + deltaX) + 'px'
                });
            };
        }
        let moveArea = window.document.createElement('div');
        $(moveArea)
            .addClass('movable')
            .attr('title', mixins.translate('global__click_and_hold_to_move'));
        $(this.headerElm).append(moveArea);
        $(moveArea)
            .on('mousedown', function (e) {
                let pos = $(self.rootElm).offset();
                let deltaX = pos.left - e.pageX;
                let deltaY = pos.top - e.pageY;
                let moveHandler = mkMouseMoveHandler(deltaX, deltaY);
                $(window).on('mousemove', moveHandler);
                $(window).on('mouseup.popupbox', () => {
                    $(window).off('mousemove', moveHandler);
                    $(window).off('mouseup.popupbox');
                });
            });
    }

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
    open(whereElement:HTMLElement|JQuery, contents:TooltipBoxContent, options:Options):void {
        const opts = options || {};
        const fetchOption = fetchOptionFunc(opts);
        const jqWhereElement = $(whereElement);
        const fontSize = fetchOption('fontSize', 'inherit');
        const self = this;
        const msgType = fetchOption('type', 'info');
        const boxId = fetchOption('domId', null);
        const boxClass = fetchOption('htmlClass', null);
        const calculatePosition = fetchOption('calculatePosition', true);

        this.expandLeft = fetchOption('expandLeft', false);
        this.timeout = fetchOption('timeout', this.timeout);
        this.onClose = fetchOption('onClose', null);
        this.afterClose = fetchOption('afterClose', null);
        this.onShow = fetchOption('onShow', null);
        this.onError = function () {
            let customErrorHandler = fetchOption('onError', null);

            if (typeof customErrorHandler === 'function') {
                customErrorHandler(this.beforeOpenVal, this.onShowVal);
            }
        };

        this.rootElm = window.document.createElement('div');
        $(this.rootElm).addClass('tooltip-box').hide();

        this.headerElm = window.document.createElement('div');
        $(this.headerElm).addClass('header');
        $(this.rootElm).append(this.headerElm);

        if (fetchOption('movable', false)) {
            this.makeBoxMovable();
        }

        this.contentElm = window.document.createElement('div');
        $(this.rootElm).append(this.contentElm);
        if (fetchOption('closeIcon', false)) {
            this.jqCloseIcon = $(
                `<button class="close-link" title="${mixins.translate('close')}"></button>`);
        }
        if (boxId) {
            this.rootElm.setAttribute('id', boxId);
        }
        if (boxClass) {
            $(this.rootElm).addClass(boxClass);
        }
        jqWhereElement.append(this.rootElm);

        if (typeof contents === 'function') {
            (<Finalize>contents)(this, () => {
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

        const closeClickHandler = function (event) {
            if (event) {
                $(event.target).off('click', closeClickHandler);
            }
            $(window.document).off('click', closeClickHandler);
            TooltipBox.prototype.close.call(self);
        };

        this.escKeyHandler = (event) => {
            if (!self.suppressKeys) {
                if (event.keyCode === 27) {
                    self.close();
                    $(window.document.documentElement).off('keyup', this.escKeyHandler);
                }
            }
        };
        $(window.document.documentElement).on('keyup', this.escKeyHandler);

        if (this.timeout) {
            this.timer = setInterval(closeClickHandler, this.timeout);
        }
    }

    /**
     */
    toString():string {
        return '[object TooltipBox]';
    }
}

export function open(contents:TooltipBoxContent, position:Position, options:Options):TooltipBox {
    return openAt($('body').get(0), contents, position, options);
}

/**
 * Immediately opens a pop-up box. Because it is not bound to any element in this
 * case, a position and a size information of 'virtual' anchoring element must be always specified.
 *
 * @param contents
 * @param {{}} position - an object containing 'left', 'top', 'height' information about visual anchor
 * @param options
 * @return {TooltipBox} box
 */
export function openAt(where:HTMLElement, contents:TooltipBoxContent, position:Position, options:Options):TooltipBox {
    let box;
    let windowClickHandler;

    let beforeOpen = fetchOptionFunc(options)('beforeOpen', null);
    let beforeOpenValue = null;

    options = options || {};

    if (typeof beforeOpen === 'function') {
        beforeOpenValue = beforeOpen.call(self);
    }

    box = new TooltipBox(position, beforeOpenValue, null);
    box.open(where, contents, options);

    windowClickHandler = function (event) {
        if (event.target !== box.rootElm) {
            $(window.document).off('click', windowClickHandler);
            box.close();
        }
    };

    if (box.jqCloseIcon) { // explicit closing element is defined
        box.jqCloseIcon.on('click', windowClickHandler);

    } else { // click anywhere closes the box
        $(window.document).on('click', windowClickHandler);
    }
    return box;
}

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
export function bind(elm:HTMLElement|JQuery, contents:TooltipBoxContent, options:Options):void {
    let box:TooltipBox;
    let whereElm;
    let beforeOpen = fetchOptionFunc(options)('beforeOpen', null);
    let beforeOpenValue = null;
    let self = this;

    options = options || {};
    whereElm = $('body');

    $(elm).data('popupBox', true); // true => box is bound but not opened

    $(elm).on('click', function (event) {
        let windowClickHandler;
        let elmOffset;

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

        windowClickHandler = (event) => {
            if (event.target !== box.getRootElement()) {
                $(window.document).off('click', windowClickHandler);
                box.close();
                $(elm).data('popupBox', true);
            }
        };

        if (box.hasCloseIcon()) { // explicit closing element is defined
            box.addCloseIconHandler(windowClickHandler);

        } else { // click anywhere closes the box
            $(window.document).on('click', windowClickHandler);
        }

        event.preventDefault();
        event.stopPropagation();
    });
}

/**
 * Modifies all the ABBR elements within 'context'
 * so that instead of mouse-over title there is a
 * clickable question mark appended.
 *
 */
export function abbr(context?:string|HTMLElement|JQuery):void {
    let dataKey = 'abbr-popupbox-applied';

    function isModifiedAbbr(item) {
        return Boolean($(item).data(dataKey));
    }

    context = context || window.document.documentElement;

    $(context).find('abbr').each(function () {
        if (!isModifiedAbbr(this)) {
            $(this).css('border', 'none');
            let supElm = $(window.document.createElement('sup'));
            $(this).after(supElm);
            let linkElm = $('<a class="context-help"><img class="over-img" ' +
                'src="' + mixins.createStaticUrl('img/question-mark.svg') + '" ' +
                'data-alt-img="' + mixins.createStaticUrl('img/question-mark_s.svg') + '" /></a>');
            bind(linkElm, $(this).attr('title'), {calculatePosition : true});
            $(this).attr('title', null);
            supElm.append(linkElm);
            $(this).data(dataKey, true);
        }
    });
}

/**
 *
 */
export function hasAttachedPopupBox(elm):boolean {
    let data = $(elm).data('popupBox');
    return (data && data.toString() === '[object TooltipBox]') || data === true;
}

/**import "ts" into "d.ts"
 * Closes attached popupBox if there is one within passed element elm
 *
 * @param elm
 */
export function close(elm:string|HTMLElement|JQuery):void {
    let data = $(elm).data('popupBox');

    if (data && data.toString() === '[object TooltipBox]') {
        data.close();
    }
}

/**
 */
export function extended(layoutModel):Api {
    mixins.createStaticUrl = layoutModel.createStaticUrl.bind(layoutModel);
    mixins.translate = layoutModel.translate.bind(layoutModel);
    return {
        bind: bind,
        open: open,
        openAt: openAt,
        close: close,
        hasAttachedPopupBox: hasAttachedPopupBox,
        abbr: abbr
    };
}
