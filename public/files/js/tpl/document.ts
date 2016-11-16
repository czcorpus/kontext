/*
 * Copyright (c) 2013 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../types/common.d.ts" />
/// <reference path="../types/views.d.ts" />
/// <reference path="../types/plugins/abstract.d.ts" />
/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../../ts/declarations/react.d.ts" />
/// <reference path="../../ts/declarations/flux.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />
/// <reference path="../../ts/declarations/immutable.d.ts" />
/// <reference path="../../ts/declarations/rsvp-ajax.d.ts" />
/// <reference path="../../ts/declarations/intl-messageformat.d.ts" />
/// <reference path="../../ts/declarations/modernizr.d.ts" />
/// <reference path="../../ts/declarations/translations.d.ts" />


import win = require('win');
import $ = require('jquery');
import popupbox = require('../popupbox');
import applicationBar = require('plugins/applicationBar/init');
import footerBar = require('plugins/footerBar/init');
import flux = require('vendor/Dispatcher');
import {init as documentViewsInit} from 'views/document';
import {init as menuViewsInit} from 'views/menu';
import {init as overviewAreaViewsInit} from 'views/overview';
import React = require('vendor/react');
import ReactDOM = require('vendor/react-dom');
import RSVP = require('vendor/rsvp');
import rsvpAjax = require('vendor/rsvp-ajax');
import {MultiDict, History, NullHistory} from '../util';
import * as docStores from '../stores/common/layout';
import userStores = require('../stores/userStores');
import {ViewOptionsStore} from '../stores/viewOptions';
import translations = require('translations');
import IntlMessageFormat = require('vendor/intl-messageformat');
import Immutable = require('vendor/immutable');
import {AsyncTaskChecker} from '../stores/asyncTask';
import userSettings = require('../userSettings');
declare var Modernizr:Modernizr.ModernizrStatic;

/**
 *
 */
class NullStorage implements Storage {

    key(idx:number):string {
        return null
    }

    getItem(key:string):string {
        return null;
    }

    setItem(key:string, value:string) {
    }

    removeItem(key:string) {
    }

    clear():void {
    }

    length:number = 0;
    remainingSpace:number = 0;
    [key: string]: any;
    [index: number]: any;
}

/**
 *
 * A local storage factory. If a respective
 * API is not supported then @link{NullStorage} is returned.
 */
function getLocalStorage():Storage {
    if (typeof win.localStorage === 'object') {
        return win.localStorage;

    } else {
        new NullStorage();
    }
}

/**
 * Possible types for PageModel's ajax method request args
 */
export type AjaxArgs = MultiDict|{[key:string]:any}|string;

/**
 *
 */
export class PageModel implements Kontext.IURLHandler, Kontext.IConcArgsHandler {

    /**
     * KonText configuration (per-page dynamic object)
     */
    conf:Kontext.Conf;

    /**
     * Flux Dispatcher (currently not used across the app)
     */
    dispatcher:flux.Dispatcher<Kontext.DispatcherPayload>;

    /**
     * Custom client-side plug-ins implementations
     */
    plugins:{[name:string]:any}; // TODO type

    /**
     * Registered callbacks for plug-ins reinitialization
     */
    pluginResets:Array<()=>void> = []; // TODO

    /**
     *
     * @type {Array}
     */
    initCallbacks:Array<()=>void>;

    /**
     * Local user settings
     */
    userSettings:userSettings.UserSettings;

    history:Kontext.IHistory;

    /**
     * React component classes
     */
    layoutViews:Kontext.LayoutViews;

    private corpusInfoStore:docStores.CorpusInfoStore;

    private messageStore:docStores.MessageStore;

    private userInfoStore:userStores.UserInfo;

    private viewOptionsStore:ViewOptionsStore;

    /**
     * A dictionary containing translations for current UI language (conf['uiLang']).
     */
    private translations:{[key:string]:string};

    private asyncTaskChecker:AsyncTaskChecker;

