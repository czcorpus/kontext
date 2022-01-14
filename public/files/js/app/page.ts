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
import { ITranslator, IFullActionControl, StatelessModel } from 'kombo';
import { Observable } from 'rxjs';
import { List, HTTP, tuple, pipe } from 'cnc-tskit';

import { PluginInterfaces, IPluginApi } from '../types/plugins';
import { Kontext } from '../types/common';
import { CoreViews } from '../types/coreViews';
import { init as documentViewsFactory } from '../views/document';
import { init as commonViewsFactory, CommonViews } from '../views/common';
import { init as menuViewsFactory } from '../views/menu';
import { init as overviewAreaViewsFactory } from '../views/overview';
import { init as viewOptionsFactory } from '../views/options/main';
import { init as initQueryHistoryViews } from '../views/history/main';
import { MultiDict } from '../multidict';
import * as docModels from '../models/common/layout';
import { UserInfo } from '../models/user/info';
import { CorpusViewOptionsModel } from '../models/options/structsAttrs';
import { GeneralViewOptionsModel, GeneralViewOptionsModelState } from '../models/options/general';
import { L10n } from './l10n';
import { AsyncTaskChecker, AsyncTaskStatus } from '../models/asyncTask';
import { UserSettings } from './userSettings';
import { MainMenuModel, InitialMenuData, disableMenuItems } from '../models/mainMenu';
import { AppNavigation } from './navigation';
import { EmptyPlugin } from '../plugins/empty/init';
import { Actions as MainMenuActions, ActionName as MainMenuActionName }
    from '../models/mainMenu/actions';
