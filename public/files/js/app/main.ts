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

/// <reference path="../types/compat.d.ts" />
/// <reference path="../vendor.d.ts/rsvp-ajax.d.ts" />

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Rx from '@reactivex/rxjs';
import RSVP from 'rsvp';
import {PluginInterfaces, IPluginApi} from '../types/plugins';
import {Kontext, ViewOptions} from '../types/common';
import {CoreViews} from '../types/coreViews';
import {ActionDispatcher} from './dispatcher';
import {init as documentViewsFactory} from '../views/document';
import {init as commonViewsFactory, CommonViews} from '../views/common';
import {init as menuViewsFactory} from '../views/menu';
import {init as overviewAreaViewsFactory} from '../views/overview';
import {init as viewOptionsFactory} from '../views/options/main';
import {MultiDict} from '../util';
import * as docModels from '../models/common/layout';
import {UserInfo} from '../models/user/info';
import {CorpusViewOptionsModel} from '../models/options/structsAttrs';
import {GeneralViewOptionsModel} from '../models/options/general';
import {L10n} from './l10n';
import * as Immutable from 'immutable';
import {AsyncTaskChecker, AsyncTaskStatus} from '../models/asyncTask';
import {UserSettings} from './userSettings';
import {MainMenuModel, InitialMenuData} from '../models/mainMenu';
import {AppNavigation, AjaxArgs} from './navigation';
import {EmptyPlugin} from '../plugins/empty/init';
import applicationBar from 'plugins/applicationBar/init';
import footerBar from 'plugins/footerBar/init';
import authPlugin from 'plugins/auth/init';
import issueReportingPlugin from 'plugins/issueReporting/init';

declare var require:any; // webpack's require
require('styles/layout.less');
require('styles/widgets.less');


export enum DownloadType {
    CONCORDANCE = 'conc_download',
    FREQ = 'freq_download',
    FREQ2D = 'freq2d_download',
    COLL = 'coll_download',
    WORDLIST = 'wordlist_download',
    LINE_SELECTION = 'line_selection_download'
}


/**
 * PageModel represents a core functionality which must be initialized
 * on any KonText page before any of page's own functionalities are
 * inited/involved.
 */
export class PageModel implements Kontext.IURLHandler, Kontext.IConcArgsHandler, Kontext.IConfHandler {

    /**
     * KonText configuration (per-page dynamic object)
     */
    conf:Kontext.Conf;

    /**
     * Functions listening for change in app config (triggered by
     * setConf()).
     */
    confChangeHandlers:Immutable.Map<string, Immutable.List<(v:any)=>void>>;

    /**
     * Action Dispatcher
     */
    dispatcher:ActionDispatcher;

    /**
     * Local user settings
     */
    userSettings:UserSettings;

    /**
     * React component classes
     */
    layoutViews:CoreViews.Runtime;

    commonViews:CommonViews;

    private corpusInfoModel:docModels.CorpusInfoModel;

    private messageModel:docModels.MessageModel;

    private userInfoModel:UserInfo;

    private corpViewOptionsModel:ViewOptions.ICorpViewOptionsModel;

    private generalViewOptionsModel:GeneralViewOptionsModel;

    private mainMenuModel:Kontext.IMainMenuModel;

    private authPlugin:PluginInterfaces.Auth.IPlugin;

    private l10n:L10n;

    private asyncTaskChecker:AsyncTaskChecker;

    /**
     * This is intended for React components to make them able register key
     * events (e.g. the 'ESC' key). But it is always a preferred approach
     * to focus a suitable element and catch event via that.
     */
    private globalKeyHandlers:Immutable.List<(evt:Event)=>void>;

    private componentTools:Kontext.ComponentHelpers;

    private appNavig:AppNavigation;

    /**
     *
     */
    constructor(conf:Kontext.Conf) {
        this.conf = conf;
        this.confChangeHandlers = Immutable.Map<string, Immutable.List<(v:any)=>void>>();
        this.userSettings = UserSettings.createInstance(this);
        this.l10n = new L10n(this.conf['uiLang'], this.conf['helpLinks'] || {});
        this.globalKeyHandlers = Immutable.List<(evt:Event)=>void>();
        this.appNavig = new AppNavigation(this);
        this.componentTools = new ComponentTools(this);
        this.addUiTestingFlag = this.addUiTestingFlag.bind(this);
    }

