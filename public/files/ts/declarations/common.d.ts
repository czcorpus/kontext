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

/**
 *
 */
declare module Kontext {

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
        getConf(key:string):any;
        createStaticUrl(path:string):string;
        createActionUrl(path:string):string;
        ajax(...args:any[]);
        ajaxAnim(): JQuery;
        ajaxAnimSmall();
        appendLoader();
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
        renderReactComponent(reactObj:(mixins:Array<{}>)=>React.ReactClass,
                             target:HTMLElement, props?:React.Props):void;
        unmountReactComponent(element:HTMLElement):boolean;
        getStores():Kontext.LayoutStores;
        getViews():Kontext.LayoutViews;
    }

    /**
     *
     */
    export interface FirstFormPage extends PluginApi {
        registerOnSubcorpChangeAction(fn:(subcname:string)=>void);
        registerOnAddParallelCorpAction(fn:(corpname:string)=>void);
        registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void);
    }

    /**
     * This contains extensions required by pages which contain query input form
     */
    export interface QueryPagePluginApi extends PluginApi {
        bindFieldsetToggleEvent(callback:(fieldset:HTMLElement) => void);
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
     *
     */
    export interface MessagePageStore extends PageStore {
        addMessage(messageType:string, messageText:string);
    }

    /**
     *
     */
    export interface StoreListener{
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
        CorpusInfoBox:React.ReactClass;
        PopupBox:React.ReactClass;
        Messages:React.ReactClass;
        QueryHints:React.ReactClass;
    }

    export interface LayoutStores {
        corpusInfoStore:PageStore,
        messageStore:MessagePageStore
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
 *
 */
declare module "plugins/applicationBar/init" {
    export function createInstance(pluginApi:Kontext.PluginApi);
}

/**
 *
 */
declare module "win" {
    var win:Window;

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