import { Actions as ATActions, ActionName as ATActionName } from '../models/asyncTask/actions';
import { ConcServerArgs, IConcArgsHandler } from '../models/concordance/common';
import { Actions, ActionName } from '../models/common/actions';
import applicationBar from 'plugins/applicationBar/init';
import footerBar from 'plugins/footerBar/init';
import authPlugin from 'plugins/auth/init';
import issueReportingPlugin from 'plugins/issueReporting/init';
import querySuggestPlugin from 'plugins/querySuggest/init';
import queryStoragePlugin from 'plugins/queryStorage/init';
import { IPageLeaveVoter } from '../models/common/pageLeave';
import { IUnregistrable } from '../models/common/common';
import { PluginName } from './plugin';


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

    qsuggPlugin:PluginInterfaces.QuerySuggest.IPlugin;

    qstorPlugin:PluginInterfaces.QueryStorage.IPlugin;

    /**
     * This is intended for React components to make them able register key
     * events (e.g. the 'ESC' key). But it is always a preferred approach
     * to focus a suitable element and catch event via that.
     */
    private globalKeyHandlers:Array<(evt:Event)=>void>;

    private readonly appNavig:AppNavigation;

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
            corpusSwitchModel: this.appNavig.corpusSwitchModel
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
     * @param filename
     * @param url
     * @param args
     */
    bgDownload(filename:string, type:DownloadType, url:string, args?:Kontext.AjaxArgs):void {
        const taskId = `${new Date().getTime()}:${url}`;
        const method = () => {
            if (type === DownloadType.FREQ2D || type === DownloadType.LINE_SELECTION) {
                return HTTP.Method.POST;
            }
            return HTTP.Method.GET;
        };

        this.dispatcher.dispatch<ATActions.InboxAddAsyncTask>({
            name: ATActionName.InboxAddAsyncTask,
            payload: {
                ident: taskId,
                label: filename,
                category: type
            }
        });
        this.appNavig.bgDownload(filename, url, method(), args).subscribe(
            () => {
                this.dispatcher.dispatch<ATActions.InboxUpdateAsyncTask>({
                    name: ATActionName.InboxUpdateAsyncTask,
                    payload: {
                        ident: taskId,
                        status: AsyncTaskStatus.SUCCESS
                    }
                });
            },
            (err) => {
                this.dispatcher.dispatch<ATActions.InboxUpdateAsyncTask>({
                    name: ATActionName.InboxUpdateAsyncTask,
                    payload: {
                        ident: taskId,
                        status: AsyncTaskStatus.FAILURE
                    }
                });
            }
        );
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
                    (<HTMLInputElement>form.querySelector('input.continue')).value =
                        window.location.href;
                    (<HTMLFormElement>form).submit();
                });
            }
        }
    }

    dispatchServerMessages() {
        List.forEach(
            ([messageType, message]) => {
                this.dispatcher.dispatch<Actions.MessageAdd>({
                    name: ActionName.MessageAdd,
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
     * @param msgType - type of the message
     * @param message - text of the message in most cases; in case of
     *                  the 'error' type: Error instance, XMLHttpRequest instance
     *                  or an object containing an attribute 'messages' can
     *                  be used.
     */
    showMessage(msgType:Kontext.UserMessageTypes, message:any):void {
        this.dispatcher.dispatch<Actions.MessageAdd>({
            name: ActionName.MessageAdd,
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
    createActionUrl<T>(path:string, args?:Array<[keyof T, T[keyof T]]>|Kontext.IMultiDict<T>):string {
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
    encodeURLParameters<T>(params:MultiDict<T>):string {
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
     */
    exportConcArgs():MultiDict<ConcServerArgs> {
        const args = this.getConcArgs();
        return new MultiDict([
            tuple('maincorp', args.maincorp),
            tuple('viewmode', args.viewmode),
            tuple('format', args.format),
            tuple('pagesize', args.pagesize),
            tuple('attrs', args.attrs),
            tuple('attr_vmode', args.attr_vmode),
            tuple('base_viewattr', args.base_viewattr),
            tuple('ctxattrs', args.ctxattrs),
            tuple('structs', args.structs),
            tuple('refs', args.refs),
            tuple('fromp', args.fromp),
            tuple('q', args.q)
        ]);
    }

    getConcArgs():ConcServerArgs {
        return {
            maincorp: undefined,
            viewmode: 'kwic',
            format: undefined,
            pagesize: 0,
            attrs: undefined,
            attr_vmode: undefined,
            base_viewattr: undefined,
            ctxattrs: undefined,
            structs: undefined,
            refs: undefined,
            fromp: undefined,
            q: undefined,
            ...this.getConf<ConcServerArgs>('currentArgs')
        };
    }

    /**
     * Replace a specified argument of the current concordance. The action
     * triggers an event calling all the config change handlers.
     */
    replaceConcArg(name:string, values:Array<string>):void {
        const tmp = this.getConcArgs();
        if (name in tmp) {
            if (Array.isArray(tmp[name])) {
                tmp[name] = values;

            } else if (!List.empty(values)) {
                tmp[name] = values[0];

            } else {
                tmp[name] = undefined;
            }
            this.setConf<ConcServerArgs>('currentArgs', tmp);

        } else {
            throw new Error(`Unknown conc. arg. ${name}`);
        }
    }

    updateConcPersistenceId(value:string|Array<string>):void {
        if (Array.isArray(value)) {
            this.replaceConcArg('q', value);
            const concIds = pipe(
                value,
                List.filter(v => v[0] === '~'),
                List.map(v => v.substr(1))
            );
            if (!List.empty(concIds)) {
                this.setConf<string>('concPersistenceOpId', List.head(concIds));
            }

        } else {
            this.replaceConcArg('q', ['~' + value]);
            this.setConf<string>('concPersistenceOpId', value);
        }
        this.dispatcher.dispatch<Actions.ConcArgsUpdated>({
            name: ActionName.ConcArgsUpdated,
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
        this.dispatcher.dispatch<MainMenuActions.ClearActiveItem>({
            name: MainMenuActionName.ClearActiveItem
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
        if (this.pluginTypeIsActive(PluginName.ISSUE_REPORTING)) {
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

    openWebSocket(args:MultiDict):WebSocket|null {
        if (window['WebSocket'] !== undefined && this.getConf('webSocketUrl')) {
            const ans = new WebSocket(this.getConf('webSocketUrl') + '?' +
                this.encodeURLParameters(args));
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
                this.pluginApi(),
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

            this.mainMenuModel = new MainMenuModel(
                this.dispatcher,
                this,
                disableMenuItems(
                    this.getConf<InitialMenuData>('menuData'),
                    ...disabledMenuItems
                ),
                this.getConcArgs()
            );

            this.generalViewOptionsModel = new GeneralViewOptionsModel(
                this.dispatcher,
                this,
                this.getConf<boolean>('anonymousUser')
            );

            this.qstorPlugin = queryStoragePlugin(
                this.pluginApi(),
                0,
                this.getNestedConf<number>('pluginData', 'query_storage', 'page_num_records'),
                this.getNestedConf<number>('pluginData', 'query_storage', 'page_num_records')
            );
            const qhViews = initQueryHistoryViews({
                dispatcher: this.dispatcher,
                helpers: this.getComponentHelpers(),
                recentQueriesModel: this.qstorPlugin.getModel(),
                mainMenuModel: this.mainMenuModel
            });

            this.renderReactComponent(
                qhViews.HistoryContainer,
                document.getElementById('query-history-mount')
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

            const toolbarInitialized = this.getConf('toolbarInitialized') || false;
            this.appBarPlugin = applicationBar(this.pluginApi(), !toolbarInitialized);
            this.setConf('toolbarInitialized', true);

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
