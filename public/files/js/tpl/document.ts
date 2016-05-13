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

/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../../ts/declarations/common.d.ts" />
/// <reference path="../../ts/declarations/react.d.ts" />
/// <reference path="../../ts/declarations/flux.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />
/// <reference path="../../ts/declarations/rsvp-ajax.d.ts" />
/// <reference path="../../ts/declarations/intl-messageformat.d.ts" />
/// <reference path="../../ts/declarations/translations.d.ts" />
/// <reference path="../../ts/declarations/popupbox.d.ts" />
/// <reference path="../../ts/declarations/immutable.d.ts" />
/// <reference path="../../ts/declarations/abstract-plugins.d.ts" />

import win = require('win');
import $ = require('jquery');
import popupbox = require('popupbox');
import applicationBar = require('plugins/applicationBar/init');
import footerBar = require('plugins/footerBar/init');
import flux = require('vendor/Dispatcher');
import documentViews = require('views/document');
import React = require('vendor/react');
import ReactDOM = require('vendor/react-dom');
import RSVP = require('vendor/rsvp');
import rsvpAjax = require('vendor/rsvp-ajax');
import util = require('../util');
import docStores = require('../stores/documentStores');
import userStores = require('../stores/userStores');
import translations = require('translations');
import IntlMessageFormat = require('vendor/intl-messageformat');
import Immutable = require('vendor/immutable');
import asyncTask = require('../asyncTask');
import userSettings = require('../userSettings');
import initActions = require('../initActions');
import menu = require('../menu');

/**
 *
 */
class NullStorage implements Storage {
    key(idx:number):string {
        return null
    }

