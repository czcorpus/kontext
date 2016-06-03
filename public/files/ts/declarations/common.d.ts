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
/// <reference path="./jquery.d.ts" />

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
        showMessage(type:string, message:string, onClose?:()=>void); // TODO type: MsgType vs string
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
        hasPlugin(name:string):boolean;
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

        notifyChangeListeners(eventType:string, error?:Error):void;
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

    /**
     * Convenient functions used by KonText's React components
     */
    export interface ComponentCoreMixins {
        translate(s:string, values?:any):string;
        getConf(k:string):any;
        createActionLink(path:string):string;
        createStaticUrl(path:string):string;
        getLayoutViews():Kontext.LayoutViews;
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
        error:string; // = Celery's "result" property in case status == 'FAILURE'
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
 * This module contains types used along with text type
 * selection component (e.g. when creating a subcorpus).
 */
declare module TextTypes {

    /**
     *
     */
    export interface AttributeValue {
        value:string;
        selected:boolean;
        locked:boolean;
        availItems?:string; // a formatted string representation of a respective number
        extendedInfo?:{[key:string]:any};
    }

    /**
     * A map of selected attribute values as
     * obtained from server.
     *
     * format: attr_name_1 => [val1#1, val1#2,...],
     *         attr_name_2 => [val2#1, val2#2,...]
     */
    export interface ServerCheckedValues {
        [key:string]:Array<string>;
    }

    /**
     * An object representing an abstract selection
     * of attribute values.
     *
     * All the modifier methods are expected to
     * return a new copy of the original object to
     * preserve immutability.
     *
     * Note: non-checkbox-like implementations must
     * still implement all the methods even if they do not
     * make much sense there. This is necessary because
     * of KonText's React components which use duck typing
     * to determine which sub-component to use.
     */
    export interface AttributeSelection {

        attrDoc:string;  // ??

        attrDocLabel:string; // ??

        isInterval:boolean;

        isNumeric:boolean;

        label:string;

        name:string;


        /**
         * Tests whether there is at least one attribute value locked
         */
        isLocked():boolean;

        /**
         */
        updateValues(mapFn:(item:AttributeValue, i?:number)=>AttributeValue):AttributeSelection;

        /**
         * Set new attribute values
         *
         * @return a new copy of the original AttributeSelection
         */
        setValues(values:Array<AttributeValue>):AttributeSelection;

        /**
         * Sets a list of items containing hints based on
         * the current (incomplete) user entry. This applies
         * in raw text input implementations - checkbox ones
         * should silently ignore this call (unless they
         * use it in some way).
         */
        setAutoComplete(values:Array<string>):void;

        /**
         *
         */
        getAutoComplete():Immutable.List<string>;

        /**
         * Flip checked/unchecked status of the value
         */
        toggleValueSelection(idx:number):AttributeSelection;

        /**
         * Return true in case the selection contains a list
         * of all available values.
         */
        containsFullList():boolean;

        /**
         * Return true if the original status has been
         * changed.
         */
        hasUserChanges():boolean;

        /**
         * Export selection status to a simple object
         */
        exportSelections(lockedOnesOnly:boolean):any;

        /**
         * Preserve only such attribute values whose values can be
         * found in the items array.
         */
        filterItems(items:Array<string>):AttributeSelection; // TODO mutability

        /**
         *
         */
        filter(fn:(v:AttributeValue)=>boolean):AttributeSelection;

        /**
         *
         */
        setExtendedInfo(idx:number, data:Immutable.Map<string, any>):AttributeSelection;

        /**
         *
         */
        setValue(v:string):AttributeSelection;
    }


    /**
     *
     */
    export interface ITextTypesStore extends Kontext.PageStore {

        /**
         * Return a defined structural attribute
         */
        getAttribute(ident:string):TextTypes.AttributeSelection;

        /**
         * Return a list of all the defined attributes
         */
        getAttributes():Array<AttributeSelection>;

        /**
         * Export checkbox selections (e.g. for ajax requests)
         */
        exportSelections(lockedOnesOnly:boolean):{[attr:string]:any};

        /**
         * Reset store state
         */
        reset():void;

        /**
         * Return a name of the last attribute used
         * by a range selection widget.
         */
        getLastActiveRangeAttr():string;

        /**
         * Filter existing values of an attribute based on provided values.
         * E.g. if the attribute "x1" contains values {value: "foo",...}, {value: "bar",...},
         *  {value:"baz",....} and the "values"" argument contains ["bar", "baz"] then
         * the store is expected to keep {value: "bar",...}, {value: "baz", ....} for "x1".
         */
        filterItems(attrName:string, values:Array<string>):void;

        /**
         *
         */
        filter(attrName:string, fn:(v:AttributeValue)=>boolean):void;

        /**
         * Update existing values of an attribute via provided map function.
         * If the map function updates a record then it should create
         * a new copy. Unchanged objects can be returned directly.
         */
        updateItems(attrName:string, mapFn:(v:TextTypes.AttributeValue, i:number)=>TextTypes.AttributeValue);

        /**
         * Sets a new list of values for a specific attribute.
         */
        setValues(attrName:string, values:Array<string>):void;

        /**
         * Please note that this may not apply for all the
         * attribute items.
         */
        setAutoComplete(attrName:string, values:Array<string>):void;

        /**
         * Returns true if a specific attribute contains at least one selected
         * value.
         */
        hasSelectedItems(attrName:string):boolean;

        /**
         * Returns a list of attribute names passing 'hasSelectedItems' test.
         */
        getAttributesWithSelectedItems(includeLocked:boolean):Array<string>;

        /**
         * Sets a (typically) numeric summary for a specific attribute.
         */
        setAttrSummary(attrName:string, value:AttrSummary):void;

        /**
         * Returns a (typically) numeric summary for a specific attribute.
         */
        getAttrSummary():Immutable.Map<string, AttrSummary>;

        /**
         * Activate a support for attaching an extended information
         * for a specific attribute. The 'fn' callback is expected
         * to update store(s) in such a way that the information becomes
         * available.
         */
        setExtendedInfoSupport<T>(attrName:string, fn:(idx:number)=>RSVP.Promise<T>):void;

        /**
         * Returns true if a specific attribute has activated support
         * for displaying extended information.
         */
        hasDefinedExtendedInfo(attrName:string):boolean;

        /**
         * Attaches an extended information item to a specific attribute value.
         * This is typically used by setExtendedInfoSupport's callback function.
         */
        setExtendedInfo(attrName:string, idx:number, data:Immutable.Map<string, any>):void;


        setTextInputChangeCallback(fn:(attrName:string, inputValue:string)=>void):void;

        getTextInputPlaceholder():string;

        setTextInputPlaceholder(s:string):void;
    }

    /**
     * An additional information containing information
     * about an attribute.
     */
    export interface AttrSummary {
        text:string;
        help?:string;
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


