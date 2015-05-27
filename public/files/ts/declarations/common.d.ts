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
        translate(text:string):string;
        applySelectAll(elm:HTMLElement, context:HTMLElement);
        registerReset(fn:Function);
        resetToHomepage(params:any); // TODO
        userIsAnonymous():boolean;
        contextHelp(triggerElm:HTMLElement, text:string);
        shortenText(s:string, length:number);
        initReactComponent(factory:(mixins:Array<{}>)=>any, ...mixins:any[]):any;
        renderReactComponent(reactClass, target:HTMLElement, props:{[key:string]:any}):void;
    }

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

}

declare module "plugins/applicationBar" {
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
    export function cmdSwitchQuery(plugProvider:Kontext.PluginProvider, event:any, conf:any); // TODO types
    export function bindQueryHelpers(api:Kontext.PluginApi);
}

/**
 *
 */
declare module "views/document" {
    var corpusInfoBoxFactory:any;
}