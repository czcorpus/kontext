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

import win = require('win');
import $ = require('jquery');
import popupbox = require('popupbox');
import applicationBar = require('plugins/applicationBar/init');
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
 * Functions required by KonText's React components
 */
export interface ComponentCoreMixins {

    translate(s:string, values?:any):string;

    getConf(k:string):any;

    createActionLink(path:string):string;

    createStaticUrl(path:string):string;
}


interface AsyncTaskResponse extends Kontext.AjaxResponse {
    num_remaining?: number;
    data?:Array<Kontext.AsyncTaskInfo>;
    contains_errors: boolean;
}

/**
 * This class handles checking for the state
 * of currently active bacground tasks triggered
 * by user.
 */
export class AsyncTaskChecker {

    private pageModel:PageModel;

    private asyncTasks:Immutable.List<Kontext.AsyncTaskInfo>;

    private onUpdate:Immutable.List<Kontext.AsyncTaskOnUpdate>;

    private asyncTaskCheckerInterval:number;

    static CHECK_INTERVAL = 10000;


    constructor(pageModel:PageModel, conf:any) {
        this.pageModel = pageModel;
        this.asyncTasks = Immutable.List<Kontext.AsyncTaskInfo>(conf.map((item) => {
            return {
                status: conf['status'],
                ident: conf['ident'],
                created: conf['created'],
                label: conf['label'],
                category: conf['category'],
                error: conf['error'],
                args: conf['args']
            }
        }));
        this.asyncTaskCheckerInterval = null;
        this.onUpdate = Immutable.List<Kontext.AsyncTaskOnUpdate>();
    }

    private checkForStatus():RSVP.Promise<AsyncTaskResponse> {
         return this.pageModel.ajax(
            'GET',
            this.pageModel.createActionUrl('check_tasks_status'),
            {},
            {contentType : 'application/x-www-form-urlencoded'}
        );
    }

    private deleteTaskInfo(taskIds:Array<string>):RSVP.Promise<AsyncTaskResponse> {
        return this.pageModel.ajax(
            'DELETE',
            this.pageModel.createActionUrl('remove_task_info'),
            {'tasks': taskIds},
            {contentType : 'application/x-www-form-urlencoded'}
        );
    }

    private getFinishedTasks():Immutable.List<Kontext.AsyncTaskInfo> {
        return this.asyncTasks.filter((item)=>(item.status === 'SUCCESS' || item.status === 'FAILURE')).toList();
    }

    private createTaskDesc(taskInfo:Kontext.AsyncTaskInfo) {
        let label = taskInfo.label ? taskInfo.label : taskInfo.ident.substr(0, 8) + '...';
        let desc = taskInfo.error ? taskInfo.status + ': ' + taskInfo.error : taskInfo.status;
        return label + ' (' + desc + ')';
    }

    /**
     * Adds a handler triggered when task information is
     * received from server.
     */
    addOnUpdate(fn:Kontext.AsyncTaskOnUpdate):void {
        this.onUpdate = this.onUpdate.push(fn);
    }