    getItem(key:string) {
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
 *
 */
export class PageModel implements Kontext.PluginProvider {

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
     *
     */
    mainMenu:menu.MainMenu;

    /**
     * Results of partial page initializations.
     */
    initActions:initActions.InitActions;

    /**
     * Local user settings
     */
    userSettings:userSettings.UserSettings;

    /**
     * React component classes
     */
    layoutViews:Kontext.LayoutViews;

    corpusInfoStore:docStores.CorpusInfoStore;

    messageStore:docStores.MessageStore;

    queryHintStore:docStores.QueryHintStore;

    userInfoStore:userStores.UserInfo;

    /**
     * A dictionary containing translations for current UI language (conf['uiLang']).
     */
    private translations:{[key:string]:string};

    private asyncTaskChecker:asyncTask.AsyncTaskChecker;

    /**
     *
     * @param conf
     */
    constructor(conf:Kontext.Conf) {
        this.conf = conf;
        this.dispatcher = new flux.Dispatcher<Kontext.DispatcherPayload>();
        this.plugins = {};
        this.initCallbacks = [];
        this.mainMenu = new menu.MainMenu(this.pluginApi());
        this.initActions = new initActions.InitActions();
        this.userSettings = new userSettings.UserSettings(getLocalStorage(), 'kontext_ui',
                '__timestamp__', this.conf['uiStateTTL']);
        this.corpusInfoStore = new docStores.CorpusInfoStore(this.pluginApi(), this.dispatcher);
        this.messageStore = new docStores.MessageStore(this.pluginApi(), this.dispatcher);
        this.queryHintStore = new docStores.QueryHintStore(this.dispatcher, conf['queryHints']);
        this.userInfoStore = new userStores.UserInfo(this, this.dispatcher);
        this.translations = translations[this.conf['uiLang']] || {};
        this.asyncTaskChecker = new asyncTask.AsyncTaskChecker(this.pluginApi(),
                this.getConf<any>('asyncTasks') || []);
    }

    /**
     *
     * @returns
     */
    getStores():Kontext.LayoutStores {
        return {
            corpusInfoStore: this.corpusInfoStore,
            messageStore: this.messageStore,
            queryHintStore: this.queryHintStore,
            userInfoStore: this.userInfoStore
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
            createActionLink(path:string):string {
                return self.createActionUrl(path);
            },
            createStaticUrl(path:string):string {
                return self.createStaticUrl(path);
            },
            getLayoutViews():Kontext.LayoutViews {
                return self.layoutViews;
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
     * Adds a plug-in to the model. In general, it is not
     * required to do this on a page using some plug-in but
     * in that case it will not be possible to use plug-in
     * related methods of document.js model.
     *
     * @param name
     * @param plugin
     */
    registerPlugin(name:string, pluginPromise:RSVP.Promise<Kontext.Plugin>) {
        pluginPromise.then((plugin:Kontext.Plugin) => {
            this.plugins[name] = plugin;
        });
    }

    /**
     * @param name
     */
    getPlugin<T extends Kontext.Plugin>(name:string):T {
        return this.plugins[name];
    }

    /**
     * Calls a function on a registered plug-in with some additional
     * testing of target's callability.
     *
     * @param {string} name
     * @param {string} fn
     * @param {string} [args]
     * @return the same value as called plug-in method
     */
    callPlugin(name:string, fn:string, args?:any[]) {
        if (typeof this.plugins[name] === 'object'
            && typeof this.plugins[name][fn] === 'function') {
            return this.plugins[name][fn].apply(this.plugins[name][fn], args);

        } else {
            throw new Error("Failed to call method " + fn + " on plug-in " + name);
        }
    }

    /**
     * Registers a callback called during model initialization.
     * It can be either a function or an object specifying plug-in's function
     * ({plugin : 'name', 'method' : 'method name', 'args' : [optional array of arguments]})
     * @param fn
     */
    registerInitCallback(fn:Kontext.InitCallback):void;
    registerInitCallback(fn:()=>void):void;
    registerInitCallback(fn):void {
        let self = this;

        if (typeof fn === 'function') {
            this.initCallbacks.push(fn);

        } else if (typeof fn === 'object' && fn['plugin'] && fn['method']) {
            this.initCallbacks.push(function () {
                self.callPlugin(fn['plugin'], fn['method'], fn['args']);
            });

        } else {
            throw new Error('Registered invalid callback');
        }
    }

    addOnAsyncTaskUpdate(fn:Kontext.AsyncTaskOnUpdate) {
        this.asyncTaskChecker.addOnUpdate(fn);
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
     * Normalizes error representation (sometimes it is a string,
     * sometimes it is an object) into an object with well defined
     * properties.
     *
     * @param obj
     */
    unpackError(obj):{message:string; error:Error; reset:boolean} {
        let ans:{message:string; error:Error; reset:boolean} = {message:null, error:null, reset:null};

        if (typeof obj === 'object') {
            ans.message = obj.message;
            ans.error = obj.error;
            ans.reset = obj.reset || false;

        } else {
            ans.message = obj;
            ans.error = null;
            ans.reset = false;
        }
        return ans;
    }

    /**
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
     * @param method A HTTP method (GET, POST, PUT,...)
     * @param url A URL of the resource
     * @param args Parameters to be passed along with request
     * @param options Additional settings
     */
    ajax<T>(method:string, url:string, args:any, options?:Kontext.AjaxOptions):RSVP.Promise<T> {
        if (!options) {
            options = {};
        }
        if (!options.accept) {
            options.accept = 'application/json';
        }
        if (!options.contentType) {
            options.contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
        }

        function encodeArgs(obj) {
            let ans = [];
            let p;
            for (p in obj) {
                if (obj.hasOwnProperty(p)) {
                    let val = obj[p] !== null && obj[p] !== undefined ? obj[p] : '';
                    if (Object.prototype.toString.apply(val) === '[object Array]') {
                        ans = ans.concat(val.map((item) => encodeURIComponent(p) + '=' + encodeURIComponent(item)));

                    } else {
                        ans.push(encodeURIComponent(p) + '=' + encodeURIComponent(val));
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
        if (typeof args === 'object') {
            if (options.contentType === 'application/json') {
                body = JSON.stringify(args);

            } else {
                body = encodeArgs(args);
            }
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
                if (options.accept === 'application/json') {
                    return JSON.parse(data);

                } else {
                    return decodeArgs(data);
                }
            }
        );
    }

    /**
     * @param msgType - one of 'info', 'warning', 'error', 'plain'
     * @param message - text of the message
     */
    showMessage = (msgType:string, message:string, onClose?:()=>void) => {
        let timeout;
        let self = this;

        if (typeof message === 'object' && msgType === 'error') {
            message = message['message'];
        }
        this.messageStore.addMessage(msgType, message, onClose);
    };

    /**
     * Transforms an existing element into a context help link with bound pop-up message.
     *
     * @param triggerElm - an element to be transformed into a context help link
     * @param text - a text of the help message
     */
    contextHelp(triggerElm:HTMLElement, text:string):void {
        let image = win.document.createElement('img');

        $(triggerElm).addClass('context-help');
        $(image).attr('data-alt-img', this.createStaticUrl('img/question-mark_s.svg'))
            .attr('src', this.createStaticUrl('img/question-mark.svg'))
            .addClass('over-img');
        $(triggerElm).append(image);
        popupbox.bind(triggerElm, text, {width: 'nice'});
    }

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
     *
     * @param value
     * @param groupSepar - separator character for thousands groups
     * @param radixSepar - separator character for integer and fractional parts
     */
    formatNum(value:number|string, groupSepar:string, radixSepar:string):string {
        let offset = 0;
        let numParts = value.toString().split('.');
        let s:Array<string> = numParts[0].split('').reverse();
        let len = s.length;
        for (let i = 3; i < len; i += 3) {
            s.splice(i + offset, 0, groupSepar);
            offset += 1;
        }
        let ans = s.reverse().join('');
        if (numParts[1] !== undefined) {
            ans += radixSepar + numParts[1];
        }
        return ans;
    }

    /**
     * Renders a query overview within tooltipBox
     * instance based on provided data
     *
     * @param data
     * @param {TooltipBox} tooltipBox
     */
    renderOverview = function (data, tooltipBox):void {
        let self = this;
        let url;
        let html = '<h3>' + this.translate('global__query_overview') + '</h3><table border="1">';
        let parentElm = tooltipBox.getRootElement();

        html += '<tr><th>' + self.translate('global__operation') + '</th>';
        html += '<th>' + self.translate('global__parameters') + '</th>';
        html += '<th>' + self.translate('global__num_of_hits') + '</th><th></th></tr>';

        $.each(data.Desc, function (i, item:{op:string; arg:string; size:number; tourl:string}) {
            html += '<tr><td>' + self.escapeHTML(item.op) + '</td>';
            html += '<td>' + self.escapeHTML(item.arg) + '</td>';
            html += '<td>' + self.escapeHTML(item.size) + '</td>';
            html += '<td>';
            if (item.tourl) {
                url = 'view?' + item.tourl;
                html += '<a href="' + url + '">' + self.translate('global__view_result') + '</a>';
            }
            html += '</td>';
            html += '</tr>';
        });
        html += '</table>';
        $(parentElm).html(html);
    }

    /**
     *
     */
    queryOverview() {
        let escKeyEventHandlerFunc;
        let self = this;

        escKeyEventHandlerFunc = function (boxInstance) {
            return function (event) {
                if (event.keyCode === 27) {
                    $('#conclines tr.active').removeClass('active');
                    if (boxInstance) {
                        boxInstance.close();
                    }
                    $(document).off('keyup.query_overview');
                }
            };
        };

        // query overview
        $('#query-overview-trigger').on('click', function (event) {
            let reqUrl = $(event.target).data('json-href');

            $.ajax(reqUrl, {
                dataType: 'json',
                success: function (data) {
                    let box;
                    let leftPos;

                    if (data.Desc) {
                        box = popupbox.extended(self.pluginApi()).open(
                            function (box2, finalize) {
                                self.renderOverview(data, box2);
                                finalize();
                            },
                            null,
                            {
                                type: 'plain',
                                domId: 'query-overview',
                                htmlClass: 'query-overview',
                                closeIcon: true,
                                calculatePosition: false,
                                timeout: null
                            }
                        );
                        leftPos = $(window).width() / 2 - box.getPosition().width / 2;
                        box.setCss('left', leftPos + 'px');

                        $(win.document).on('keyup.query_overview', escKeyEventHandlerFunc(box));

                    } else {
                        self.showMessage('error', self.translate('global__failed_to_load_query_overview'));
                    }
                },
                error: function () {
                    self.showMessage('error', self.translate('global__failed_to_load_query_overview'));
                }
            });
            event.preventDefault();
            event.stopPropagation();
            return false;
        });
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
     * @returns {$.Deferred.Promise}
     */
    bindCorpusDescAction() {
        let self = this;
        let jqDescLink = $('#corpus-desc-link');

        popupbox.extended(self.pluginApi()).bind(jqDescLink,
            function (box, finalize) {
                let actionRegId;

                // TODO - please note this is not Flux pattern at all; it will be fixed
                actionRegId = self.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
                    if (payload.actionType === 'ERROR') {
                        box.close();
                        self.dispatcher.unregister(actionRegId);
                    }
                });
                self.renderReactComponent(self.layoutViews.CorpusInfoBox,
                        box.getRootElement(), {doneCallback: finalize.bind(self)});
            },
            {
                width: 'nice',
                closeIcon: true,
                type: 'plain',
                timeout: 0,
                onClose: function () {
                    self.unmountReactComponent(this.getRootElement());
                }
            }
        );
    }

    bindSubcorpusDescAction() {
        let triggerLink = $('#active-corpus').find('a.subcorpus');
        let self = this;

        popupbox.bind(
            triggerLink,
            function (box, finalize) {
                let prom:RSVP.Promise<any> = self.ajax<any>(
                    'GET',
                    self.createActionUrl('subcorpus/ajax_subcorp_info'),
                    {
                        'corpname': self.getConf('corpname'),
                        'subcname': self.getConf('subcorpname')
                    },
                    {
                        contentType : 'application/x-www-form-urlencoded'
                    }
                );
                prom.then(
                    function (data) {
                        if (!data['contains_errors']) {
                            self.renderReactComponent(
                                self.layoutViews.SubcorpusInfo,
                                box.getRootElement(),
                                {
                                    doneCallback: finalize.bind(self),
                                    corpname: data['corpusName'],
                                    name: data['subCorpusName'],
                                    size: data['subCorpusSize'],
                                    cql: data['extended_info']['cql']
                                }
                            );

                        } else {
                            self.showMessage('error', data['error']);
                        }
                    },
                    function (err) {
                        self.showMessage('error', err);
                    }
                );
            },
            {
                width: 'nice',
                closeIcon: true,
                type: 'plain',
                timeout: 0,
                domId: 'subcorpus-info-box',
                onClose: function () {
                    self.unmountReactComponent(this.getRootElement());
                }
            }
        );
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
        let format:any = new Intl.NumberFormat(this.conf['uiLang']);
        return format.format(v);
    }

    formatDate(d:Date):string {
        let format:any = new Intl.DateTimeFormat(this.conf['uiLang']);
        return format.format(d);
    }

    /**
     * note: must preserve 'this'
     */
    createSmallAjaxLoader:()=>JQuery = () => {
        return $('<img src="' + this.createStaticUrl('img/ajax-loader.gif') + '" '
            + 'alt="' + this.translate('global__loading') + '" '
            + 'title="' + this.translate('global__loading') + '" '
            + 'style="width: 24px; height: 24px" />');
    };

    /**
     *
     */
    resetPlugins():void {
        for (let i = 0; i < this.pluginResets.length; i += 1) {
            this.pluginResets[i]();
        }
    }

    createStaticUrl(path) {
        let staticPath = this.conf['staticUrl'];

        if (path.indexOf('/') === 0) {
            path = path.substr(1);
        }
        return staticPath + path;
    }

    createActionUrl(path) {
        let staticPath = this.conf['rootPath'];

        if (path.indexOf('/') === 0) {
            path = path.substr(1);
        }
        return staticPath + path;
    }

    /**
     *
     * @param params
     * @returns {string}
     */
    encodeURLParameters(params:{[key:string]:any}):string {
        let ans = [];
        for (let p in params) {
            if (params.hasOwnProperty(p)) {
                let v = params[p];
                if (Object.prototype.toString.call(v) !== '[object Array]') {
                    v = [v];
                }
                for (let i = 0; i < v.length; i += 1) {
                    ans.push(encodeURIComponent(p) + '=' + encodeURIComponent(v[i]));
                }
            }
        }
        return ans.join('&');
    }

    getConf<T>(item:string):T {
        return this.conf[item];
    }

    pluginApi():PluginApi {
        return new PluginApi(this);
    }


    // TODO dispatcher misuse (this should conform Flux pattern)
    private registerCoreEvents():void {
        let self = this;

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            if (payload.props['message']) {
                self.showMessage(payload.props['msgType'], payload.props['message']);
            }
        });
    }

    hasPlugin(name:string):boolean {
        return this.getConf<Array<string>>('activePlugins').indexOf(name) > -1;
    }

    /**
     *
     */
    init():initActions.InitActions {
        let self = this;

        this.layoutViews = documentViews.init(this.dispatcher, this.exportMixins(),
                this.getStores());

        this.userSettings.init();

        this.initActions.add({
            bindStaticElements: self.bindStaticElements(),
            bindCorpusDescAction: self.bindCorpusDescAction(),
            bindSubcorpusDescAction: self.bindSubcorpusDescAction(),
            queryOverview: self.queryOverview(),
            mainMenuInit: self.mainMenu.init(),
            timeoutMessages: self.timeoutMessages(),
            mouseOverImages: self.mouseOverImages(),
            enhanceMessages: self.enhanceMessages(),
            externalHelpLinks: self.externalHelpLinks(),
            showNotification: self.initNotifications(),
            initAsyncTaskChecking: self.asyncTaskChecker.init()
        });

        // init plug-ins
        this.registerPlugin('applicationBar', applicationBar.create(self.pluginApi()));
        this.registerPlugin('footerBar', footerBar.create(self.pluginApi()));

        $.each(this.initCallbacks, function (i, fn:()=>void) {
            fn();
        });

        this.registerCoreEvents();

        return this.initActions;
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

    createActionUrl(path) {
        return this.pageModel.createActionUrl(path);
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

    formatDate(v) {
        return this.pageModel.formatDate(v);
    }

    applySelectAll(elm, context) {
        this.pageModel.applySelectAll(elm, context);
    }

    registerReset(fn) {
        this.pageModel.pluginResets.push(fn);
    }

    registerInitCallback(fn:Kontext.InitCallback):void;
    registerInitCallback(fn:()=>void):void;
    registerInitCallback(fn):void {
        return this.pageModel.registerInitCallback(fn);
    }

    userIsAnonymous():boolean {
        return this.getConf<boolean>('anonymousUser');
    }

    contextHelp(triggerElm, text) {
        return this.pageModel.contextHelp(triggerElm, text);
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

    getPlugin<T extends Kontext.Plugin>(name:string) {
        return this.pageModel.getPlugin<T>(name);
    }

    getUserSettings():Kontext.IUserSettings {
        return this.pageModel.userSettings;
    }

    hasPlugin(name:string):boolean {
        return this.pageModel.hasPlugin(name);
    }
}