    /**
     * This is intended for React components to make them able register key
     * events (e.g. the 'ESC' key).
     */
    private globalKeyHandlers:Immutable.List<(evt:Event)=>void>;

    /**
     *
     * @param conf
     */
    constructor(conf:Kontext.Conf) {
        this.conf = conf;
        this.dispatcher = new flux.Dispatcher<Kontext.DispatcherPayload>();
        this.initCallbacks = [];
        this.userSettings = new userSettings.UserSettings(getLocalStorage(), 'kontext_ui',
                '__timestamp__', this.conf['uiStateTTL']);
        this.history = Modernizr.history ? new History(this) : new NullHistory();
        this.corpusInfoStore = new docStores.CorpusInfoStore(this.pluginApi(), this.dispatcher);
        this.messageStore = new docStores.MessageStore(this.pluginApi(), this.dispatcher);
        this.userInfoStore = new userStores.UserInfo(this, this.dispatcher);
        this.viewOptionsStore = new ViewOptionsStore(this, this.dispatcher);
        this.translations = translations[this.conf['uiLang']] || {};
        this.asyncTaskChecker = new AsyncTaskChecker(this.dispatcher, this.pluginApi(),
                this.getConf<any>('asyncTasks') || []);
        this.globalKeyHandlers = Immutable.List<(evt:Event)=>void>();
    }

    /**
     * Returns layout stores (i.e. the stores used virtually on any page)
     */
    getStores():Kontext.LayoutStores {
        return {
            corpusInfoStore: this.corpusInfoStore,
            messageStore: this.messageStore,
            userInfoStore: this.userInfoStore,
            viewOptionsStore: this.viewOptionsStore,
            asyncTaskInfoStore: this.asyncTaskChecker
        };
    }

    /**
     * Exports a list of default + (optional custom) mixins
     * for a React component.
     *
     * @param mixins Additional mixins
     * @returns a list of mixins
     */
    exportMixins(...mixins:any[]):any[] {
        let self = this;
        let componentTools:Kontext.ComponentCoreMixins = {
            translate(s:string, values?:any):string {
                return self.translate(s, values);
            },
            getConf(k:string):any {
                return self.getConf(k);
            },
            createActionLink(path:string, args?:Array<[string,string]>):string {
                return self.createActionUrl(path, args);
            },
            createStaticUrl(path:string):string {
                return self.createStaticUrl(path);
            },
            formatNumber(value:number):string {
                return self.formatNumber(value);
            },
            formatDate(d:Date, timeFormat:number=0):string {
                return self.formatDate(d, timeFormat);
            },
            getLayoutViews():Kontext.LayoutViews {
                return self.layoutViews;
            },
            addGlobalKeyEventHandler(fn:(evt:Event)=>void):void {
                self.addGlobalKeyEventHandler(fn);
            },
            removeGlobalKeyEventHandler(fn:(evt:Event)=>void):void {
                self.removeGlobalKeyEventHandler(fn);
            }
        };
        return mixins ? mixins.concat([componentTools]) : [componentTools];
    }

    /**
     * Renders provided React component with specified mount element.
     *
     * @param reactClass
     * @param target An element whose content will be replaced by rendered React component
     * @param props Properties used by created component
     */
    renderReactComponent(reactClass:React.ReactClass,
            target:HTMLElement, props?:React.Props):void {
        ReactDOM.render(React.createElement(reactClass, props), target);
    }

    unmountReactComponent(element:HTMLElement):boolean {
        return ReactDOM.unmountComponentAtNode(element);
    }

    /**
     * @param selectAllElm
     * @param forceStatus
     */
    private toggleSelectAllTrigger(selectAllElm:HTMLInputElement, forceStatus?:string) {
        if (!$(selectAllElm).attr('data-status')) {
            $(selectAllElm).attr('data-status', '1');
        }
        let currValue = $(selectAllElm).attr('data-status');
        let newValue;
        if (forceStatus) {
            newValue = forceStatus;

        } else if (currValue === '1') {
            newValue = '2';

        } else if (currValue === '2') {
            newValue = '1';
        }

        if (currValue !== newValue) {
            $(selectAllElm).attr('data-status', newValue);
            if (newValue === '1') {
                selectAllElm.checked = false;
            }
        }
    }

