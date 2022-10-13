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
import { createRoot, Root } from 'react-dom/client';
import { ITranslator, IFullActionControl, StatelessModel } from 'kombo';
import { Observable, Subject } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';
import { List, HTTP, tuple, pipe, URL as CURL, Dict } from 'cnc-tskit';

import * as PluginInterfaces from '../types/plugins';
import * as Kontext from '../types/kontext';
import * as CoreViews from '../types/coreViews';
import { init as documentViewsFactory } from '../views/document';
import { init as commonViewsFactory, CommonViews } from '../views/common';
import { init as menuViewsFactory } from '../views/menu';
import { init as overviewAreaViewsFactory } from '../views/overview';
import { init as viewOptionsFactory } from '../views/options/main';
import { init as initQueryHistoryViews } from '../views/searchHistory/main';
import * as docModels from '../models/common/layout';
import { UserInfo } from '../models/user/info';
import { CorpusViewOptionsModel } from '../models/options/structsAttrs';
import { GeneralViewOptionsModel, GeneralViewOptionsModelState } from '../models/options/general';
import { L10n } from './l10n';
import { AsyncTaskChecker } from '../models/asyncTask';
import { UserSettings } from './userSettings';
import { MainMenuModel, InitialMenuData, disableMenuItems } from '../models/mainMenu';
import { AppNavigation } from './navigation';
import { EmptyPlugin } from '../plugins/empty/init';
import { Actions as MainMenuActions } from '../models/mainMenu/actions';
import { Actions as ATActions } from '../models/asyncTask/actions';
import { ConcServerArgs, IConcArgsHandler } from '../models/concordance/common';
import { Actions } from '../models/common/actions';
import applicationBar from 'plugins/applicationBar/init';
import footerBar from 'plugins/footerBar/init';
import authPlugin from 'plugins/auth/init';
import issueReportingPlugin from 'plugins/issueReporting/init';
import querySuggestPlugin from 'plugins/querySuggest/init';
import { IPageLeaveVoter } from '../models/common/pageLeave';
import { IUnregistrable } from '../models/common/common';
import { PluginName } from './plugin';
import { GlobalStyle } from '../views/theme/default/global';
import { SearchHistoryModel } from '../models/searchHistory';
import { IPluginApi } from '../types/plugins/common';
import { FreqResultViews } from '../models/freqs/common';
import { PageMount } from './mounts';


export enum DownloadType {
    CONCORDANCE = 'conc_download',
    FREQ = 'freq_download',
    FREQ2D = 'freq2d_download',
    COLL = 'coll_download',
    WORDLIST = 'wordlist_download',
    LINE_SELECTION = 'line_selection_download',
    PQUERY = 'pquery_download',
    CHART = 'chart_download'
}

export function isDownloadType(s:string):s is DownloadType {
    return s === DownloadType.CONCORDANCE || s === DownloadType.COLL  ||
        s === DownloadType.FREQ || s === DownloadType.FREQ2D || s === DownloadType.WORDLIST ||
        s === DownloadType.LINE_SELECTION || s === DownloadType.PQUERY ||
        s === DownloadType.CHART;
}

export interface SaveLinkHandler<T = any> {
    (name:string, format:string, url:string, args?:T):void;
}

export class UnsupportedBlob implements Blob {
    readonly size: number;
    readonly type: string;

    constructor(blobParts?: BlobPart[], options?: BlobPropertyBag) {}

    static translate = (s:string):string => s;

    arrayBuffer(): Promise<ArrayBuffer> {
        return Promise.reject(UnsupportedBlob.translate('global__func_not_supp_by_the_browser'));
    }

    slice(start?: number, end?: number, contentType?: string): Blob {
        throw new Error(UnsupportedBlob.translate('global__func_not_supp_by_the_browser'));
    }

    stream(): ReadableStream {
        throw new Error(UnsupportedBlob.translate('global__func_not_supp_by_the_browser'));
    }

