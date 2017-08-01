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
/// <reference path="../types/ajaxResponses.d.ts" />
/// <reference path="../types/views.d.ts" />
/// <reference path="../types/plugins.d.ts" />
/// <reference path="../vendor.d.ts/react.d.ts" />
/// <reference path="../vendor.d.ts/flux.d.ts" />
/// <reference path="../vendor.d.ts/rsvp.d.ts" />
/// <reference path="../vendor.d.ts/immutable.d.ts" />
/// <reference path="../vendor.d.ts/rsvp-ajax.d.ts" />
/// <reference path="../vendor.d.ts/intl-messageformat.d.ts" />
/// <reference path="../vendor.d.ts/translations.d.ts" />

import applicationBar from 'plugins/applicationBar/init';
import footerBar from 'plugins/footerBar/init';
import {Dispatcher} from 'vendor/Dispatcher';
import {init as documentViewsInit} from 'views/document';
import {init as commonViewsInit} from 'views/common';
import {init as menuViewsInit} from 'views/menu';
import {init as overviewAreaViewsInit} from 'views/overview';
import {init as viewOptionsInit} from 'views/options/main';
import * as React from 'vendor/react';
import * as ReactDOM from 'vendor/react-dom';
import * as RSVP from 'vendor/rsvp';
import * as rsvpAjax from 'vendor/rsvp-ajax';
import {MultiDict, createHistory} from '../util';
import * as docStores from '../stores/common/layout';
import {UserInfo} from '../stores/userStores';
import {CorpusViewOptionsStore} from '../stores/options/structsAttrs';
import {GeneralViewOptionsStore} from '../stores/options/general';
import * as translations from 'translations';
import IntlMessageFormat = require('vendor/intl-messageformat');
import * as Immutable from 'vendor/immutable';
import {AsyncTaskChecker} from '../stores/asyncTask';
import {UserSettings} from '../userSettings';
import {MainMenuStore, InitialMenuData} from '../stores/mainMenu';
import authPlugin from 'plugins/auth/init';

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
    if (typeof window.localStorage === 'object') {
        return window.localStorage;

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

    confChangeHandlers:Immutable.Map<string, Immutable.List<(v:any)=>void>>;

    /**
     * Flux Dispatcher
     */
    dispatcher:Dispatcher<Kontext.DispatcherPayload>;

    /**
     * Local user settings
     */
    userSettings:UserSettings;

    history:Kontext.IHistory;

    /**
     * React component classes
     */
    layoutViews:Kontext.LayoutViews;

    commonViews:CommonViews;

    private corpusInfoStore:docStores.CorpusInfoStore;

    private messageStore:docStores.MessageStore;

    private userInfoStore:UserInfo;

    private corpViewOptionsStore:CorpusViewOptionsStore;

    private generalViewOptionsStore:GeneralViewOptionsStore;

    private mainMenuStore:MainMenuStore;

    private authPlugin:PluginInterfaces.IAuth;

    /**
     * A dictionary containing translations for current UI language (conf['uiLang']).
     */
    private translations:{[key:string]:string};

    private asyncTaskChecker:AsyncTaskChecker;

    /**
     * This is intended for React components to make them able register key
     * events (e.g. the 'ESC' key). But it is always a preferred approach
     * to focus a suitable element and catch event via that.
     */
    private globalKeyHandlers:Immutable.List<(evt:Event)=>void>;

    private switchCorpAwareObjects:Immutable.List<Kontext.ICorpusSwitchAware<any>>;

    private switchCorpStateStorage:Immutable.Map<string, any>;

    private componentTools:Kontext.ComponentHelpers;

    /**
     *
     * @param conf page configuration
     */
    constructor(conf:Kontext.Conf) {
        this.conf = conf;
        this.confChangeHandlers = Immutable.Map<string, Immutable.List<(v:any)=>void>>();
        this.userSettings = new UserSettings(getLocalStorage(), 'kontext_ui',
                '__timestamp__', this.conf['uiStateTTL']);
        this.history = createHistory(this);
        this.translations = translations[this.conf['uiLang']] || {};
        this.globalKeyHandlers = Immutable.List<(evt:Event)=>void>();
        this.switchCorpAwareObjects = Immutable.List<Kontext.ICorpusSwitchAware<any>>();
        this.switchCorpStateStorage = Immutable.Map<string, any>();

        this.componentTools = {
            translate:(s:string, values?:any):string => {
                return this.translate(s, values);
            },
            getConf:(k:string):any => {
                return this.getConf(k);
            },
            createActionLink:(path:string, args?:Array<[string,string]>):string => {
                return this.createActionUrl(path, args);
            },
            createStaticUrl:(path:string):string => {
                return this.createStaticUrl(path);
            },
            formatNumber:(value:number, fractionDigits:number=2):string => {
                return this.formatNumber(value, fractionDigits);
            },
            formatDate:(d:Date, timeFormat:number=0):string => {
                return this.formatDate(d, timeFormat);
            },
            getLayoutViews:():Kontext.LayoutViews => {
                return this.layoutViews;
            },
            addGlobalKeyEventHandler:(fn:(evt:Event)=>void):void => {
                this.addGlobalKeyEventHandler(fn);
            },
            removeGlobalKeyEventHandler:(fn:(evt:Event)=>void):void => {
                this.removeGlobalKeyEventHandler(fn);
            }
        };
    }

    /**
     * Returns layout stores (i.e. the stores used virtually on any page)
     */
    getStores():Kontext.LayoutStores {
        return {
            corpusInfoStore: this.corpusInfoStore,
            messageStore: this.messageStore,
            userInfoStore: this.userInfoStore,
            corpusViewOptionsStore: this.corpViewOptionsStore,
            generalViewOptionsStore: this.generalViewOptionsStore,
            asyncTaskInfoStore: this.asyncTaskChecker,
            mainMenuStore: this.mainMenuStore
        };
    }

    getComponentHelpers():Kontext.ComponentHelpers {
        return this.componentTools;
    }

    /**
     * Exports a list of default + (optional custom) mixins
     * for a React component.
     *
     * @param mixins Additional mixins
     * @returns a list of mixins
     */
    exportMixins(...mixins:any[]):any[] {
        return mixins ? mixins.concat([this.componentTools]) : [this.componentTools];
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

    /**
     *
     * @param element An element the component will be removed from
     */
    unmountReactComponent(element:HTMLElement):boolean {
        return ReactDOM.unmountComponentAtNode(element);
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

    /**
     * Register a function interested in a task status.
     * Multiple functions can be set to listen a single
     * task.
     */
    registerTask(task:Kontext.AsyncTaskInfo):void {
        this.asyncTaskChecker.registerTask(task);
    }

    /**
     * Register an object to store and restore data during corpus switch
     * procedure.
     *
     * Please avoid calling this method in page model's init() method
     * as it would lead to an infinite recursion.
     */
    registerSwitchCorpAwareObject(obj:Kontext.ICorpusSwitchAware<any>):void {
        this.switchCorpAwareObjects = this.switchCorpAwareObjects.push(obj);
        // now we look at the possible previous stored state
        const v = this.switchCorpStateStorage.get(obj.csGetStateKey());
        if (v) {
            obj.csSetState(v);
        }
    }

    /**
     * Change the current corpus used by KonText. Please note
     * that this basically reinitializes all the page's stores
     * and views (both layout and page init() method are called
     * again).
     *
     * Objects you want to preserve must implement ICorpusSwitchAware<T>
     * interface and must be registered via registerSwitchCorpAwareObject()
     * (see below).
     *
     * A concrete page must ensure that its init() is also called
     * as a promise chained after the one returned by this method.
     *
     * @param corpora - a primary corpus plus possible aligned corpora
     * @param subcorpus - an optional subcorpus
     */
    switchCorpus(corpora:Array<string>, subcorpus?:string):RSVP.Promise<any> {
        this.switchCorpAwareObjects.forEach((item, key) => {
            this.switchCorpStateStorage = this.switchCorpStateStorage.set(item.csGetStateKey(), item.csExportState());
        });
        this.switchCorpAwareObjects = this.switchCorpAwareObjects.clear();
        return this.ajax<AjaxResponse.CorpusSwitchResponse>(
            'POST',
            this.createActionUrl('ajax_switch_corpus'),
            {
                corpname: corpora[0],
                usesubcorp: subcorpus,
                align: corpora.slice(1)
            }

        ).then(
            (data) => {
                if (data.contains_errors) {
                    throw this.unpackServerError(data);
                }
                const args = new MultiDict();
                args.set('corpname', data.corpname);
                args.set('usesubcorp', data.subcorpname);
                this.history.pushState(this.getConf<string>('currentAction'), args);

                this.setConf<string>('corpname', data.corpname);
                this.setConf<string>('subcorpname', data.subcorpname);
                this.setConf<string>('humanCorpname', data.humanCorpname);
                this.setConf<Kontext.FullCorpusIdent>('corpusIdent', data.corpusIdent);
                this.setConf<string>('baseAttr', data.baseAttr);
                this.setConf<Array<[string, string]>>('currentArgs', data.currentArgs);
                this.setConf<Array<string>>('compiledQuery', data.compiledQuery);
                this.setConf<string>('concPersistenceOpId', data.concPersistenceOpId);
                this.setConf<Array<string>>('alignedCorpora', data.alignedCorpora);
                this.setConf<Array<{n:string; label:string}>>('availableAlignedCorpora', data.availableAlignedCorpora);
                this.setConf<Array<string>>('activePlugins', data.activePlugins);
                this.setConf<Array<Kontext.QueryOperation>>('queryOverview', data.queryOverview);
                this.setConf<number>('numQueryOps', data.numQueryOps);
                this.setConf<any>('textTypesData', data.textTypesData); // TODO type
                this.setConf<any>('menuData', data.menuData); // TODO type
                this.setConf<Array<any>>('Wposlist', data.Wposlist); // TODO type
                this.setConf<Array<any>>('AttrList', data.AttrList); // TODO type
                this.setConf<string>('TagsetDocUrl', data.TagsetDocUrl);
                this.setConf<{[corpname:string]:string}>('InputLanguages', data.InputLanguages);
                this.setConf<boolean>('hasLemmaAttr', data.hasLemmaAttr);
                this.setConf<any>('ConcFormsArgs', data.ConcFormsArgs); // TODO type
                this.setConf<string>('CurrentSubcorp', data.CurrentSubcorp);
                this.setConf<Array<{v:string; n:string}>>('SubcorpList', data.SubcorpList);
                this.setConf<string>('TextTypesNotes', data.TextTypesNotes);
                return this.init();
            }
        );
    }

    /**
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

        const decodeArgs = (s:string) => {
            let ans = {};
            s.split('&').map((s2)=>s2.split('=').map((s3)=>decodeURIComponent(s3))).forEach((item) => {
                ans[item[0]] = item[1];
            });
            return ans;
        };

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
            (data:string) => {
                switch (options.accept) {
                    case 'application/json':
                    case 'text/x-json':
                        return JSON.parse(data);
                    case 'application/x-www-form-urlencoded':
                        return decodeArgs(data);
                    default:
                        return data;
                }
            }
        );
    }

    unpackServerError(resp:Kontext.AjaxResponse):Error {
        if (resp.contains_errors) {
            return new Error(resp.messages
                .filter(item => item[0] === 'error')
                .map(item => this.translate(item[1])).join(', '));
        }
        return undefined;
    }

    /**
     * Pops-up a user message at the center of page. It is able
     * to handle process error-returned XMLHttpRequest objects
     * when using RSVP-ajax too.
     *
     * @param msgType - one of 'info', 'warning', 'error', 'plain'
     * @param message - text of the message in most cases; in case of
     *                  the 'error' type: Error instance, XMLHttpRequest instance
     *                  or an object containing an attribute 'messages' can
     *                  be used.
     */
    showMessage(msgType:string, message:any, onClose?:()=>void):void {
        let outMsg;
        if (msgType === 'error') {
            if (this.getConf<boolean>('isDebug')) {
                console.error(message);
            }
            if (message instanceof XMLHttpRequest) {
                const respText = (<XMLHttpRequest>message).responseText;
                try {
                    let respObj = JSON.parse(respText);
                    if (respObj['contains_errors'] && respObj['error_code']) {
                        outMsg = this.translate(respObj['error_code'], respObj['error_args'] || {});

                    } else if (respObj['contains_errors'] && respObj['messages']) {
                        outMsg = respObj['messages'].map(x => x[1]).join(', ');

                    } else {
                        outMsg = `${message.status}: ${message.statusText}`;
                    }

                } catch (e) {
                    if (message.statusText && message.status >= 400) {
                        outMsg = `${message.status}: ${message.statusText} (${String(respText).substr(0, 100)}...)`;

                    } else {
                        outMsg = `${message.status}: ${message.statusText}`;
                    }
                }

            } else if (message instanceof Error) {
                outMsg = message.message || this.translate('global__unknown_error');

            } else {
                outMsg = String(message);
            }

        } else {
            outMsg = String(message);
        }
        this.messageStore.addMessage(msgType, outMsg, onClose);
    }

    /**
     * Initialize language switching widget located in footer
     */
    bindLangSwitch():void {
        //
        const srch = document.getElementById('switch-language-box');
        if (srch) {
            const linkSrch = srch.querySelectorAll('a');
            for (let i = 0; i < linkSrch.length; i += 1) {
                const lang = linkSrch[i].getAttribute('data-lang');
                const form = document.getElementById('language-switch-form');
                form.addEventListener('click', () => {
                    (<HTMLInputElement>form.querySelector('input.language')).value = lang;
                    (<HTMLInputElement>form.querySelector('input.continue')).value = window.location.href;
                    (<HTMLFormElement>form).submit();
                });
            }
        }
    }

    /**
     *
     */
    initNotifications() {
        this.renderReactComponent(
            this.layoutViews.Messages,
            <HTMLElement>document.querySelector('#content .messages-mount')
        );

        (this.getConf<Array<any>>('notifications') || []).forEach((msg) => {
            this.messageStore.addMessage(msg[0], msg[1], null);
        });
    }

    /**
     *
     */
    reload():void {
        window.document.location.reload();
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
                try {
                    let format = new IntlMessageFormat(this.translations[msg], this.conf['uiLang']);
                    return format.format(values);

                } catch (e) {
                    console.error('Failed to translate ', msg, e);
                    return tmp;
                }
            }
            return msg;
        }
        return '';
    }

    formatNumber(v:number, fractionDigits:number=2):string {
        let format:any = new Intl.NumberFormat(this.conf['uiLang'], {
            maximumFractionDigits: fractionDigits
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
     * Create a URL for a static resource (e.g. img/close-icon.svg)
     */
    createStaticUrl(path):string {
        if (typeof path !== 'string') {
            throw new Error(`Cannot create static url. Invalid path: ${path}`);
        }
        return this.getConf<string>('staticPath') + (path.indexOf('/') === 0 ? '' : '/') + path;
    }

    /**
     * Create an URL from path suffix. E.g. passing
     * subcorpus/list will produce http://installed.domain/subcorpus/list.
     *
     * @path path suffix
     * @args arguments to be appended to the URL as parameters.
     * Undefined/null/empty string values and their respective names
     * are left out.
     */
    createActionUrl(path:string, args?:Array<[string,string]>|Kontext.IMultiDict):string {
        if (typeof path !== 'string') {
            throw new Error(`Cannot create action url. Invalid path: ${path}`);
        }
        let urlArgs = '';
        if (args !== undefined) {
            const nArgs = Array.isArray(args) ? args : args.items();
            urlArgs = nArgs
                .filter(item => item[1] !== null && item[1] !== undefined)
                .map(item => encodeURIComponent(item[0]) + '=' + encodeURIComponent(item[1]))
                .join('&');
        }
        return this.conf['rootPath'] +
                (path.indexOf('/') === 0 ? path.substr(1) : path) +
                (urlArgs ? '?' + urlArgs : '');
    }

    /**
     * Creates a temporary form with passed args and submits it
     * via POST method.
     *
     * @param path
     * @param args
     */
    setLocationPost(path:string, args:Array<[string,string]>, blankWindow:boolean=false):void {
        const body = window.document.getElementsByTagName('body')[0];
        const form = window.document.createElement('form');
        form.setAttribute('method', 'post');
        form.setAttribute('action', path);
        if (blankWindow) {
            form.setAttribute('target', '_blank');
        }
        body.appendChild(form);
        (args || []).forEach(item => {
            const input = window.document.createElement('input');
            input.setAttribute('type', 'hidden');
            input.setAttribute('name', item[0]);
            input.setAttribute('value', item[1]);
            form.appendChild(input);
        });
        form.submit();
        window.onbeforeunload = () => {
            body.removeChild(form);
        };
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

    /**
     * Return page configuration item
     *
     * @param item
     */
    getConf<T>(item:string):T {
        return this.conf[item];
    }

    /**
     * Register a handler triggered when configuration is
     * changed via setConf(), replaceConcArg() functions.
     *
     * @param key
     * @param handler
     */
    addConfChangeHandler<T>(key:string, handler:(v:T)=>void):void {
        if (!this.confChangeHandlers.has(key)) {
            this.confChangeHandlers = this.confChangeHandlers.set(key, Immutable.List<(v:any)=>void>());
        }
        this.confChangeHandlers = this.confChangeHandlers.set(
            key,
            this.confChangeHandlers.get(key).push(handler)
        );
    }

    /**
     * Set page configuration item. Setting an item
     * triggers a configuration change event.
     */
    setConf<T>(key:string, value:T):void {
        this.conf[key] = value;
        if (this.confChangeHandlers.has(key)) {
            this.confChangeHandlers.get(key).forEach(item => item(value));
        }
    }

    /**
     * Return a list of concordance arguments and their values. Multi-value keys
     * are preserved.
     * Output format: [[k1, v1_1], [k1, v1_2], ...., [kn, vn_1], ..., [kn, vn_m]]
     */
    getConcArgs():MultiDict {
        return new MultiDict(this.getConf<Array<Array<string>>>('currentArgs'));
    }

    /**
     *
     * @param name
     * @param values
     */
    replaceConcArg(name:string, values:Array<string>):void {
        let tmp = new MultiDict(this.getConf<Array<Array<string>>>('currentArgs'));
        tmp.replace(name, values);
        this.setConf('currentArgs', tmp.items());
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

    /**
     * Export a new instance of PluginApi object
     */
    pluginApi():PluginApi {
        return new PluginApi(this);
    }


    // TODO dispatcher misuse (this should conform Flux pattern)
    private registerCoreEvents():void {
        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
            if (payload.props['message']) {
                this.showMessage(payload.props['msgType'], payload.props['message']);
            }
        });
    }

    /**
     * Test whether a plug-in is currently active (= configured, loaded and
     * active for the current corpus).
     *
     * Please note that plug-ins here are identified by their respective
     * server names and not by JS camel-case names - i.e. use
     * 'live_attributes' and not 'liveAttributes' to test the plug-in status.
     *
     * @param name
     */
    pluginIsActive(name:string):boolean {
        return this.getConf<Array<string>>('activePlugins').indexOf(name) > -1;
    }

    /**
     *
     */
    private initMainMenu():void {
        const menuViews = menuViewsInit(this.dispatcher, this.exportMixins(), this,
                this.mainMenuStore, this.getStores().asyncTaskInfoStore, this.layoutViews);
        this.renderReactComponent(
            menuViews.MainMenu,
            window.document.getElementById('main-menu-mount'),
            {}
        );
    }

    /**
     *
     */
    private initOverviewArea():void {
        const overviewViews = overviewAreaViewsInit(
            this.dispatcher,
            this.exportMixins(),
            this.corpusInfoStore,
            this.layoutViews.PopupBox
        );
        const target = window.document.getElementById('general-overview-mount');
        if (target) { // few pages do not use this
            this.renderReactComponent(
                overviewViews.OverviewArea,
                window.document.getElementById('general-overview-mount'),
                {}
            );
        }
    }

    private initViewOptions(mainMenuStore:Kontext.IMainMenuStore,
                generalViewOptionsStore:ViewOptions.IGeneralViewOptionsStore,
                corpViewOptionsStore:ViewOptions.ICorpViewOptionsStore):void {
        const viewOptionsViews = viewOptionsInit(
            this.dispatcher,
            this.getComponentHelpers(),
            this.layoutViews,
            generalViewOptionsStore,
            corpViewOptionsStore,
            mainMenuStore
        );

        this.mainMenuStore.addItemActionPrerequisite(
            'MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS',
            (args:Kontext.GeneralProps) => {
                return this.corpViewOptionsStore.loadData();
            }
        );
        this.mainMenuStore.addItemActionPrerequisite(
            'MAIN_MENU_SHOW_GENERAL_VIEW_OPTIONS',
            (args:Kontext.GeneralProps) => {
                return this.generalViewOptionsStore.loadData();
            }
        );

        this.renderReactComponent(
            viewOptionsViews.OptionsContainer,
            window.document.getElementById('view-options-mount'),
            {}
        );
    }

    resetMenuActiveItemAndNotify():void {
        this.mainMenuStore.resetActiveItemAndNotify();
    }

    initCoreOnly():RSVP.Promise<any> {
        return new RSVP.Promise((resolve:(v:any)=>void, reject:(e:any)=>void) => {
            this.dispatcher = new Dispatcher<Kontext.DispatcherPayload>();
            resolve(null);
        });
    }

    /**
     * Page layout initialization. Any concrete page should
     * call this before it runs its own initialization.
     * To prevent syncing issues, the page initialization
     * should be chained to the returned promise.
     */
    init():RSVP.Promise<any> {
        return new RSVP.Promise((resolve:(v:any)=>void, reject:(e:any)=>void) => {
            try {
                this.dispatcher = new Dispatcher<Kontext.DispatcherPayload>();
                this.asyncTaskChecker = new AsyncTaskChecker(
                    this.dispatcher,
                    this.pluginApi(),
                    this.getConf<any>('asyncTasks') || []
                );

                this.corpusInfoStore = new docStores.CorpusInfoStore(this.dispatcher, this.pluginApi());
                this.messageStore = new docStores.MessageStore(this.dispatcher, this.pluginApi());
                this.userInfoStore = new UserInfo(this.dispatcher, this);
                this.corpViewOptionsStore = new CorpusViewOptionsStore(
                    this.dispatcher,
                    this,
                    this.getConf<Kontext.FullCorpusIdent>('corpusIdent')
                );

                this.mainMenuStore = new MainMenuStore(
                    this.dispatcher,
                    this,
                    this.getConf<InitialMenuData>('menuData')
                );

                this.generalViewOptionsStore = new GeneralViewOptionsStore(
                    this.dispatcher,
                    this,
                    () => {
                        this.mainMenuStore.resetActiveItemAndNotify();
                    }
                );

                this.layoutViews = documentViewsInit(
                    this.dispatcher,
                    this.exportMixins(),
                    this.getStores()
                );

                this.commonViews = commonViewsInit(this.getComponentHelpers());

                window.onkeydown = (evt) => {
                    this.globalKeyHandlers.forEach(fn => fn(evt));
                }
                this.userSettings.init();
                this.initMainMenu();
                this.initOverviewArea();
                this.bindLangSwitch();
                this.initNotifications();
                this.initViewOptions(
                    this.mainMenuStore,
                    this.generalViewOptionsStore,
                    this.corpViewOptionsStore
                );
                this.asyncTaskChecker.init();
                this.registerCoreEvents();
                resolve(null);

            } catch (e) {
                reject(e);
            }

        }).then(
            () => {
                return applicationBar(this.pluginApi());
            }

        ).then(
            () => {
                return authPlugin(this.pluginApi());
            }

        ).then(
            (authPlugin) => {
                // no direct communication is performed
                // with authPlugin but to keep things
                // clear we set the attribute
                this.authPlugin = authPlugin;
                footerBar(this.pluginApi());
            }
        );
    }
}


/**
 * PluginApi exports some essential functions from PageModel
 * to plug-ins while preventing them from accessing whole
 * PageModel.
 */
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

    createActionUrl(path:string, args?:Array<[string,string]>|Kontext.IMultiDict) {
        return this.pageModel.createActionUrl(path, args);
    }

    ajax<T>(method:string, url:string, args:any, options:Kontext.AjaxOptions):RSVP.Promise<T> {
        return this.pageModel.ajax.call(this.pageModel, method, url, args, options);
    }

    showMessage(type, message, onClose) {
        return this.pageModel.showMessage(type, message, onClose);
    }

    unpackServerError(resp:Kontext.AjaxResponse):Error {
        return this.pageModel.unpackServerError(resp);
    }

    translate(msg, values?) {
        return this.pageModel.translate(msg, values);
    }

    formatNumber(v, fractionDigits:number=2) {
        return this.pageModel.formatNumber(v, fractionDigits);
    }

    formatDate(d:Date, timeFormat:number=0):string {
        return this.pageModel.formatDate(d, timeFormat);
    }

    userIsAnonymous():boolean {
        return this.getConf<boolean>('anonymousUser');
    }

    dispatcher() {
        return this.pageModel.dispatcher;
    }

    getComponentHelpers():Kontext.ComponentHelpers {
        return this.pageModel.getComponentHelpers();
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

    getCommonViews():CommonViews {
        return this.pageModel.commonViews;
    }

    getUserSettings():Kontext.IUserSettings {
        return this.pageModel.userSettings;
    }

    pluginIsActive(name:string):boolean {
        return this.pageModel.pluginIsActive(name);
    }

    getConcArgs():MultiDict {
        return this.pageModel.getConcArgs();
    }

    registerSwitchCorpAwareObject(obj:Kontext.ICorpusSwitchAware<any>):void {
        return this.pageModel.registerSwitchCorpAwareObject(obj);
    }

    resetMenuActiveItemAndNotify():void {
        this.pageModel.resetMenuActiveItemAndNotify();
    }
}