    /**
     * Adds a window-registered key event handler.
     */
    addGlobalKeyEventHandler(fn:(evt:Event)=>void):void {
        this.globalKeyHandlers = this.globalKeyHandlers.push(fn);
    }

    /**
     * Removes a window-registered key event handler.
     */
    removeGlobalKeyEventHandler(fn:(evt:Event)=>void):void {
        const srchIdx:number = this.globalKeyHandlers.indexOf(fn);
        if (srchIdx > -1) {
            this.globalKeyHandlers = this.globalKeyHandlers.remove(srchIdx);
        }
    }

    /**
     * Register a handler triggered each time an asynchronous
     * server task is updated (typically finished)
     */
    addOnAsyncTaskUpdate(fn:Kontext.AsyncTaskOnUpdate):void {
        this.asyncTaskChecker.addOnUpdate(fn);
    }

    registerTask(task:Kontext.AsyncTaskInfo):void {
        this.asyncTaskChecker.registerTask(task);
    }

    /**
     * Escapes general string containing HTML elements and entities
     *
     * @param html
     */
    escapeHTML(html:string):string {
        let elm = document.createElement('div');
        elm.appendChild(document.createTextNode(html));
        return elm.innerHTML;
    }

    /**
     * Cuts an end of a text. If a non-empty string is detected
     * at the end then additional characters up to the next whitespace
     * are removed.
     *
     * @param s
     * @param length
     */
    shortenText(s:string, length:number):string {
        let ans = s.substr(0, length);
        let items;

        if (ans.length > length && !/\s.|.\s/.exec(s.substr(length - 1, 2))) {
            items = ans.split(/\s+/);
            ans = items.slice(0, items.length - 1).join(' ');
        }
        if (ans.length < s.length) {
            ans += '...';
        }
        return ans;
    }

    /**
     * Appends an animated image symbolizing loading of data.
     *
     * @param elm
     * @param options
     * @return
     */
    appendLoader(elm:HTMLElement, options?:{domId:string; htmlClass:string}) {
        let jImage = $('<img />');

        options = options || {domId:null, htmlClass:null};
        jImage.attr('src', this.createStaticUrl('img/ajax-loader.gif'));
        if (options.domId) {
            jImage.addClass(options.domId);
        }
        if (options.htmlClass) {
            jImage.addClass(options.htmlClass);
        }
        $(elm).append(jImage);
        return jImage;
    }

