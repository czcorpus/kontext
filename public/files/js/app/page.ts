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

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ITranslator, IFullActionControl } from 'kombo';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AjaxError } from 'rxjs/ajax';

import {PluginInterfaces, IPluginApi} from '../types/plugins';
import {Kontext, ViewOptions} from '../types/common';
import {CoreViews} from '../types/coreViews';
import {init as documentViewsFactory} from '../views/document';
import {init as commonViewsFactory, CommonViews} from '../views/common';
import {init as menuViewsFactory} from '../views/menu';
import {init as overviewAreaViewsFactory} from '../views/overview';
import {init as viewOptionsFactory} from '../views/options/main';
import {MultiDict} from '../multidict';
import * as docModels from '../models/common/layout';
import {UserInfo} from '../models/user/info';
import {CorpusViewOptionsModel, ActionName as CorpusViewOptionsActionName} from '../models/options/structsAttrs';
import {GeneralViewOptionsModel} from '../models/options/general';
import {L10n} from './l10n';
import * as Immutable from 'immutable';
import {AsyncTaskChecker, AsyncTaskStatus} from '../models/asyncTask';
import {UserSettings} from './userSettings';
import {MainMenuModel, InitialMenuData, disableMenuItems} from '../models/mainMenu';
import {AppNavigation, AjaxArgs} from './navigation';
import {EmptyPlugin} from '../plugins/empty/init';
import applicationBar from 'plugins/applicationBar/init';
import footerBar from 'plugins/footerBar/init';
import authPlugin from 'plugins/auth/init';
import issueReportingPlugin from 'plugins/issueReporting/init';


export enum DownloadType {
    CONCORDANCE = 'conc_download',
    FREQ = 'freq_download',
    FREQ2D = 'freq2d_download',
    COLL = 'coll_download',
    WORDLIST = 'wordlist_download',
    LINE_SELECTION = 'line_selection_download'
}


/**
 * PageEnvironment represents a core functionality which must be initialized
 * on any KonText page before any of page's own functionalities are
 * inited/involved.
 */
export abstract class PageModel implements Kontext.IURLHandler, Kontext.IConcArgsHandler, Kontext.IConfHandler, ITranslator {

    /**
     * KonText configuration (per-page dynamic object)
     */
    private readonly conf:Kontext.IConfHandler;

    /**
     * Action Dispatcher
     */
    readonly dispatcher:IFullActionControl;

    /**
     * Local user settings
     */
    private readonly userSettings:UserSettings;

    /**
     * React component classes
     */
    layoutViews:CoreViews.Runtime;

    commonViews:CommonViews;

    private corpusInfoModel:docModels.CorpusInfoModel;

    private messageModel:docModels.MessageModel;

    private userInfoModel:UserInfo;

    private corpViewOptionsModel:CorpusViewOptionsModel;

    private generalViewOptionsModel:GeneralViewOptionsModel;

    private mainMenuModel:Kontext.IKeyShorcutProvider;

    private authPlugin:PluginInterfaces.Auth.IPlugin;

    private readonly l10n:L10n;

    private asyncTaskChecker:AsyncTaskChecker;

    /**
     * This is intended for React components to make them able register key
     * events (e.g. the 'ESC' key). But it is always a preferred approach
     * to focus a suitable element and catch event via that.
     */
    private globalKeyHandlers:Immutable.List<(evt:Event)=>void>;

    private readonly appNavig:AppNavigation;