    /**
     * Returns layout models (i.e. the models used virtually on any page)
     */
    getModels():Kontext.LayoutModel {
        return {
            corpusInfoModel: this.corpusInfoModel,
            userInfoModel: this.userInfoModel,
            corpusViewOptionsModel: this.corpViewOptionsModel,
            generalViewOptionsModel: this.generalViewOptionsModel,
            asyncTaskInfoModel: this.asyncTaskChecker,
            mainMenuModel: this.mainMenuModel
        };
    }

    getMessageModel():docModels.MessageModel {
        return this.messageModel;
    }

    getComponentHelpers():Kontext.ComponentHelpers {
        return this.componentTools;
    }

    /**
     * Renders provided React component with specified mount element.
     *
     * @param reactClass
     * @param target An element whose content will be replaced by rendered React component
     * @param props Properties used by created component
     */
    renderReactComponent<T>(reactClass:React.ComponentClass<T>|React.SFC<T>,
            target:HTMLElement, props?:T):void {
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
    addGlobalKeyEventHandler(fn:(evt:KeyboardEvent)=>void):void {
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
        this.appNavig.registerSwitchCorpAwareObject(obj);
    }

    /**
     * Change the current corpus used by KonText. Please note
     * that this basically reinitializes all the page's model
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
        return this.appNavig.switchCorpus(corpora, subcorpus).then(
            () => {
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
        return this.appNavig.ajax(method, url, args, options);
    }

    ajax$<T>(method:string, url:string, args:AjaxArgs, options?:Kontext.AjaxOptions):Rx.Observable<T> {
        return this.appNavig.ajax$(method, url, args, options);
    }

    /**
     *
     * @param filename
     * @param url
     * @param args
     */
    bgDownload(filename:string, type:DownloadType, url:string, args?:AjaxArgs):void {
        const taskId = `${new Date().getTime()}:${url}`;
        const method = () => {
            if (type === DownloadType.FREQ2D) {
                return 'POST';
            }
            return 'GET';
        };

        this.dispatcher.dispatch({
            actionType: 'INBOX_ADD_ASYNC_TASK',
            props: {
                ident: taskId,
                label: filename,
                category: type
            }
        });
        this.appNavig.bgDownload(filename, url, method(), args).then(
            () => {
                this.dispatcher.dispatch({
                    actionType: 'INBOX_UPDATE_ASYNC_TASK',
                    props: {
                        ident: taskId,
                        status: AsyncTaskStatus.SUCCESS
                    }
                });
            },
            (err) => {
                this.dispatcher.dispatch({
                    actionType: 'INBOX_UPDATE_ASYNC_TASK',
                    props: {
                        ident: taskId,
                        status: AsyncTaskStatus.FAILURE
                    }
                });
            }
        );
    }

    dispatchSideEffect(actionType:string, props:Kontext.GeneralProps):void {
        this.dispatcher.dispatch({
            actionType: actionType,
            props: props,
            isSideEffect: true
        });
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
        if (this.getConf<boolean>('popupServerMessages')) {
            this.renderReactComponent(
                this.layoutViews.Messages,
                <HTMLElement>document.querySelector('#content .messages-mount')
            );
        }
        (this.getConf<Array<[string, string]>>('notifications') || []).forEach((msg) => {
            this.dispatcher.dispatch({
                actionType: 'MESSAGE_ADD',
                props: {
                    messageType: msg[0],
                    messageText: msg[1]
                }
            });
        });
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
    showMessage(msgType:string, message:any):void {
        let outMsg;
        if (msgType === 'error') {
            if (this.getConf<boolean>('isDebug')) {
                console.error(message);
            }
            if (message instanceof XMLHttpRequest) {
                switch (message.responseType) {
                    case 'json': {
                        const respObj = message.response || {};
                        if (respObj['error_code']) {
                            outMsg = this.translate(respObj['error_code'], respObj['error_args'] || {});

                        } else if (respObj['messages']) {
                            outMsg = respObj['messages'].join(', ');

                        } else {
                            outMsg = `${message.status}: ${message.statusText}`;
                        }
                    }
                    break;
                    case 'text':
                    case '':
                        outMsg = `${message.status}: ${message.statusText} (${String(message.responseText).substr(0, 100)}...)`;
                    break;
                    default:
                        outMsg = `${message.status}: ${message.statusText}`
                    break;

                }

            } else if (message instanceof Error) {
                outMsg = message.message || this.translate('global__unknown_error');

            } else {
                outMsg = `${message}`;
            }

        } else {
            outMsg = `${message}`;
        }
        this.dispatcher.dispatch({
            actionType: 'MESSAGE_ADD',
            props: {
                messageType: msgType,
                messageText: outMsg
            }
        });
    }

    /**
     *
     */
    translate(msg:string, values?:any):string {
        return this.l10n.translate(msg, values);
    }

    formatNumber(v:number, fractionDigits:number=2):string {
        return this.l10n.formatNumber(v, fractionDigits);
    }

    /**
     * @param d a Date object
     * @param timeFormat 0 = no time, 1 = hours + minutes, 2 = hours + minutes + seconds
     *  (hours, minutes and seconds are always in 2-digit format)
     */
    formatDate(d:Date, timeFormat:number=0):string {
        return this.l10n.formatDate(d, timeFormat);
    }

    /**
     * Reload the current page.
     */
    reload():void {
        this.appNavig.reload();
    }

    /**
     * Create a URL for a static resource (e.g. img/close-icon.svg)
     */
    createStaticUrl(path):string {
        return this.appNavig.createStaticUrl(path);
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
        return this.appNavig.createActionUrl(path, args);
    }

    /**
     * Creates a temporary form with passed args and submits it
     * via POST method.
     */
    setLocationPost(path:string, args:Array<[string,string]>, blankWindow:boolean=false):void {
        this.appNavig.setLocationPost(path, args, blankWindow);
    }

    /**
     *
     */
    encodeURLParameters(params:MultiDict):string {
        return this.appNavig.encodeURLParameters(params);
    }

    getHistory():Kontext.IHistory {
        return this.appNavig.getHistory();
    }

    /**
     * Return page configuration item. If not found
     * 'undefined' is returned.
     *
     */
    getConf<T>(item:string):T {
        return this.conf[item];
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

    getCorpusIdent():Kontext.FullCorpusIdent {
        return this.conf['corpusIdent'] || {};
    }

    /**
     * Register a handler triggered when configuration is
     * changed via setConf(), replaceConcArg() functions.
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
     * Return a list of concordance arguments and their values. Multi-value keys
     * are preserved.
     * Output format: [[k1, v1_1], [k1, v1_2], ...., [kn, vn_1], ..., [kn, vn_m]]
     */
    getConcArgs():MultiDict {
        return new MultiDict(this.getConf<Kontext.ListOfPairs>('currentArgs'));
    }

    /**
     * Replace a specified argument of the current concordance. The action
     * triggers an event calling all the config change handlers.
     */
    replaceConcArg(name:string, values:Array<string>):void {
        let tmp = new MultiDict(this.getConf<Kontext.ListOfPairs>('currentArgs'));
        tmp.replace(name, values);
        this.setConf('currentArgs', tmp.items());
    }

    /**
     * @param overwriteArgs a list of arguments whose values overwrite the current ones
     * @param appendArgs a list of arguments which will be appended to the existing ones
     */
    exportConcArgs(overwriteArgs:Kontext.MultiDictSrc, appendArgs?:Kontext.MultiDictSrc):string {
        return this.appNavig.exportConcArgs(overwriteArgs, appendArgs);
    }

    /**
     * Export a new instance of PluginApi object
     */
    pluginApi():PluginApi {
        return new PluginApi(this);
    }

    /**
     * Test whether a plug-in is currently active (= configured, loaded and
     * active for the current corpus). The method considers only the client-side
     * part of a plug-in which means it is perfectly correct to have a server-side
     * plug-in enabled while this method returns false.
     *
     * Please note that plug-ins here are identified by their respective
     * server names and not by JS camel-case names - i.e. use
     * 'live_attributes' and not 'liveAttributes' to test the plug-in status.
     *
     */
    pluginIsActive(name:string):boolean {
        return this.getConf<Array<string>>('activePlugins').indexOf(name) > -1;
    }

    resetMenuActiveItemAndNotify():void {
        this.mainMenuModel.resetActiveItemAndNotify();
    }

    /**
     *
     */
    private initMainMenu():void {
        const menuViews = menuViewsFactory({
            dispatcher: this.dispatcher,
            he: this.getComponentHelpers(),
            mainMenuModel: this.mainMenuModel,
            asyncTaskModel: this.getModels().asyncTaskInfoModel
        });
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
        const overviewViews = overviewAreaViewsFactory(
            this.dispatcher,
            this.getComponentHelpers(),
            this.corpusInfoModel
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

    private initViewOptions(mainMenuModel:Kontext.IMainMenuModel,
                generalViewOptionsModel:ViewOptions.IGeneralViewOptionsModel,
                corpViewOptionsModel:ViewOptions.ICorpViewOptionsModel):void {
        const viewOptionsViews = viewOptionsFactory({
            dispatcher: this.dispatcher,
            helpers: this.getComponentHelpers(),
            generalOptionsModel: generalViewOptionsModel,
            viewOptionsModel: corpViewOptionsModel,
            mainMenuModel: mainMenuModel
        });

        this.mainMenuModel.addItemActionPrerequisite(
            'MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS',
            (args:Kontext.GeneralProps) => {
                return this.corpViewOptionsModel.loadData();
            }
        );
        this.mainMenuModel.addItemActionPrerequisite(
            'MAIN_MENU_SHOW_GENERAL_VIEW_OPTIONS',
            (args:Kontext.GeneralProps) => {
                return this.generalViewOptionsModel.loadData();
            }
        );

        this.renderReactComponent(
            viewOptionsViews.OptionsContainer,
            window.document.getElementById('view-options-mount'),
            {}
        );
    }

    /**
     * @return true if the plug-in has been installed else false
     */
    private initIssueReporting():boolean {
        if (this.pluginIsActive('issue_reporting')) {
            const plugin = issueReportingPlugin(this.pluginApi())
            this.renderReactComponent(
                plugin.getWidgetView(),
                document.getElementById('error-reporting-mount'),
                this.getConf<Kontext.GeneralProps>('issueReportingAction')
            );
            return true;

        } else {
            return false;
        }
    }

    isNotEmptyPlugin(plugin:any):boolean {
        return plugin && !(plugin instanceof EmptyPlugin);
    }

    /**
     * Return a URL for a specified term optionally defined in a separate config
     * (see global/help_links_path in config.xml). This is used by enhanced
     * InlineHint component.
     */
    getHelpLink(ident:string):string {
        return this.l10n.getHelpLink(ident);
    }

    /**
     * note: this fn is (and must be) bound to 'this' in constructor
     */
    addUiTestingFlag():void {
        if (this.getConf('uiTestingFlag')) {
            document.body.setAttribute('data-kontext-init', '');
        }
    }

    getAuthPlugin():PluginInterfaces.Auth.IPlugin {
        return this.authPlugin;
    }

    setLocal(k:string, val:string|number|boolean):void {
        this.userSettings.set(k, val);
    }

    getLocal<T = string|number|boolean>(k:string, dflt:T=undefined):T {
        const ans = this.userSettings.get<T>(k);
        return ans !== undefined ? ans : dflt;
    }

    restoreModelsDataAfterSwitch():void {
        this.appNavig.forEachCorpSwitchSerializedItem((key, data) => {
            this.dispatcher.dispatch({
                actionType: 'CORPUS_SWITCH_MODEL_RESTORE',
                props: {
                    key: key,
                    data: data,
                    prevCorpora: this.appNavig.getSwitchCorpPreviousCorpora(),
                    currCorpora: Immutable.List([this.getCorpusIdent().id].concat(this.getConf<Array<string>>('alignedCorpora')))
                }
            });
        });
    }

    openWebSocket(args:MultiDict):WebSocket|null {
        if (window['WebSocket'] !== undefined && this.getConf('webSocketUrl')) {
            const ans = new WebSocket(this.getConf('webSocketUrl') + '?' + this.encodeURLParameters(args));
            ans.onerror = (evt:Event) => {
                this.showMessage('error', 'WebSocket error.');
            };
            return ans;
        }
        return null;
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
                this.dispatcher = new ActionDispatcher();
                this.asyncTaskChecker = new AsyncTaskChecker(
                    this.dispatcher,
                    this.pluginApi(),
                    this.getConf<any>('asyncTasks') || []
                );

                this.corpusInfoModel = new docModels.CorpusInfoModel(this.dispatcher, this.pluginApi());
                this.messageModel = new docModels.MessageModel(
                    this.dispatcher,
                    this.pluginApi(),
                    this.getConf<boolean>('popupServerMessages')
                );
                this.userInfoModel = new UserInfo(this.dispatcher, this);
                this.corpViewOptionsModel = new CorpusViewOptionsModel(
                    this.dispatcher,
                    this,
                    this.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
                    this.getConf<boolean>('anonymousUser')
                );

                this.mainMenuModel = new MainMenuModel(
                    this.dispatcher,
                    this,
                    this.getConf<InitialMenuData>('menuData')
                );

                this.generalViewOptionsModel = new GeneralViewOptionsModel(
                    this.dispatcher,
                    this,
                    this.getConf<boolean>('anonymousUser')
                );
                this.generalViewOptionsModel.addOnSubmitResponseHandler(
                    ()=>this.mainMenuModel.resetActiveItemAndNotify()
                );

                this.layoutViews = documentViewsFactory(
                    this.dispatcher,
                    this.getComponentHelpers(),
                    this.getModels(),
                    this.messageModel
                );

                this.commonViews = commonViewsFactory(this.getComponentHelpers());

                window.onkeydown = (evt) => {
                    this.globalKeyHandlers.forEach(fn => fn(evt));
                }
                this.userSettings.init();
                this.initMainMenu();
                this.initOverviewArea();
                this.bindLangSwitch();
                this.initNotifications();
                this.initViewOptions(
                    this.mainMenuModel,
                    this.generalViewOptionsModel,
                    this.corpViewOptionsModel
                );
                this.asyncTaskChecker.init();
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
                if (this.isNotEmptyPlugin(authPlugin)) {
                    const mountElm = document.getElementById('user-pane-mount');
                    const userPaneView = authPlugin.getUserPaneView();
                    if (userPaneView) {
                        this.renderReactComponent(
                            userPaneView,
                            mountElm,
                            {
                                isAnonymous: this.getConf<boolean>('anonymousUser'),
                                fullname: this.getConf<string>('userFullname')
                            }
                        );
                    }
                }
                this.authPlugin = authPlugin;
                return footerBar(this.pluginApi());
            }

        ).then(
            () => {
                return this.initIssueReporting();
            }
        );
    }
}

/**
 * ComponentTools provide a set of runtime functions
 * used by React components (e.g. for message translation,
 * generating URLs, accessing shared components).
 */
class ComponentTools {

    private pageModel:PageModel;

    public browserInfo:Kontext.IBrowserInfo;

    constructor(pageModel:PageModel) {
        this.pageModel = pageModel;
        this.browserInfo = {
            isFirefox: () => {
                return window.navigator.userAgent.indexOf('Firefox') > -1
                        && window.navigator.userAgent.indexOf('Seamonkey') === -1;
            }
        }
    }

    translate(s:string, values?:any):string {
        return this.pageModel.translate(s, values);
    }

    createActionLink(path:string, args?:Array<[string,string]>|Kontext.IMultiDict):string {
        return this.pageModel.createActionUrl(path, args);
    }

    createStaticUrl(path:string):string {
        return this.pageModel.createStaticUrl(path);
    }

    formatNumber(value:number, fractionDigits:number=2):string {
        return this.pageModel.formatNumber(value, fractionDigits);
    }

    formatDate(d:Date, timeFormat:number=0):string {
        return this.pageModel.formatDate(d, timeFormat);
    }

    getLayoutViews():CoreViews.Runtime {
        return this.pageModel.layoutViews;
    }

    addGlobalKeyEventHandler(fn:(evt:Event)=>void):void {
        this.pageModel.addGlobalKeyEventHandler(fn);
    }

    removeGlobalKeyEventHandler(fn:(evt:Event)=>void):void {
        this.pageModel.removeGlobalKeyEventHandler(fn);
    }

    cloneState<T extends {[key:string]:any}>(obj:T):T {
        if (Object.assign) {
            return <T>Object.assign({}, obj);

        } else {
            const ans:{[key:string]:any} = {};
            for (let p in obj) {
                if (obj.hasOwnProperty(p)) {
                    ans[p] = obj[p];
                }
            }
            return <T>ans;
        }
    }

    getHelpLink(ident:string) {
        return this.pageModel.getHelpLink(ident);
    }

    getElmPosition(elm:HTMLElement):[number, number] {
        let x = 0;
        let y = 0;
        let srchElm = elm;
        while (srchElm) {
            if (srchElm.tagName === 'BODY') {
                const xScroll = srchElm.scrollLeft || document.documentElement.scrollLeft;
                const yScroll = srchElm.scrollTop || document.documentElement.scrollTop;
                x += (srchElm.offsetLeft - xScroll + srchElm.clientLeft);
                y += (srchElm.offsetTop - yScroll + srchElm.clientTop);

            } else {
                x += (srchElm.offsetLeft - srchElm.scrollLeft + srchElm.clientLeft);
                y += (srchElm.offsetTop - srchElm.scrollTop + srchElm.clientTop);
            }
            srchElm = srchElm.offsetParent as HTMLElement;
        }
        return [x, y];
    }
}


/**
 * PluginApi exports some essential functions from PageModel
 * to plug-ins while preventing them from accessing whole
 * PageModel. This is expected to be used by plug-ins'
 * models. For React component helpers see 'ComponentTools'
 */
export class PluginApi implements IPluginApi {

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

    ajax$<T>(method:string, url:string, args:any, options:Kontext.AjaxOptions):Rx.Observable<T> {
        return this.pageModel.ajax$.call(this.pageModel, method, url, args, options);
    }

    showMessage(type, message) {
        return this.pageModel.showMessage(type, message);
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

    renderReactComponent<T, U>(reactClass:React.ComponentClass<T>|React.SFC<T>,
            target:HTMLElement, props?:T):void {
        this.pageModel.renderReactComponent(reactClass, target, props);
    }

    unmountReactComponent(element:HTMLElement):boolean {
        return this.pageModel.unmountReactComponent(element);
    }

    getModels():Kontext.LayoutModel {
        return this.pageModel.getModels();
    }

    getViews():CoreViews.Runtime {
        return this.pageModel.layoutViews;
    }

    getCommonViews():CommonViews {
        return this.pageModel.commonViews;
    }

    pluginIsActive(name:string):boolean {
        return this.pageModel.pluginIsActive(name);
    }

    getConcArgs():MultiDict {
        return this.pageModel.getConcArgs();
    }

    getCorpusIdent():Kontext.FullCorpusIdent {
        return this.pageModel.getCorpusIdent();
    }

    registerSwitchCorpAwareObject(obj:Kontext.ICorpusSwitchAware<any>):void {
        return this.pageModel.registerSwitchCorpAwareObject(obj);
    }

    resetMenuActiveItemAndNotify():void {
        this.pageModel.resetMenuActiveItemAndNotify();
    }

    getHelpLink(ident:string):string {
        return this.getHelpLink(ident);
    }

    setLocationPost(path:string, args:Array<[string,string]>, blankWindow:boolean=false):void {
        this.pageModel.setLocationPost(path, args, blankWindow);
    }
}


export enum PluginName {
    AUTH = 'auth',
    SETTINGS_STORAGE = 'settings_storage',
    TAGHELPER = 'taghelper',
    TOKEN_CONNECT = 'token_connect',
    APP_BAR = 'app_bar',
    FOOTER_BAR = 'footer_bar',
    CORPARCH = 'corparch',
    LIVE_ATTRIBUTES = 'live_attributes',
    SUBCMIXER = 'subcmixer',
    SYNTAX_VIEWER = 'syntax_viewer'
}