    /**
     * JQuery-independent AJAX call.
     *
     * Notes:
     * - default contentType is 'application/x-www-form-urlencoded; charset=UTF-8'
     * - default accept is 'application/json'
     *
     * @param method A HTTP method (GET, POST, PUT,...)
     * @param url A URL of the resource
     * @param args Parameters to be passed along with request
     * @param options Additional settings
     */
    ajax<T>(method:string, url:string, args:AjaxArgs, options?:Kontext.AjaxOptions):RSVP.Promise<T> {
        if (options === undefined) {
            options = {};
        }
        if (!options.accept) {
            options.accept = 'application/json';
        }
        if (!options.contentType) {
            options.contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
        }

        function exportValue(v) {
            return v === null || v === undefined ? '' : encodeURIComponent(v);
        }

        function encodeArgs(obj) {
            const ans = [];
            let p; // ES5 issue
            for (p in obj) {
                if (obj.hasOwnProperty(p)) {
                    const val = obj[p] !== null && obj[p] !== undefined ? obj[p] : '';
                    if (Object.prototype.toString.apply(val) === '[object Array]') {
                        val.forEach(item => {
                            ans.push(encodeURIComponent(p) + '=' + exportValue(item));
                        });

                    } else {
                        ans.push(encodeURIComponent(p) + '=' + exportValue(val));
                    }
                }
            }
            return ans.join('&');
        }

        function decodeArgs(s) {
            let ans = {};
            s.split('&').map((s2)=>s2.split('=').map((s3)=>decodeURIComponent(s3))).forEach((item) => {
                ans[item[0]] = item[1];
            });
        }

        let body;

        if (args instanceof MultiDict) {
            body = this.encodeURLParameters(args);

        } else if (typeof args === 'object') {
            if (options.contentType === 'application/json') {
                body = JSON.stringify(args);

            } else {
                body = encodeArgs(args);
            }

        } else if (typeof args === 'string') {
            body = args;

        } else {
            throw new Error('ajax() error: unsupported args type ' + (typeof args));
        }

        if (method === 'GET') {
            let elms = url.split('?');
            if (!elms[1]) {
                url += '?' + body;

            } else {
                url += '&' + body;
            }
        }

        return rsvpAjax.requestObject<string>({
            accept: options.accept,
            contentType: options.contentType,
            method: method,
            requestBody: body,
            url: url
        }).then<T>(
            function (data:string) {
                switch (options.accept) {
                    case 'application/json':
                        return JSON.parse(data);
                    case 'application/x-www-form-urlencoded':
                        return decodeArgs(data);
                    default:
                        return data;
                }
            }
        );
    }

    /**
     * Pops-up a user message at the center of page. It is able
     * to handle process error-returned XMLHttpRequest objects
     * when using RSVP-ajax too.
     *
     * @param msgType - one of 'info', 'warning', 'error', 'plain'
     * @param message - text of the message
     */
    showMessage = (msgType:string, message:any, onClose?:()=>void) => {
        let timeout;
        let outMsg;

        if (msgType === 'error') {
            if (this.getConf<boolean>('isDebug')) {
                console.error(message);
            }
            if (message instanceof XMLHttpRequest) {
                if (message.statusText && message.status >= 400) {
                    outMsg = `${message.status}: ${message.statusText}`;

                } else {
                    const respText = (<XMLHttpRequest>message).responseText;
                    try {
                        let respObj = JSON.parse(respText);
                        if (respObj['contains_errors'] && respObj['messages']) {
                            outMsg = respObj['messages'].map(x => x[1]).join(', ');

                        } else {
                            outMsg = this.translate('global__unknown_error');
                        }

                    } catch (e) {
                        outMsg = String(respText).substr(100);
                    }
                }

            } else if (typeof message === 'object') {
                outMsg = (message['messages'] || ['Unknown error'])[0];

            } else {
                outMsg = String(message);
            }
        }
        this.messageStore.addMessage(msgType, outMsg, onClose);
    };

    /**
     * Modifies form (actually, it is always the #mainform)
     * in a way that only current corpus is changed. Under
     * normal circumstances, the form submits to the concordance
     * view page via POST method.
     *
     * @param event
     */
    formChangeCorpus(event:JQueryEventObject):void {
        let jqFormElm = $(event.target).closest('form');
        let subcorpSelect = $('#subcorp-selector');

        jqFormElm.attr('action', 'first_form');
        jqFormElm.attr('method', 'GET');
        if (subcorpSelect.val()) {
            subcorpSelect.val(null);
        }
        jqFormElm.submit();
    }

