/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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

/// <reference path="./react.d.ts" />
/// <reference path="./flux.d.ts" />
/// <reference path="./rsvp.d.ts" />
/// <reference path="./immutable.d.ts" />

/**
 *
 */
declare module Kontext {

    export interface UserCredentials {
        context_limit:number;
        sketches:boolean;
        never_expire:boolean;
        firstname:string;
        country:string;
        regist:any; // TODO
        email:string;
        username:string;
        affiliation:string;
        expire:any; // TODO
        lastname:string;
        address:string;
        active:boolean;
        affiliation_country:string;
        category:string;
        id:number;
        recovery_until:any; // TODO
    }

    export interface IUserSettings {
        get<T>(key:string):T;
        set(key:string, value):void;
        init():void;
    }

    /**
     * Specifies a configuration object generated at runtime
     */
    export interface Conf {
        [key:string]: any;
    }

    /**
     */
    export interface InitCallbackObject {
        plugin:string;
        method:string;
        args?:Array<any>;
    }

    /**
     * Either a function or an object
     */
    export type InitCallback = InitCallbackObject|(()=>void);

    /**
     * An interface used by KonText plug-ins
     */
    export interface PluginApi {
        getConf<T>(key:string):T;
        createStaticUrl(path:string):string;
        createActionUrl(path:string):string;
        ajax<T>(method:string, url:string, args:any, options:AjaxOptions):RSVP.Promise<T>;
        ajaxAnim(): JQuery;
        ajaxAnimSmall();
        appendLoader(elm:HTMLElement, options?:{domId:string; htmlClass:string}):void;
        showMessage(type:string, message:string); // TODO type: MsgType vs string
        translate(text:string, values?:any):string;
        formatNumber(v:number):string;
        formatDate(d:Date):string;
        applySelectAll(elm:HTMLElement, context:HTMLElement);
        registerReset(fn:Function);
        registerInitCallback(fn:InitCallback):void;
        registerInitCallback(fn:()=>void):void;
        userIsAnonymous():boolean;
        contextHelp(triggerElm:HTMLElement, text:string);
        shortenText(s:string, length:number);
        dispatcher():Dispatcher.Dispatcher<any>; // TODO type
        exportMixins(...mixins:any[]):any[];
        renderReactComponent(reactClass:React.ReactClass,
                             target:HTMLElement, props?:React.Props):void;
        unmountReactComponent(element:HTMLElement):boolean;
        getStores():Kontext.LayoutStores;
        getViews():Kontext.LayoutViews;
        getPlugin<T extends Kontext.Plugin>(name:string):T;
        getUserSettings():Kontext.IUserSettings;
    }

    export interface CorpusSetupHandler {

        registerOnSubcorpChangeAction(fn:(subcname:string)=>void):void;

        registerOnAddParallelCorpAction(fn:(corpname:string)=>void):void;

        registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void):void;

        registerOnRemoveParallelCorpAction(fn:(corpname:string)=>void):void;
    }

    /**
     * This contains extensions required by pages which contain query input form
     */
    export interface QueryPagePluginApi extends PluginApi, CorpusSetupHandler {
        /**
         * Adds a callback which is fired after user changes visibility
         * of advanced settings fieldsets on the query page (= "Specify context",
         * "Specify query according to the meta-information").
         *
         * Initial setup of these fieldsets is not included here
         * (see bindFieldsetReadyEvent()).
         */
        bindFieldsetToggleEvent(callback:(fieldset:HTMLElement) => void);

        /**
         * Adds a callback which is fired after the advanced settings fieldsets on
         * the query page (= "Specify context", "Specify query according to the
         * meta-information") are initialized.
         */
        bindFieldsetReadyEvent(callback:(fieldset:HTMLElement) => void);

        registerOnSubcorpChangeAction(fn:(subcname:string)=>void);

        registerOnAddParallelCorpAction(fn:(corpname:string)=>void);

        registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void);

        applyOnQueryFieldsetToggleEvents(elm:HTMLElement);

        applyOnQueryFieldsetReadyEvents(elm:HTMLElement);

    }

    /**
     * General specification of a plug-in object.
     */
    export interface Plugin {
        init(api:PluginApi):void;
    }


    /**
     *
     */
    export interface PluginProvider {
        getPlugin(name:string):Plugin;
    }

    /**
     * Any closeable component (closing means here that
     * the component stops what it is doing and hides itself).
     */
    export interface Closeable {
        close(): void;
    }

    /**
     * A Flux Store. Please note that only Flux Views are expected
     * to (un)register store's events.
     */
    export interface PageStore {

        addChangeListener(fn:()=>void):void;

        removeChangeListener(fn:()=>void):void;

        notifyChangeListeners():void;
    }

    /**
     * A store managing access to a user information
     */
    export interface UserInfoStore extends PageStore {
        getCredentials():UserCredentials;
    }

    /**
     * A store managing system messages presented to a user
     */
    export interface MessagePageStore extends PageStore {
        addMessage(messageType:string, messageText:string, onClose:()=>void);
    }

    /**
     * A store managing miscellaneous application usage hints
     */
    export interface IQueryHintStore extends PageStore {
        getHint():string;
    }

    /**
     *
     */
    export interface StoreListener {
        (store:Kontext.PageStore, eventType:string, err?:Error):void;
    }

    /**
     *
     */
    export interface DispatcherPayload {
        actionType:string;
        props:{[name:string]:any};
    }

    /**
     *
     */
    export interface LayoutViews {
        CorpusReference:React.ReactClass;
        CorpusInfoBox:React.ReactClass;
        PopupBox:React.ReactClass;
        Messages:React.ReactClass;
        QueryHints:React.ReactClass;
        SubcorpusInfo:React.ReactClass;
    }

    export interface LayoutStores {
        corpusInfoStore:PageStore,
        messageStore:MessagePageStore,
        queryHintStore:IQueryHintStore,
        userInfoStore:UserInfoStore
    }

    export interface AjaxOptions {
        contentType?:string;
        accept?:string;
    }

    export interface AjaxResponse {
        contains_errors:boolean;
        messages:Array<string>;
    }

    export interface AsyncTaskInfo {
        ident:string;
        label:string;
        category:string;
        status:string; // one of PENDING, STARTED, RETRY, FAILURE, SUCCESS
        created:number;
        args:{[key:string]:any};
    }

    export interface AsyncTaskOnUpdate {
        (taskInfoList:Immutable.List<AsyncTaskInfo>):void;
    }
}


/**
 * This module contains types for customizable parts of KonText
 * client-side code.
 */
declare module Customized {

    /**
     * A factory class for generating corplist page. The page is expected
     * to contain two blocks
     *  - a form (typically a filter)
     *  - a dataset (= list of matching corpora)
     *
     */
    export interface CorplistPage {

        createForm(targetElm:HTMLElement, properties:any):void;

        createList(targetElm:HTMLElement, properties:any):void;
    }
}

/**
 * Required plug-in interfaces
 */
declare module Plugins {

    export interface IQueryStorage extends Kontext.Plugin {
        detach(elm:HTMLElement):void;
        reset():void;
    }
}

/**
 *
 */
declare module "win" {
    var win:typeof window;

    export = win;
}

/**
 *
 */
declare module "queryInput" {
    export function cmdSwitchQuery(event:any, conf:any); // TODO types
    export function bindQueryHelpers(formElm:string|HTMLElement|JQuery, api:Kontext.PluginApi);
}

/**
 *
 */
declare module "views/document" {
    export function init(...args:any[]):Kontext.LayoutViews;
}