    text(): Promise<string> {
        return Promise.reject(UnsupportedBlob.translate('global__func_not_supp_by_the_browser'));
    }
}


/**
 * PageEnvironment represents a core functionality which must be initialized
 * on any KonText page before any of page's own functionalities are
 * inited/involved.
 */
export abstract class PageModel implements Kontext.IURLHandler, IConcArgsHandler,
        Kontext.IConfHandler, ITranslator {

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

    private generalViewOptionsModel:StatelessModel<GeneralViewOptionsModelState>;

    private mainMenuModel:MainMenuModel;

    private authPlugin:PluginInterfaces.Auth.IPlugin;

    private appBarPlugin:PluginInterfaces.ApplicationBar.IPlugin;

    private readonly l10n:L10n;

    private asyncTaskChecker:AsyncTaskChecker;

    private searchHistoryModel:SearchHistoryModel;

    qsuggPlugin:PluginInterfaces.QuerySuggest.IPlugin;

    /**
     * This is intended for React components to make them able register key
     * events (e.g. the 'ESC' key). But it is always a preferred approach
     * to focus a suitable element and catch event via that.
     */
    private globalKeyHandlers:Array<(evt:KeyboardEvent)=>void>;

    private readonly appNavig:AppNavigation;

    private readonly reactRoots:{[elementId:string]:Root};

    /**
     *
     */
    constructor(conf:Kontext.IConfHandler, dispatcher:IFullActionControl, l10n:L10n,
            appNavig:AppNavigation, userSettings:UserSettings) {
        this.conf = conf;
        this.l10n = l10n;
        this.appNavig = appNavig;
        this.userSettings = userSettings;
        this.dispatcher = dispatcher;
        this.globalKeyHandlers = [];
        this.reactRoots = {};
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
            mainMenuModel: this.mainMenuModel,
            corpusSwitchModel: this.appNavig.corpusSwitchModel,
            searchHistoryModel: this.searchHistoryModel
        };
    }

    getMessageModel():docModels.MessageModel {
        return this.messageModel;
    }

    abstract getComponentHelpers():Kontext.ComponentHelpers;

    /**
     * Renders provided React component with specified mount element.
     *
     * Please note that handling of the returned root is up to the caller.
     *
     * @param target An element whose content will be replaced by rendered React component
     * @param props Properties used by created component
     */
    renderReactComponent<T>(
        reactClass:React.ComponentClass<T>|React.FC<T>,
        target:HTMLElement,
        props?:T
    ):Root {
        const root = createRoot(target);
        root.render(
            React.createElement<T>(reactClass, props)
        );
        return root;
    }

    /**
     *
     * Renders a component to a mount point identified by a PageMount value.
     * Such a render registers a newly created React root and in case of repeated
     * render, the root is reused.
     */
    renderLayoutReactComponent<T>(
        reactClass:React.ComponentClass<T>|React.FC<T>,
        target:PageMount,
        props?:T
    ):Root {
        if (this.reactRoots[target] === undefined) {
            const newRoot = createRoot(document.querySelector(target));
            this.reactRoots[target] = newRoot;
        }
        this.reactRoots[target].render(React.createElement<T>(reactClass, props));
        return this.reactRoots[target];
    }

    /**
     *
     */
    unmountReactComponent(root:Root|string):void {
        if (typeof root === 'string') {
            const ownRoot = this.reactRoots[root];
            if (ownRoot === undefined) {
                throw new Error(`Cannot unmount unregistered page mount ${root}`);
            }
            ownRoot.unmount();

        } else {
            root.unmount();
        }
    }

    /**
     * Adds a window-registered key event handler.
     */
    addGlobalKeyEventHandler(fn:(evt:KeyboardEvent)=>void):void {
        this.globalKeyHandlers.push(fn);
    }

    /**
     * Removes a window-registered key event handler.
     */
    removeGlobalKeyEventHandler(fn:(evt:Event)=>void):void {
        const srchIdx:number = this.globalKeyHandlers.indexOf(fn);
        if (srchIdx > -1) {
            List.removeAt(srchIdx, this.globalKeyHandlers);
        }
    }

    /**
     * Register a handler triggered once at least one async. task
     * is finished/failed.
     */
    addOnAsyncTaskUpdate(fn:Kontext.AsyncTaskOnUpdate):void {
        this.asyncTaskChecker.addOnUpdate(fn);
    }

    /**
     * Register a function interested in a task status.
     * Multiple functions can be set to listen a single
     * task.
     *
     * @deprecated Use actions instead
     */
    registerTask(task:Kontext.AsyncTaskInfo):void {
        this.asyncTaskChecker.registerTask(task);
    }

    /**
     *
     * Notes:
     * - default contentType is 'application/x-www-form-urlencoded; charset=UTF-8'
     * - default accept is 'application/json'
     *
     * @param method An HTTP method
     * @param url A URL of the resource
     * @param args Parameters to be passed along with request
     * @param options Additional settings
     */
    ajax$<T>(
        method:HTTP.Method,
        url:string,
        args:Kontext.AjaxArgs,
        options?:Kontext.AjaxOptions
    ):Observable<T> {
        return this.appNavig.ajax$<T>(method, url, args, options);
    }

    /**
     *
     */
    bgDownload<T=Kontext.AjaxArgs>(
        {name, format, datasetType, url, contentType, args}:
        {
            name?:string,
            format:string,
            datasetType:DownloadType,
            url:string,
            contentType:string,
            args?:T
        }):void {


        function generateFileIdentifier() {
            const dt = new Date().toISOString().split('T')[0];
            return `kontext-${name ? name + '-' : ''}${datasetType}-${dt}.${format}`;
        }

        const taskId = `${new Date().getTime()}:${url}`;
        const method = () => { // TODO this is an antipattern (should be part of download types)
            if (
                datasetType === DownloadType.FREQ2D ||
                datasetType === DownloadType.LINE_SELECTION ||
                datasetType === DownloadType.CHART) {
                return HTTP.Method.POST;
            }
            return HTTP.Method.GET;
        };

        const fullname = generateFileIdentifier();
        this.dispatcher.dispatch(
            ATActions.InboxAddAsyncTask,
            {
                ident: taskId,
                label: fullname,
                category: datasetType as string
            }
        );
        this.appNavig.bgDownload<T>({
            filename: fullname,
            url,
            method: method(),
            contentType,
            args
        }).subscribe({
            next: () => {
                this.dispatcher.dispatch(
                    ATActions.InboxUpdateAsyncTask,
                    {
                        ident: taskId,
                        status: 'SUCCESS'
                    }
                );
            },
            error: error => {
                this.dispatcher.dispatch(
                    ATActions.InboxUpdateAsyncTask,
                    {
                        ident: taskId,
                        status: 'FAILURE'
                    },
                    error
                );
            }
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
                    (form.querySelector('input.language') as HTMLInputElement).value = lang;
                    (form.querySelector('input.continue') as HTMLInputElement).value =
                        window.location.href;
                    (form as HTMLFormElement).submit();
                });
            }
        }
    }

    dispatchServerMessages() {
        List.forEach(
            ([messageType, message]) => {
                this.dispatcher.dispatch<typeof Actions.MessageAdd>({
                    name: Actions.MessageAdd.name,
                    payload: {
                        messageType,
                        message
                    }
                });
            },
            this.getConf<Array<[Kontext.UserMessageTypes, string]>>('notifications') || []
        )
    }

    /**
     *
     */
    initNotifications() {
        if (this.getConf<boolean>('popupServerMessages')) {
            this.renderLayoutReactComponent(
                this.layoutViews.Messages,
                PageMount.CLIENT_MESAGES,
                {initCallback: () => this.dispatchServerMessages()}
            );
        }
    }

    /**
     * Pops-up a user message at the center of page. It is also able
     * to handle process error-returned XMLHttpRequest objects
     * when using Ajax.
     *
     * @param msgType - type of the message
     * @param message - text of the message in most cases; in case of
     *                  the 'error' type: Error instance, XMLHttpRequest instance
     *                  or an object containing an attribute 'messages' can
     *                  be used.
     */
    showMessage(msgType:Kontext.UserMessageTypes, message:any):void {
        this.dispatcher.dispatch<typeof Actions.MessageAdd>({
            name: Actions.MessageAdd.name,
            payload: {
                messageType: msgType,
                message: message
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
    createActionUrl<T>(path:string, args?:T):string {
        return this.appNavig.createActionUrl(path, args);
    }

    /**
     * Creates a temporary form with passed args and submits it
     * via POST method.
     */
    setLocationPost<T>(path:string, args:T, blankWindow:boolean=false):void {
        this.appNavig.setLocationPost(path, args, blankWindow);
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
        return this.conf.getConf('corpusIdent') || {
            id: null,
            variant: '',
            name: null,
            size: 0,
            searchSize: 0
        };
    }

    getConcArgs():ConcServerArgs {
        return {
            maincorp: undefined,
            viewmode: 'kwic',
            format: undefined,
            pagesize: 0,
            attrs: [],
            attr_vmode: undefined,
            base_viewattr: undefined,
            ctxattrs: [],
            structs: [],
            refs: [],
            fromp: undefined,
            q: undefined,
            ...this.getConf<ConcServerArgs>('currentArgs')
        };
    }

    /**
     * Update concordance args with an object containing
     * subset of ConcServerArgs keys and values.
     */
    updateConcArgs<T extends ConcServerArgs>(obj:Partial<T>):void {
        this.setConf<ConcServerArgs>('currentArgs', { ...this.getConcArgs(), ...obj});
    }

    updateConcPersistenceId(value:string|Array<string>):void {
        if (Array.isArray(value)) {
            this.updateConcArgs({q: value});
            const concIds = pipe(
                value,
                List.filter(v => v[0] === '~'),
                List.map(v => v.substr(1))
            );
            if (!List.empty(concIds)) {
                this.setConf<string>('concPersistenceOpId', List.head(concIds));
            }

        } else {
            this.updateConcArgs({q: ['~' + value]});
            this.setConf<string>('concPersistenceOpId', value);
        }
        this.dispatcher.dispatch<typeof Actions.ConcArgsUpdated>({
            name: Actions.ConcArgsUpdated.name,
            payload: {
                args: this.getConcArgs()
            }
        });
    }

    /**
     *
     */
    abstract pluginApi():IPluginApi;

    /**
     * Test whether a plug-in is currently active - i.e.:
     * - configured + built
     * - loaded and active for the current corpus
     */
    pluginTypeIsActive(name:PluginName):boolean {
        return this.getConf<Array<string>>('activePlugins').indexOf(name) > -1;
    }

    /**
     * If false then KonText is not compiled with this plug-in and uses
     * a dummy replacement EmptyPlugin. I.e. this tests a static plug-in
     * configuration. If you want/need to test runtime situation please
     * use pluginTypeIsActive().
     */
    isNotEmptyPlugin(plugin:any):boolean {
        return plugin && !(plugin instanceof EmptyPlugin);
    }

    resetMenuActiveItemAndNotify():void {
        this.dispatcher.dispatch<typeof MainMenuActions.ClearActiveItem>({
            name: MainMenuActions.ClearActiveItem.name
        });
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
        this.renderLayoutReactComponent(
            menuViews.MainMenu,
            PageMount.MAIN_MENU_MOUNT,
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
        const target = window.document.getElementById(PageMount.GENERAL_OVERVIEW);
        if (target) {
            this.renderLayoutReactComponent(
                overviewViews.OverviewArea,
                PageMount.GENERAL_OVERVIEW,
                {
                    isLocalUiLang: this.getConf<boolean>('isLocalUiLang')
                }
            );
        }
    }

    private initViewOptions(mainMenuModel:MainMenuModel,
                generalViewOptionsModel:StatelessModel<GeneralViewOptionsModelState>,
                corpViewOptionsModel:CorpusViewOptionsModel):void {
        const viewOptionsViews = viewOptionsFactory({
            dispatcher: this.dispatcher,
            helpers: this.getComponentHelpers(),
            generalOptionsModel: generalViewOptionsModel,
            viewOptionsModel: corpViewOptionsModel,
            mainMenuModel
        });

        this.renderLayoutReactComponent(
            viewOptionsViews.OptionsContainer,
            PageMount.VIEW_OPTIONS,
            {
                corpusIdent: this.getCorpusIdent()
            }
        );
    }

    private initGlobalStyles():void {
        this.renderLayoutReactComponent(
            GlobalStyle,
            PageMount.GLOBAL_STYLE
        );
    }

    /**
     * @return true if the plug-in has been installed else false
     */
    private initIssueReporting():boolean {
        if (this.pluginTypeIsActive(PluginName.ISSUE_REPORTING)) {
            const mount = document.getElementById(PageMount.ERROR_REPORTING);
            if (mount) {
                const plugin = issueReportingPlugin(this.pluginApi())
                this.renderLayoutReactComponent(
                    plugin.getWidgetView(),
                    PageMount.ERROR_REPORTING,
                    this.getConf<Kontext.GeneralProps>('issueReportingAction')
                );
                return true;

            } else {
                console.warn(
                    'Cannot init issue reporting plug-in as footer-bar ' +
                    'plug-in does not provide a mount point'
                );
            }
        }
        return false;
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

    getLocal<T = string|number|boolean>(k:string, dflt?:T):T {
        const ans = this.userSettings.get<T>(k);
        return ans !== undefined ? ans : dflt;
    }

    supportsWebSocket():boolean {
        return window['WebSocket'] !== undefined && this.getConf('jobStatusServiceUrl');
    }

    openWebSocket<T, U>(path:string='', args?:{}):[Subject<T>, Observable<U>] {
        const params = args ?
                '?' + pipe(args, CURL.valueToPairs(), List.map(([k, v]) => `${k}=${v}`)) :
                '';
        const url = new URL(path + params, this.getConf<string>('jobStatusServiceUrl'));
        const ws = webSocket<any>(url.href);
        const input = new Subject<T>();
        input.subscribe(ws);
        const output = new Subject<U>();
        ws.subscribe(output);
        return tuple(input, output);
    }

    unregisterAllModels():void {
        this.asyncTaskChecker.unregister();
        this.corpusInfoModel.unregister();
        this.messageModel.unregister();
        this.userInfoModel.unregister();
        this.corpViewOptionsModel.unregister();
        this.mainMenuModel.unregister();
        this.generalViewOptionsModel.unregister();
        this.qsuggPlugin.unregister();
    }

    registerCorpusSwitchAwareModels(
        onDone:()=>void,
        ...models:Array<IUnregistrable>
    ):void {
        this.appNavig.registerCorpusSwitchAwareModels(
            () => {
                this.unregisterAllModels();
                onDone();
            },
            ...models
        );
    }

    registerPageLeaveVoters(...models:Array<IPageLeaveVoter<{}>>):void {
        this.appNavig.registerPageLeaveVoters(...models);
    }

    // this will enable key shortcuts

    initKeyShortcuts():void {
        const actionMap = this.mainMenuModel.exportKeyShortcutActions();
        actionMap.register(
            69,
            null,
            'DASHBOARD_TOGGLE_EXTENDED_INFO',
            {}
        );
        this.addGlobalKeyEventHandler((evt:KeyboardEvent) => {
            if (document.activeElement === document.body &&
                    !evt.ctrlKey && !evt.altKey && !evt.metaKey) {
                const action = actionMap.get(evt.keyCode, evt.shiftKey ? 'shift' : null);
                if (action) {
                    this.dispatcher.dispatch({
                        name: action.message,
                        payload: action.args
                    });
                }
            }
        });
    }

    /**
     * Page layout and content initialization. Any concrete page should
     * call this while passing its own initialization logic as the
     * pageInitFn argument. Please note that the page initialization is
     * expected to be synchronous. Any implicit asynchronous initialization
     * should be performed as a side effect of a respective model.
     */
    init(popupMessages:boolean, disabledMenuItems:Array<[string, string|null]>,
            pageInitFn:()=>void):void {
        try {
            this.asyncTaskChecker = new AsyncTaskChecker(
                this.dispatcher,
                this,
                this.getConf<any>('asyncTasks') || []
            );
            this.corpusInfoModel = new docModels.CorpusInfoModel(this.dispatcher, this.pluginApi());
            this.messageModel = new docModels.MessageModel(
                this.dispatcher,
                this.pluginApi(),
                this.getConf<boolean>('popupServerMessages')
            );

            this.layoutViews = documentViewsFactory(
                this.dispatcher,
                this.getComponentHelpers(),
                this.messageModel
            );

            this.userInfoModel = new UserInfo(this.dispatcher, this);

            this.qsuggPlugin = querySuggestPlugin(
                this.pluginApi()
            );
            this.corpViewOptionsModel = new CorpusViewOptionsModel(
                this.dispatcher,
                this,
                this.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
                this.getConf<boolean>('anonymousUser'),
                this.qsuggPlugin.listCurrentProviders()
            );

            this.mainMenuModel = new MainMenuModel({
                dispatcher: this.dispatcher,
                pageModel: this,
                initialData: disableMenuItems(
                    this.getConf<InitialMenuData>('menuData'),
                    ...disabledMenuItems
                ),
                concArgs: this.getConcArgs(),
                freqDefaultView: this.getConf<FreqResultViews>('FreqDefaultView')
            });

            this.generalViewOptionsModel = new GeneralViewOptionsModel(
                this.dispatcher,
                this,
                this.getConf<boolean>('anonymousUser')
            );

            this.searchHistoryModel = new SearchHistoryModel(
                this.dispatcher,
                this,
                0,
                this.getNestedConf<number>('pluginData', 'query_history', 'page_num_records'),
                this.getNestedConf<number>('pluginData', 'query_history', 'page_num_records')
            );

            const qhViews = initQueryHistoryViews({
                dispatcher: this.dispatcher,
                helpers: this.getComponentHelpers(),
                mainMenuModel: this.mainMenuModel,
                searchHistoryModel: this.searchHistoryModel
            });

            this.renderLayoutReactComponent(
                qhViews.HistoryContainer,
                PageMount.QUERY_HISTORY
            );

            this.commonViews = commonViewsFactory(this.getComponentHelpers());

            if (!window.hasOwnProperty('Blob')) {
                UnsupportedBlob.translate = (msg:string) => this.translate(msg);
                window['Blob'] = UnsupportedBlob;
            }
            window.onkeydown = (evt) => {
                this.globalKeyHandlers.forEach(fn => fn(evt));
            }
            this.userSettings.init();
            this.initGlobalStyles();
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

            const toolbarInitialized = this.getConf('toolbarInitialized') || false;
            this.appBarPlugin = applicationBar(this.pluginApi(), !toolbarInitialized);
            this.setConf('toolbarInitialized', true);

            footerBar(this.pluginApi());

            const auth:PluginInterfaces.Auth.IPlugin = authPlugin(this.pluginApi());
            if (this.isNotEmptyPlugin(auth)) {
                const userPaneView = auth.getUserPaneView();
                if (userPaneView) {
                    this.renderLayoutReactComponent(
                        userPaneView,
                        PageMount.USER_PANE,
                        {
                            isAnonymous: this.getConf<boolean>('anonymousUser'),
                            fullname: this.getConf<string>('userFullname')
                        }
                    );
                }
            }
            this.authPlugin = auth;
            this.initIssueReporting();
            this.registerCorpusSwitchAwareModels(
                () => undefined,
                this.appBarPlugin
            )

            pageInitFn();

        } catch (err) {
            this.showMessage('error', err);
            console.error(err);
        }
    }
}