    /**
     * @param {HTMLElement|String|jQuery} elm
     * @param {String|jQuery} context checkbox context selector (parent element or list of checkboxes)
     */
    applySelectAll = function (elm, context) {
        let self = this;
        let jqElm = $(elm);
        let jqContext = $(context);
        let jqCheckboxes;
        let updateButtonStatus;

        if (jqContext.length === 1 && jqContext.get(0).nodeName !== 'INPUT') {
            jqCheckboxes = jqContext.find('input[type="checkbox"]:not(.select-all):not(:disabled)');

        } else {
            jqCheckboxes = jqContext;
        }

        updateButtonStatus = function () {
            let numChecked = jqCheckboxes.filter(':checked').length;

            if (jqCheckboxes.length > numChecked) {
                self.toggleSelectAllTrigger(elm, '1');

            } else {
                self.toggleSelectAllTrigger(elm, '2');
            }
        };

        jqCheckboxes.on('click', updateButtonStatus);
        updateButtonStatus();

        jqElm.off('click');
        jqElm.on('click', function (event) {
            let evtTarget = event.target;

            if ($(evtTarget).attr('data-status') === '1') {
                jqCheckboxes.each(function () {
                    this.checked = true;
                });
                self.toggleSelectAllTrigger(evtTarget);

            } else if ($(evtTarget).attr('data-status') === '2') {
                jqCheckboxes.each(function () {
                    this.checked = false;
                });
                self.toggleSelectAllTrigger(evtTarget);
            }
        });
    }

    /**
     *
     */
    bindStaticElements() {
        let self = this;
        let citationHtml = $('#corpus-citation-box').html();

        popupbox.extended(this.pluginApi()).bind(
            $('#positions-help-link'),
            self.translate('global__what_are_positions'),
            {width: '30%'}
        );

        // 'Select all' buttons for structural attribute lists
        $('table.envelope input[class="select-all"]').each(function () {
            self.applySelectAll(this, $(this).closest('table.envelope'));
        });

        // Footer's language switch
        $('#switch-language-box a').each(function () {
            let lang = $(this).data('lang');
            let form = $('#language-switch-form');
            $(this).bind('click', function () {
                $(form).find('input.language').val(lang);
                $(form).find('input.continue').val(window.location.href);
                form.submit();
            });
        });
    }

    timeoutMessages() {
        let timeout;
        let jqMessage = $('.message');

        if (jqMessage.length > 0 && this.conf['messageAutoHideInterval']) {
            timeout = win.setTimeout(function () {
                jqMessage.hide(200);
                win.clearTimeout(timeout);
                if (jqMessage.data('next-url')) {
                    win.location.href = jqMessage.data('next-url');
                }
            }, this.conf['messageAutoHideInterval']);
        }
    }

    initNotifications() {
        this.renderReactComponent(
            this.layoutViews.Messages, $('#content .messages-mount').get(0));

        (this.getConf<Array<any>>('notifications') || []).forEach((msg) => {
            this.messageStore.addMessage(msg[0], msg[1], null);
        });
    }

    mouseOverImages(context?) {
        context = context || win.document;

        $(context).find('.over-img').each(function () {
            let tmp;
            let activeElm;
            let img = this;
            let wrappingLink = $(img).closest('a');
            if (wrappingLink.length > 0) {
                activeElm = wrappingLink.get(0);

            } else {
                activeElm = img;
            }
            if ($(img).attr('data-alt-img')) {
                $(activeElm).off('mouseover.overimg');
                $(activeElm).on('mouseover.overimg', function () {
                    tmp = $(img).attr('src');
                    $(img).attr('src', $(img).attr('data-alt-img'));
                });
                $(activeElm).off('mouseout.overimg');
                $(activeElm).on('mouseout.overimg', function () {
                    $(img).attr('src', tmp);
                });
            }
        });
    }

    /**
     * @todo this is currently a Czech National Corpus specific solution
     */
    enhanceMessages() {
        $('.message .sign-in').each(function () {
            let text = $(this).text();
            let findSignInUrl;

            findSignInUrl = function () {
                return $('#cnc-toolbar-user a:nth-child(1)').attr('href');
            };

            $(this).replaceWith('<a href="' + findSignInUrl() + '">' + text + '</a>');
        });
    }

    /**
     *
     */
    externalHelpLinks() {
        let self = this;

        $('a.external-help').each(function () {
            let href = $(this).attr('href');
            let message = self.translate('global__more_info_at')
                    + ' <a href="' + href + '" target="_blank">' + href + '</a>';
            popupbox.bind(this, message, {});
        });
    }