    /**
     *
     */
    constructor(conf:Kontext.IConfHandler, dispatcher:IFullActionControl, l10n:L10n, appNavig:AppNavigation, userSettings:UserSettings) {
        this.conf = conf;
        this.l10n = l10n;
        this.appNavig = appNavig;
        this.userSettings = userSettings;
        this.dispatcher = dispatcher;
        this.globalKeyHandlers = Immutable.List<(evt:Event)=>void>();
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

    abstract getComponentHelpers():Kontext.ComponentHelpers;

    /**
     * Renders provided React component with specified mount element.
     *
     * @param reactClass
     * @param target An element whose content will be replaced by rendered React component
     * @param props Properties used by created component
     * @param callback a function called once the component is rendered
     */
    renderReactComponent<T>(reactClass:React.ComponentClass<T>|React.SFC<T>,
            target:HTMLElement, props?:T, callback?:()=>void):void {
        ReactDOM.render(
            React.createElement<T>(reactClass, props),
            target,
            callback
        );
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
    registerSwitchCorpAwareObject(obj:Kontext.ICorpusSwitchAwareModel<any>):void {
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
    switchCorpus(corpora:Array<string>, subcorpus?:string):Observable<any> {
        return this.appNavig.switchCorpus(corpora, subcorpus);
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
    ajax$<T>(method:string, url:string, args:AjaxArgs, options?:Kontext.AjaxOptions):Observable<T> {
        return this.appNavig.ajax$<T>(method, url, args, options);
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
            name: 'INBOX_ADD_ASYNC_TASK',
            payload: {
                ident: taskId,
                label: filename,
                category: type
            }
        });
        this.appNavig.bgDownload(filename, url, method(), args).subscribe(
            () => {
                this.dispatcher.dispatch({
                    name: 'INBOX_UPDATE_ASYNC_TASK',
                    payload: {
                        ident: taskId,
                        status: AsyncTaskStatus.SUCCESS
                    }
                });
            },
            (err) => {
                this.dispatcher.dispatch({
                    name: 'INBOX_UPDATE_ASYNC_TASK',
                    payload: {
                        ident: taskId,
                        status: AsyncTaskStatus.FAILURE
                    }
                });
            }
        );
    }

    dispatchSideEffect(name:string, props:Kontext.GeneralProps):void {
        this.dispatcher.dispatch({
            name: name,
            payload: props,
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

    dispatchServerMessages() {
        (this.getConf<Array<[string, string]>>('notifications') || []).forEach((msg) => {
            this.dispatcher.dispatch({
                name: 'MESSAGE_ADD',
                payload: {
                    messageType: msg[0],
                    messageText: msg[1]
                }
            });
        });
    }

    /**
     *
     */
    initNotifications() {
        if (this.getConf<boolean>('popupServerMessages')) {
            this.renderReactComponent(
                this.layoutViews.Messages,
                <HTMLElement>document.querySelector('#content .messages-mount'),
                undefined,
                () => this.dispatchServerMessages()
            );
        }
    }

    /**
     * Pops-up a user message at the center of page. It is also able
     * to handle process error-returned XMLHttpRequest objects
     * when using Ajax.
     *
     * @param msgType - one of 'info', 'warning', 'error', 'plain'
     * @param message - text of the message in most cases; in case of
     *                  the 'error' type: Error instance, XMLHttpRequest instance
     *                  or an object containing an attribute 'messages' can
     *                  be used.
     */
    showMessage(msgType:string, message:any):void {

        const fetchJsonError = (message:XMLHttpRequest) => {
            const respObj = message.response || {};
            if (respObj['error_code']) {
                return this.translate(respObj['error_code'], respObj['error_args'] || {});

            } else if (respObj['messages']) {
                return respObj['messages'].join(', ');

            } else {
                return `${message.status}: ${message.statusText}`;
            }
        };

        let outMsg;
        if (msgType === 'error') {
            if (this.getConf<boolean>('isDebug')) {
                console.error(message);
            }

            if (message instanceof XMLHttpRequest) {
                switch (message.responseType) {
                    case 'json': {
                        outMsg = fetchJsonError(message);
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

            } else if (message instanceof AjaxError) {
                if (Array.isArray(message.response['messages'])) {
                    outMsg = message.response['messages'][0][1];

                } else {
                    outMsg = message.message;
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
            name: 'MESSAGE_ADD',
            payload: {
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
     * See Kontext.IConfHandler#getConf()
     */
    getConf<T>(item:string):T {
        return this.conf.getConf(item);
    }

    /**
     * See Kontext.IConfHandler#getNestedConf()
     */
    getNestedConf<T>(...keys:Array<string>):T {
        return this.conf.getNestedConf(...keys);
    }

    /**
     * See Kontext.IConfHandler#setConf()
     */
    setConf<T>(key:string, value:T):void {
        this.conf.setConf(key, value);
    }

    getCorpusIdent():Kontext.FullCorpusIdent {
        return this.conf.getConf('corpusIdent') || {id: null, variant: '', name: null};
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
     *
     */
    abstract pluginApi():IPluginApi;

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

    private initViewOptions(mainMenuModel:Kontext.IKeyShorcutProvider,
                generalViewOptionsModel:ViewOptions.IGeneralViewOptionsModel,
                corpViewOptionsModel:CorpusViewOptionsModel):void {
        const viewOptionsViews = viewOptionsFactory({
            dispatcher: this.dispatcher,
            helpers: this.getComponentHelpers(),
            generalOptionsModel: generalViewOptionsModel,
            viewOptionsModel: corpViewOptionsModel,
            mainMenuModel: mainMenuModel
        });
        this.mainMenuModel.addItemActionPrerequisite(
            'MAIN_MENU_SHOW_GENERAL_VIEW_OPTIONS',
            (args:Kontext.GeneralProps) => this.generalViewOptionsModel.loadData()
        );

        this.renderReactComponent(
            viewOptionsViews.OptionsContainer,
            window.document.getElementById('view-options-mount'),
            {
                corpusIdent: this.getCorpusIdent()
            }
        );
    }

    /**
     * @return true if the plug-in has been installed else false
     */
    private initIssueReporting():boolean {
        if (this.pluginIsActive('issue_reporting')) {
            const mount = document.getElementById('error-reporting-mount');
            if (mount) {
                const plugin = issueReportingPlugin(this.pluginApi())
                this.renderReactComponent(
                    plugin.getWidgetView(),
                    document.getElementById('error-reporting-mount'),
                    this.getConf<Kontext.GeneralProps>('issueReportingAction')
                );
                return true;

            } else {
                console.warn('Cannot init issue reporting plug-in as footer-bar plug-in does not provide a mount point');
            }
        }
        return false;
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
                name: 'CORPUS_SWITCH_MODEL_RESTORE',
                payload: {
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

    unregisterAllModels():void {
        this.asyncTaskChecker.unregister();
        this.corpusInfoModel.unregister();
        this.messageModel.unregister();
        this.userInfoModel.unregister();
        this.corpViewOptionsModel.unregister();
        this.mainMenuModel.unregister();
        this.generalViewOptionsModel.unregister();
    }

    /**
     * Page layout and content initialization. Any concrete page should
     * call this while passing its own initialization logic as the
     * pageInitFn argument. Please note that the page initialization is
     * expected to be synchronous. Any implicit asynchronous initialization
     * should be performed as a side effect of a respective model.
     */
    init(pageInitFn:()=>void, disabledMenuItems:Array<[string, string|null]>, popupMessages:boolean=true):void {
        try {
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
                disableMenuItems(
                    this.getConf<InitialMenuData>('menuData'),
                    []
                )
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
            if (popupMessages) {
                this.initNotifications();
            }
            this.initViewOptions(
                this.mainMenuModel,
                this.generalViewOptionsModel,
                this.corpViewOptionsModel
            );
            this.asyncTaskChecker.init();
            applicationBar(this.pluginApi());
            footerBar(this.pluginApi());

            const auth:PluginInterfaces.Auth.IPlugin = authPlugin(this.pluginApi());
            if (this.isNotEmptyPlugin(auth)) {
                const mountElm = document.getElementById('user-pane-mount');
                const userPaneView = auth.getUserPaneView();
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
            this.authPlugin = auth;
            this.initIssueReporting();

            pageInitFn();

        } catch (err) {
            this.showMessage('error', err);
            console.error(err);
        }
    }
}