    init():void {
        if (this.asyncTasks.size > 0 && !this.asyncTaskCheckerInterval) {
            this.asyncTaskCheckerInterval = window.setInterval(() => {
                this.checkForStatus().then(
                    (data) => {
                        if (!data.contains_errors) {
                            this.asyncTasks = Immutable.List<Kontext.AsyncTaskInfo>(data.data);
                            if (this.asyncTasks.size === 0) {
                                window.clearInterval(this.asyncTaskCheckerInterval);

                            } else {
                                let finished = this.getFinishedTasks();
                                if (finished.size > 0) {
                                    window.clearInterval(this.asyncTaskCheckerInterval);
                                    this.onUpdate.forEach(item => {
                                        item(finished);
                                    });
                                    let info = finished.map((item) => this.createTaskDesc(item))
                                            .join(', ');
                                    this.pageModel.showMessage(
                                        'mail',
                                        this.pageModel.translate('global__these_task_are_finished') + ': ' + info,
                                        () => {
                                            this.deleteTaskInfo(finished.map(item => item.ident).toArray()).then(
                                                (data) => {
                                                    if (data.num_remaining > 0) {
                                                        this.init();
                                                    }
                                                },
                                                (err) => {
                                                    this.pageModel.showMessage('error', err);
                                                }
                                            )
                                        }
                                    );
                                }
                            }

                        } else {
                            this.pageModel.showMessage('error', data.messages.join(', '));
                        }
                    },
                    (err) => {
                        this.pageModel.showMessage('error', err);
                    }
                )
            }, AsyncTaskChecker.CHECK_INTERVAL);
        }
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
    mainMenu:MainMenu;

    /**
     * Results of partial page initializations.
     */
    initActions:InitActions;

    /**
     * Local user settings
     */
    userSettings:UserSettings;

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

    private asyncTaskChecker:AsyncTaskChecker;

    /**
     *
     * @param conf
     */
    constructor(conf:Kontext.Conf) {
        this.conf = conf;
        this.dispatcher = new flux.Dispatcher<Kontext.DispatcherPayload>();
        this.plugins = {};
        this.initCallbacks = [];
        this.mainMenu = new MainMenu(this);
        this.initActions = new InitActions();
        this.userSettings = new UserSettings(getLocalStorage(), 'kontext_ui', '__timestamp__',
            this.conf['uiStateTTL']);
        this.corpusInfoStore = new docStores.CorpusInfoStore(this.pluginApi(), this.dispatcher);
        this.messageStore = new docStores.MessageStore(this.pluginApi(), this.dispatcher);
        this.queryHintStore = new docStores.QueryHintStore(this.dispatcher, conf['queryHints']);
        this.userInfoStore = new userStores.UserInfo(this, this.dispatcher);
        this.translations = translations[this.conf['uiLang']] || {};
        this.asyncTaskChecker = new AsyncTaskChecker(this, this.getConf<any>('asyncTasks') || []);
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
        var self = this;
        var componentTools:ComponentCoreMixins = {
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
        var currValue:string,
            newValue:string;

        if (!$(selectAllElm).attr('data-status')) {
            $(selectAllElm).attr('data-status', '1');
        }
        currValue = $(selectAllElm).attr('data-status');
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
    registerPlugin(name:string, plugin:Kontext.Plugin) {
        this.plugins[name] = plugin;
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
        var self = this;

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
        var elm = document.createElement('div');
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
        var ans = s.substr(0, length),
            items;

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
        var ans:{message:string; error:Error; reset:boolean} = {message:null, error:null, reset:null};

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
        var jImage = $('<img />');

        options = options || {domId:null, htmlClass:null};
        jImage.attr('src', '../files/img/ajax-loader.gif');
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
        var timeout,
            self = this;

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
        var image = win.document.createElement('img');

        $(triggerElm).addClass('context-help');
        $(image).attr('data-alt-img', '../files/img/question-mark_s.svg')
            .attr('src', '../files/img/question-mark.svg')
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
        var jqFormElm = $(event.target).closest('form'),
            subcorpSelect = $('#subcorp-selector');

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
        var i,
            offset = 0,
            len,
            numParts,
            s;

        numParts = value.toString().split('.');
        s = numParts[0].split('').reverse();
        len = s.length;
        for (i = 3; i < len; i += 3) {
            s.splice(i + offset, 0, groupSepar);
            offset += 1;
        }
        s = s.reverse().join('');
        if (numParts[1] !== undefined) {
            s += radixSepar + numParts[1];
        }
        return s;
    }

    /**
     * Renders a query overview within tooltipBox
     * instance based on provided data
     *
     * @param data
     * @param {TooltipBox} tooltipBox
     */
    renderOverview = function (data, tooltipBox):void {
        var self = this,
            url,
            html = '<h3>' + this.translate('global__query_overview') + '</h3><table border="1">',
            parentElm = tooltipBox.getRootElement();

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
        var escKeyEventHandlerFunc,
            self = this;

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
            var reqUrl = $(event.target).data('json-href');

            $.ajax(reqUrl, {
                dataType: 'json',
                success: function (data) {
                    var box,
                        leftPos;

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
        var self = this,
            jqElm = $(elm),
            jqContext = $(context),
            jqCheckboxes,
            updateButtonStatus;

        if (jqContext.length === 1 && jqContext.get(0).nodeName !== 'INPUT') {
            jqCheckboxes = jqContext.find('input[type="checkbox"]:not(.select-all):not(:disabled)');

        } else {
            jqCheckboxes = jqContext;
        }

        updateButtonStatus = function () {
            var numChecked = jqCheckboxes.filter(':checked').length;

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
            var evtTarget = event.target;

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
        var self = this,
            jqDescLink = $('#corpus-desc-link');

        popupbox.extended(self.pluginApi()).bind(jqDescLink,
            function (box, finalize) {
                var actionRegId;

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
        var self = this,
            citationHtml = $('#corpus-citation-box').html();

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
            $(this).bind('click', function () {
                self.userSettings.set('set_uilang', $(this).data('lang'));
                win.location.reload();
            });
        });
    }

    timeoutMessages() {
        var timeout,
            jqMessage = $('.message');

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
            var tmp,
                wrappingLink,
                activeElm,
                img = this;

            wrappingLink = $(img).closest('a');
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
            var text = $(this).text(),
                findSignInUrl;

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
        var self = this;

        $('a.external-help').each(function () {
            var href = $(this).attr('href'),
                message = self.translate('global__more_info_at')
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
        var tmp;
        var format;

        if (msg) {
            tmp = this.translations[msg];
            if (tmp) {
                format = new IntlMessageFormat(this.translations[msg], this.conf['uiLang']);
                return format.format(values);
            }
            return msg;
        }
        return '';
    }

    formatNumber(v:number):string {
        var format:any = new Intl.NumberFormat(this.conf['uiLang']);
        return format.format(v);
    }

    formatDate(d:Date):string {
        var format:any = new Intl.DateTimeFormat(this.conf['uiLang']);
        return format.format(d);
    }

    /**
     * note: must preserve 'this'
     */
    createSmallAjaxLoader:()=>JQuery = () => {
        return $('<img src="../files/img/ajax-loader.gif" '
            + 'alt="' + this.translate('global__loading') + '" '
            + 'title="' + this.translate('global__loading') + '" '
            + 'style="width: 24px; height: 24px" />');
    };

    /**
     *
     */
    resetPlugins():void {
        for (var i = 0; i < this.pluginResets.length; i += 1) {
            this.pluginResets[i]();
        }
    }

    createStaticUrl(path) {
        var staticPath = this.conf['staticUrl'];

        if (path.indexOf('/') === 0) {
            path = path.substr(1);
        }
        return staticPath + path;
    }

    createActionUrl(path) {
        var staticPath = this.conf['rootPath'];

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
        var ans = [],
            v;

        for (var p in params) {
            if (params.hasOwnProperty(p)) {
                v = params[p];
                if (Object.prototype.toString.call(v) !== '[object Array]') {
                    v = [v];
                }
                for (var i = 0; i < v.length; i += 1) {
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
        var self = this;

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            if (payload.props['message']) {
                self.showMessage(payload.props['msgType'], payload.props['message']);
            }
        });
    }

    /**
     *
     */
    init():InitActions {
        var self = this;

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
        this.registerPlugin('applicationBar', applicationBar.createInstance(self.pluginApi()));

        $.each(this.initCallbacks, function (i, fn:()=>void) {
            fn();
        });

        this.registerCoreEvents();

        return this.initActions;
    }
}


/**
 * KonText main menu
 */
export class MainMenu {

    /**
     * Wrapping element for whole main-menu
     */
    jqMenuBar:JQuery;

    private activeSubmenu:HTMLElement;

    private layoutModel:PageModel;


    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
        this.jqMenuBar = $('#menu-bar');
    }

    getActiveSubmenu():HTMLElement {
        return this.activeSubmenu;
    }

    /**
     * @param {string} id
     */
    setActiveSubmenu(submenu:HTMLElement) {
        this.activeSubmenu = submenu;
    }

    /**
     * @param {string} [menuId]
     */
    closeSubmenu(menuId?) {
        if (this.activeSubmenu) {
            $(this.activeSubmenu).css('display', 'none');
            $(this.activeSubmenu).closest('li').removeClass('active');
            this.activeSubmenu = null;
        }
    }

    /**
     *
     * @param li
     * @returns {*}
     */
    private getHiddenSubmenu(li):JQuery {
        return $(li).find('ul');
    }

    private initCustomHelp():void {
        let self = this;
        let jqSubmenu = $('#menu-help').find('ul.submenu');
        let liElm = window.document.createElement('li');
        let aElm = window.document.createElement('a');

        jqSubmenu.append(liElm);
        $(aElm).text(this.layoutModel.translate('global__how_to_cite_corpus'));
        $(liElm)
            .addClass('separ')
            .append(aElm);

        function createContents(tooltipBox, finalize) {
            tooltipBox.setCss('top', '25%');
            tooltipBox.setCss('left', '20%');
            tooltipBox.setCss('width', '60%');
            tooltipBox.setCss('height', 'auto');

            let prom:RSVP.Promise<any> = self.layoutModel.ajax<any>(
                'GET',
                self.layoutModel.createActionUrl('corpora/ajax_get_corp_details'),
                {
                    'corpname': self.layoutModel.getConf('corpname')
                },
                {
                    contentType : 'application/x-www-form-urlencoded'
                }
            );

            prom.then(
                function (data) {
                    self.layoutModel.renderReactComponent(
                        self.layoutModel.layoutViews.CorpusReference,
                        tooltipBox.getRootElement(),
                        {
                            citation_info: data['citation_info'] || {},
                            doneCallback: finalize.bind(self)
                        }
                    );
                },
                function (err) {
                    self.layoutModel.showMessage('error', err);
                }
            );
        }

        $(aElm).on('click', () => {
                this.closeSubmenu();
                popupbox.open(
                    createContents,
                    null,
                    {
                        type: 'plain',
                        closeIcon: true,
                        timeout: null,
                        calculatePosition : false,
                        onClose: function () {
                            self.layoutModel.unmountReactComponent(this.getRootElement());
                        }
                    }
                );
            }
        );
    }

    /**
     *
     * @param activeLi - active main menu item LI
     */
    private openSubmenu(activeLi:JQuery) {
        var menuLeftPos;
        var jqSubMenuUl;
        var jqActiveLi = $(activeLi);
        var rightmostPos;

        jqSubMenuUl = this.getHiddenSubmenu(jqActiveLi);
        if (jqSubMenuUl.length > 0) {
            jqActiveLi.addClass('active');
            jqSubMenuUl.css('display', 'block');
            rightmostPos = jqSubMenuUl.offset().left + jqSubMenuUl.width();
            if (rightmostPos > $(window).width()) {
                menuLeftPos = - (rightmostPos - $(window).width());

            } else {
                menuLeftPos = 0;
            }
            jqSubMenuUl.css('left', menuLeftPos);
            this.activeSubmenu = jqSubMenuUl.get(0);
        }
    }

    /**
     * Initializes main menu logic
     */
    init():void {
        var self = this;

        if (this.layoutModel.getConf('corpname')) {
            this.initCustomHelp();
        }

        $('#menu-level-1 li.disabled a').each(function () {
            $(this).attr('href', '#');
        });

        $('#menu-level-1 a.trigger').each(function () {
            $(this).on('mouseover', function (event) {
                var jqMenuLi = $(event.target).closest('li'),
                    prevMenu:HTMLElement,
                    newMenu = jqMenuLi.get(0);

                prevMenu = self.getActiveSubmenu();
                if (prevMenu !== newMenu) {
                    self.closeSubmenu(prevMenu);

                    if (!jqMenuLi.hasClass('disabled')) {
                        self.setActiveSubmenu(jqMenuLi.get(0));
                        self.openSubmenu(jqMenuLi);
                    }
                }
            });
        });

        self.jqMenuBar.on('mouseleave', function (event) {
            self.closeSubmenu(self.getActiveSubmenu());
        });

        $(win).on('resize', function () {
            self.closeSubmenu();
        });

        popupbox.abbr();
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

    showMessage(type, message) {
        return this.pageModel.showMessage(type, message);
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
}

/**
 * This object stores all the initialization actions performed on page when
 * it loads. These actions may be asynchronous in general which is why a Promise
 * objects are required here. If an action si synchronous then it may return null/undefined
 * @todo this should be either finished (and respected by action pages) or rewritten in some way
 */
export class InitActions {

    prom:{[k:string]:any};

    constructor() {
        this.prom = {};
    }

    /**
     * Adds one (.add(key, promise)) or multiple (.add({...})) promises to the collection.
     * Returns self.
     *
     * Please note that actions added simultaneously are considered
     * as independent. To chain actions together use doAfter() method.
     */
    add<T>(arg0:string, arg1:RSVP.Promise<T>):InitActions;
    add(arg0:{[name:string]:any}, arg1?):InitActions;
    add(arg0, arg1):InitActions {
        var prop;

        if (typeof arg0 === 'object' && arg1 === undefined) {
            for (prop in arg0) {
                if (arg0.hasOwnProperty(prop)) {
                    this.prom[prop] = arg0[prop];
                }
            }

        } else if (typeof arg0 === 'string' && arg1 !== undefined) {
            this.prom[arg0] = arg1;
        }
        return this;
    }

    /**
     * Tests whether there is a promise with the 'key'
     *
     */
    contains(key):boolean {
        return this.prom.hasOwnProperty(key);
    }

    /**
     * Gets a promise of the specified name. In case
     * no such init action exists, error is thrown.
     */
    get<T>(key):RSVP.Promise<T> {
        if (this.contains(key)) {
            return this.prom[key];

        } else {
            throw new Error('No such init action: ' + key);
        }
    }

    /**
     * Binds a function to be run after a promise
     * identified by 'actionId' is fulfilled. In case
     * there is no promise under the 'actionId' key (please
     * note that the key must be still present) then
     * ad-hoc one is created and immediately resolved.
     *
     * type T specifies a value returned by actionId action
     * type U specifies a value function fn is producing
     *
     * @param actionId - an identifier of an action (= any function initializing
     * a part of a page and registered via the add() method)
     * @param fn - a function to be run after the action 'actionId' is finished
     */
    doAfter<T, U>(actionId:string, fn:(prev?:T)=>U):RSVP.Promise<U> {
        let prom1:RSVP.Promise<T>;
        let self = this;

        prom1 = this.get(actionId);
        if (prom1 instanceof RSVP.Promise) {
            return prom1.then<U>((v:T) => fn(v));

        } else {
            return new RSVP.Promise(function (fulfill, reject) {
                try {
                    fulfill(fn(self.prom[actionId]));

                } catch (err) {
                    reject(err);
                }
            });
        }
    }
}

/**
 * Local user settings
 */
export class UserSettings implements Kontext.IUserSettings {

    static ALIGNED_CORPORA_KEY = 'active_parallel_corpora';

    storage:Storage;

    storageKey:string;

    timestampKey:string;

    uiStateTTL:number;

    data:{[k:string]:any};

    constructor(storage:Storage, storageKey:string, timestampKey:string, uiStateTTL:number) {
        this.storage = storage;
        this.storageKey = storageKey;
        this.timestampKey = timestampKey;
        this.uiStateTTL = uiStateTTL;
        this.data = {};
    }


    private getTimstamp():number {
        return new Date().getTime() / 1000;
    }

    private dataIsRecent(data) {
        return !data[this.timestampKey] || data[this.timestampKey]
            && ( (new Date().getTime() / 1000 - data[this.timestampKey]) < this.uiStateTTL);
    }

    private dumpToStorage() {
        this.data[this.timestampKey] = this.getTimstamp();
        this.storage.setItem(this.storageKey, JSON.stringify(this.data));
    }

    get<T>(key:string):T {
        return this.data[key];
    }

    set(key:string, value):void {
        this.data[key] = value;
        this.dumpToStorage();
    }

    init():void {
        if (this.storageKey in this.storage) {
            let tmp = JSON.parse(this.storage.getItem(this.storageKey));
            if (this.dataIsRecent(tmp)) {
                this.data = tmp;
            }

        } else {
            this.data[this.timestampKey] = this.getTimstamp();
        }
    }
}