    /**
     *
     */
    reload():void {
        win.document.location.reload();
    }

    /**
     * Creates unbound HTML tree containing message 'loading...'
     *
     * @returns {jQuery}
     */
    createAjaxLoader():JQuery {
        let loader = $(window.document.createElement('div'));
        loader
            .addClass('ajax-loading-msg')
            .css({
                'bottom' : '50px',
                'position' : 'fixed',
                'left' : ($(win).width() / 2 - 50) + 'px'
            })
            .append('<span>' + this.translate('global__loading') + '</span>');
        return loader;
    }

    /**
     *
     * @param msg
     * @returns {*}
     */
    translate(msg:string, values?:any):string {
        if (msg) {
            let tmp = this.translations[msg];
            if (tmp) {
                let format = new IntlMessageFormat(this.translations[msg], this.conf['uiLang']);
                return format.format(values);
            }
            return msg;
        }
        return '';
    }

    formatNumber(v:number):string {
        let format:any = new Intl.NumberFormat(this.conf['uiLang'], {
            maximumFractionDigits: 2
        });
        return format.format(v);
    }

    /**
     * @param d a Date object
     * @param timeFormat 0 = no time, 1 = hours + minutes, 2 = hours + minutes + seconds
     *  (hours, minutes and seconds are always in 2-digit format)
     */
    formatDate(d:Date, timeFormat:number=0):string {
        const opts = {year: 'numeric', month: '2-digit', day: '2-digit'};

        if (timeFormat > 0) {
            opts['hour'] = '2-digit';
            opts['minute'] = '2-digit';
        }
        if (timeFormat === 2) {
            opts['second'] = '2-digit';
        }
        return new Intl.DateTimeFormat(this.conf['uiLang'], opts).format(d);
    }

    /**
     * note: must preserve 'this'
     */
    createSmallAjaxLoader:()=>JQuery = () => {
        const elm = window.document.createElement('img');
        return $(elm)
            .attr('src', this.createStaticUrl('img/ajax-loader-bar.gif'))
            .attr('alt', this.translate('global__loading'))
            .attr('title', this.translate('global__loading'))
            .css({width: '16px', height: '11px'});
    }

    /**
     *
     */
    resetPlugins():void {
        for (let i = 0; i < this.pluginResets.length; i += 1) {
            this.pluginResets[i]();
        }
    }

    /**
     * Create a URL for a static resource (e.g. img/close-icon.svg)
     */
    createStaticUrl(path):string {
        if (typeof path !== 'string') {
            throw new Error(`Cannot create static url. Invalid path: ${path}`);
        }
        if (path.indexOf('/') === 0) {
            path = path.substr(1);
        }
        return this.getConf<string>('staticUrl') + path;
    }

    /**
     * Create an URL from path suffix. E.g. passing
     * subcorpus/list will produce http://installed.domain/subcorpus/list.
     *
     * @path path suffix
     * @args arguments to be appended to the URL as parameters
     */
    createActionUrl(path:string, args?:Array<[string,string]>):string {
        const staticPath = this.conf['rootPath'];
        let urlArgs = '';

        if (typeof path !== 'string') {
            throw new Error(`Cannot create action url. Invalid path: ${path}`);
        }

        if (args !== undefined) {
            urlArgs = args.map(item => {
                return encodeURIComponent(item[0]) + '=' + encodeURIComponent(item[1]);
            }).join('&');
        }
        if (path.indexOf('/') === 0) {
            path = path.substr(1);
        }
        return staticPath + path + (urlArgs ? '?' + urlArgs : '');
    }

    /**
     *
     * @param params
     * @returns {string}
     */
    encodeURLParameters(params:MultiDict):string {
        function exportValue(v) {
            return v === null || v === undefined ? '' : encodeURIComponent(v);
        }
        return params.items().map((item) => {
            return encodeURIComponent(item[0]) + '=' + exportValue(item[1]);
        }).join('&');
    }

    getConf<T>(item:string):T {
        return this.conf[item];
    }

    /**
     * Return a list of concordance arguments and their values. Multi-value keys
     * are preserved.
     * Output format: [[k1, v1_1], [k1, v1_2], ...., [kn, vn_1], ..., [kn, vn_m]]
     */
    getConcArgs():MultiDict {
        return new MultiDict(this.getConf<Array<Array<string>>>('currentArgs'));
    }

    setConcArg(name:string, value:any) {
        let tmp = new MultiDict(this.getConf<Array<Array<string>>>('currentArgs'));
        tmp.set(name, value);
        this.conf['currentArgs'] = tmp.items();
    }

    replaceConcArg(name:string, values:Array<string>):void {
        let tmp = new MultiDict(this.getConf<Array<Array<string>>>('currentArgs'));
        tmp.replace(name, values);
        this.conf['currentArgs'] = tmp.items();
    }

    /**
     * @param overwriteArgs a list of arguments whose values overwrite the current ones
     * @param appendArgs a list of arguments which will be appended to the existing ones
     */
    exportConcArgs(overwriteArgs:Kontext.MultiDictSrc, appendArgs?:Kontext.MultiDictSrc):string {
        const tmp = new MultiDict(this.getConf<Array<Array<string>>>('currentArgs'));

        function importArgs(args:Kontext.MultiDictSrc):Array<[string,string]> {
            if (!args) {
                return [];

            } else if (Object.prototype.toString.call(args) !== '[object Array]') {
                const impArgs:Array<[string,string]> = [];
                for (let p in args) {
                    if (args.hasOwnProperty(p)) {
                        impArgs.push([p, args[p]]);
                    }
                }
                return impArgs;

            } else {
                return <Array<[string,string]>>args;
            }
        }

        const overwriteArgs2 = importArgs(overwriteArgs);
        overwriteArgs2.forEach(item => {
            tmp.replace(item[0], []);
        });

        overwriteArgs2.concat(importArgs(appendArgs)).forEach(item => {
            tmp.add(item[0], item[1]);
        });
        return this.encodeURLParameters(tmp);
    }

    pluginApi():PluginApi {
        return new PluginApi(this);
    }


    // TODO dispatcher misuse (this should conform Flux pattern)
    private registerCoreEvents():void {
        const self = this;
        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            if (payload.props['message']) {
                self.showMessage(payload.props['msgType'], payload.props['message']);
            }
        });
    }

    hasPlugin(name:string):boolean {
        return this.getConf<Array<string>>('activePlugins').indexOf(name) > -1;
    }

    private initMainMenu():void {
        const menuViews = menuViewsInit(this.dispatcher, this.exportMixins(), this,
                this.getStores().asyncTaskInfoStore, this.layoutViews);
        const menuData = this.getConf<any>('menuData');
        this.renderReactComponent(
            menuViews.MainMenu,
            window.document.getElementById('main-menu-mount'),
            {submenuItems: Immutable.List(menuData['submenuItems'])}
        );
    }

    private initOverviewArea():void {
        const overviewViews = overviewAreaViewsInit(this.dispatcher, this.exportMixins(),
                this.corpusInfoStore, this.layoutViews.PopupBox);
        this.renderReactComponent(
            overviewViews.OverviewArea,
            window.document.getElementById('overview-area-mount'),
            {}
        );

        $(window.document.getElementById('corpus-desc-link')).on('click', () => {
            this.dispatcher.dispatch({
                actionType: 'OVERVIEW_CORPUS_INFO_REQUIRED',
                props: {
                    corpusId: this.getConf<string>('corpname')
                }
            });
        });

         $('#active-corpus').find('a.subcorpus').on('click', () => {
            this.dispatcher.dispatch({
                actionType: 'OVERVIEW_SHOW_SUBCORPUS_INFO',
                props: {
                    corpusId: this.getConf<string>('corpname'),
                    subcorpusId: this.getConf<string>('subcorpname')
                }
            });
         });
    }

    /**
     *
     */
    init():RSVP.Promise<any> {
        return new RSVP.Promise((resolve:(v:any)=>void, reject:(e:any)=>void) => {
            try {

                this.layoutViews = documentViewsInit(
                    this.dispatcher,
                    this.exportMixins(),
                    this.getStores()
                );

                window.onkeydown = (evt) => {
                    this.globalKeyHandlers.forEach(fn => fn(evt));
                }

                this.userSettings.init();
                this.initMainMenu();
                this.initOverviewArea();
                this.bindStaticElements();
                this.timeoutMessages();
                this.mouseOverImages();
                this.enhanceMessages();
                this.externalHelpLinks();
                this.initNotifications();
                this.asyncTaskChecker.init();

                this.initCallbacks.forEach(fn => fn());

                this.registerCoreEvents();

                resolve(null);

            } catch (e) {
                reject(e);
            }

        }).then(
            () => {
                applicationBar.create(this.pluginApi());
            }
        ).then(
            () => {
                footerBar.create(this.pluginApi());
            }
        );
    }
}



export class PluginApi implements Kontext.PluginApi {

    pageModel:PageModel;

    constructor(pageModel:PageModel) {
        this.pageModel = pageModel;
    }

    getConf<T>(key:string):T {
        return this.pageModel.getConf<T>(key);
    }

    createStaticUrl(path) {
        return this.pageModel.createStaticUrl(path);
    }

    createActionUrl(path:string, args?:Array<[string,string]>) {
        return this.pageModel.createActionUrl(path, args);
    }

    ajax<T>(method:string, url:string, args:any, options:Kontext.AjaxOptions):RSVP.Promise<T> {
        return this.pageModel.ajax.call(this.pageModel, method, url, args, options);
    }

    ajaxAnim() {
        return this.pageModel.createAjaxLoader.apply(this.pageModel, arguments);
    }

    ajaxAnimSmall() {
        return this.pageModel.createSmallAjaxLoader.apply(this.pageModel, arguments);
    }

    appendLoader(elm:HTMLElement) {
        return this.pageModel.appendLoader(elm);
    }

    showMessage(type, message, onClose) {
        return this.pageModel.showMessage(type, message, onClose);
    }

    translate(msg, values?) {
        return this.pageModel.translate(msg, values);
    }

    formatNumber(v) {
        return this.pageModel.formatNumber(v);
    }

    formatDate(d:Date, timeFormat:number=0):string {
        return this.pageModel.formatDate(d, timeFormat);
    }

    applySelectAll(elm, context) {
        this.pageModel.applySelectAll(elm, context);
    }

    registerReset(fn) {
        this.pageModel.pluginResets.push(fn);
    }

    userIsAnonymous():boolean {
        return this.getConf<boolean>('anonymousUser');
    }

    formChangeCorpus(event) {
        return this.pageModel.formChangeCorpus(event);
    }

    shortenText(s, length) {
        return this.pageModel.shortenText(s, length);
    }

    dispatcher() {
        return this.pageModel.dispatcher;
    }

    exportMixins(...mixins:any[]):any[] {
        return this.pageModel.exportMixins(...mixins);
    }

    renderReactComponent(reactClass:React.ReactClass,
            target:HTMLElement, props?:React.Props):void {
        this.pageModel.renderReactComponent(reactClass, target, props);
    }

    unmountReactComponent(element:HTMLElement):boolean {
        return this.pageModel.unmountReactComponent(element);
    }

    getStores():Kontext.LayoutStores {
        return this.pageModel.getStores();
    }

    getViews():Kontext.LayoutViews {
        return this.pageModel.layoutViews;
    }

    getUserSettings():Kontext.IUserSettings {
        return this.pageModel.userSettings;
    }

    hasPlugin(name:string):boolean {
        return this.pageModel.hasPlugin(name);
    }

    getConcArgs():MultiDict {
        return this.pageModel.getConcArgs();
    }
}