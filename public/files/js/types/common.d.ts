/*
 * Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../../ts/declarations/react.d.ts" />
/// <reference path="../../ts/declarations/flux.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />
/// <reference path="../../ts/declarations/immutable.d.ts" />
/// <reference path="../../ts/declarations/jquery.d.ts" />

/**
 *
 */
declare module Kontext {

    /**
     * Represents possible sources for MultiDict
     * (either a list of 2-tuples or a dict).
     */
    export type MultiDictSrc = Array<[string,any]>|{[key:string]:any};

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
     *
     */
    export type GeneralProps = {[key:string]:any};

    /**
     *
     */
    export type FluxDispatcher = Dispatcher.Dispatcher<DispatcherPayload>;

    /**
     * An interface used by KonText plug-ins
     */
    export interface PluginApi {
        getConf<T>(key:string):T;
        createStaticUrl(path:string):string;
        createActionUrl(path:string, args?:Array<[string,string]>|IMultiDict):string;
        ajax<T>(method:string, url:string, args:any, options?:AjaxOptions):RSVP.Promise<T>;
        ajaxAnim(): JQuery;
        ajaxAnimSmall();
        showMessage(type:string, message:any, onClose?:()=>void);
        translate(text:string, values?:any):string;
        formatNumber(v:number):string;
        formatDate(d:Date, timeFormat?:number):string;
        userIsAnonymous():boolean;
        dispatcher():Kontext.FluxDispatcher;
        exportMixins(...mixins:any[]):any[];
        renderReactComponent(reactClass:React.ReactClass,
                             target:HTMLElement, props?:React.Props):void;
        unmountReactComponent(element:HTMLElement):boolean;
        getStores():Kontext.LayoutStores;
        getViews():Kontext.LayoutViews;
        getUserSettings():Kontext.IUserSettings;
        hasPlugin(name:string):boolean;
        getConcArgs():IMultiDict;
    }

    /**
     * This interface is used by legacy non-React code in corparch plug-ins.
     * It attaches miscellaneous events which may happen in the query form
     * and to which these plug-ins must react to.
     */
    export interface QuerySetupHandler {

        registerOnSubcorpChangeAction(fn:(subcname:string)=>void):void;

        registerOnAddParallelCorpAction(fn:(corpname:string)=>void):void;

        registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void):void;

        registerOnRemoveParallelCorpAction(fn:(corpname:string)=>void):void;

        getCorpora():Immutable.List<string>;

        getAvailableAlignedCorpora():Immutable.List<{n:string; label:string}>;
    }

    /**
     * General specification of a plug-in object.
     */
    export interface Plugin {
        init(api:PluginApi):void;
    }

    export type MultipleViews = {[key:string]:React.ReactClass};

    /**
     * Flux+React compatible plug-ins.
     * An object of type T is expected to be an object
     * required by specific KonText interface. If there is
     * no need for one, null can be returned.
     */
    export interface PluginObject<T> {

        /**
         * Return initialized React classes used by KonText.
         * Plug-in should be able to return these objects before
         * create() is called but on the other hand it is not
         * expected for these views to be able to handle user
         * interaction before create() is called.
         */
        getViews():MultipleViews;

        /**
         * Instantiate and initialize plug-in itself (typically -
         * create required stores and connect them with KonText
         * stores/callbacks if needed).
         */
        create(pluginApi:Kontext.PluginApi):RSVP.Promise<T>;
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
    export interface IUserInfoStore extends PageStore {
        getCredentials():UserCredentials;
    }

    /**
     * A store handling state of server-asynchronous
     * tasks.
     */
    export interface IAsyncTaskStore extends PageStore {

        registerTask(task:Kontext.AsyncTaskInfo):void;

        getAsyncTasks():Immutable.List<Kontext.AsyncTaskInfo>;

        getNumRunningTasks():number;

        getNumFinishedTasks():number;

        init():void;

        /**
         * Add an external callback
         */
        addOnUpdate(fn:Kontext.AsyncTaskOnUpdate):void;
    }

    /**
     *
     */
    export interface MainMenuActiveItem {
        actionName:string;
        actionArgs:GeneralProps;
    }

    /**
     * This store is watched by components which are
     * able to render user content based on a selected
     * menu item.
     *
     */
    export interface IMainMenuStore extends PageStore {

        getActiveItem():MainMenuActiveItem;
        disableMenuItem(itemId:string, subItemId?:string):void;
        enableMenuItem(itemId:string, subItemId?:string):void;

        /**
         * Register an action which is run before listeners
         * are notified. This is used to allow other stores
         * to prepare themselves before their views are
         * shown.
         */
        addItemActionPrerequisite(actionName:string, fn:(args:GeneralProps)=>RSVP.Promise<any>);

        /**
         * Unregister an action which is run before listeners
         * are notified.
         */
        removeItemActionPrerequisite(actionName:string, fn:(args:GeneralProps)=>RSVP.Promise<any>);
    }

    /**
     * A store managing system messages presented to a user
     */
    export interface MessagePageStore extends PageStore {
        addMessage(messageType:string, messageText:string, onClose:()=>void);
    }

    /**
     * A function listening for change in a store.
     * In general, React components should not misuse
     * 'eventType' to make complex rules when to update
     * themselves.
     */
    export interface StoreListener {
        (store:Kontext.PageStore, eventType:string, err?:Error):void;
    }

    /**
     * Flux event dispatcher payload.
     */
    export interface DispatcherPayload {

        /**
         * Upper case action identifier
         */
        actionType:string;

        /**
         * Action's arguments. A defined, non-null
         * object should be always used.
         */
        props:{[name:string]:any};
    }

    /**
     *
     */
    export interface LayoutViews {
        ModalOverlay:React.ReactClass;
        PopupBox:React.ReactClass;
        CloseableFrame:React.ReactClass;
        InlineHelp:React.ReactClass;
        Messages:React.ReactClass;
        EmptyQueryOverviewBar:React.ReactClass;
    }

    /**
     * Convenient functions used by KonText's React components
     */
    export interface ComponentCoreMixins {
        translate(s:string, values?:any):string;
        getConf(k:string):any;
        createActionLink(path:string):string;
        createStaticUrl(path:string):string;
        formatNumber(value:number):string;
        formatDate(d:Date, timeFormat?:number):string;
        getLayoutViews():Kontext.LayoutViews;
        addGlobalKeyEventHandler(fn:(evt:Event)=>void):void;
        removeGlobalKeyEventHandler(fn:(evt:Event)=>void):void;
    }

    export interface LayoutStores {
        corpusInfoStore:PageStore,
        messageStore:MessagePageStore,
        userInfoStore:IUserInfoStore,
        viewOptionsStore:ViewOptions.IViewOptionsStore,
        asyncTaskInfoStore:IAsyncTaskStore,
        mainMenuStore:IMainMenuStore;
    }

    export interface AjaxOptions {
        contentType?:string;
        accept?:string;
    }

    export interface AjaxResponse {
        contains_errors:boolean;
        messages:Array<string>;
    }

    export interface AjaxConcResponse extends AjaxResponse {
        Q:Array<string>;
        conc_persistence_op_id:string;
        num_lines_in_groups:number;
        lines_groups_numbers:Array<number>;
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

    /**
     * A dictionary allowing multiple values per-key.
     * It is mostly used to carry URL arguments.
     */
    export interface IMultiDict {
        getFirst(key:string):string;
        getList(key:string):Array<string>;
        set(key:string, value:any):void;
        replace(key:string, values:Array<string>):void;
        remove(key:string):void;
        add(key:string, value:any):void;
        items():Array<Array<string>>;
        toDict():{[key:string]:string};
        has(key:string):boolean;
    }

    export interface IURLHandler {
        createStaticUrl(path:string):string;
        createActionUrl(path:string, args?:Array<Array<string>>):string;
        encodeURLParameters(params:IMultiDict):string
    }

    export interface IConcArgsHandler {
        getConcArgs():IMultiDict;
        setConcArg(name:string, value:any);
        replaceConcArg(name:string, values:Array<string>):void;

        /**
         * Export current conc args to a URL with additional
         * argument updates. Original arguments stored in model
         * are unchanged.
         */
        exportConcArgs(args:Array<Array<string>>|{[key:string]:any}):string;
    }

    export interface IHistory {
        pushState(action:string, args:Kontext.IMultiDict, stateData?:any, title?:string):void;
        replaceState(action:string, args:Kontext.IMultiDict, stateData?:any, title?:string):void;
        setOnPopState(fn:(event:{state: any})=>void):void;
    }

    export type RGBAColor = [number, number, number, number];
}


declare module ViewOptions {

    export interface AttrDesc {
        n: string;
        label: string;
        selected: boolean;
        locked: boolean;
    }

    export interface StructDesc {
        label: string;
        n: string;
        selected: boolean;
        locked: boolean;
    }

    export interface StructAttrDesc {
        n: string;
        selected: boolean;
    }

    export interface RefsDesc {
        n: string;
        label: string;
        selected: boolean;
    }

    export type AvailStructAttrs = Immutable.Map<string, Immutable.List<StructAttrDesc>>;

    export interface PageData {
        AttrList: Array<AttrDesc>;
        FixedAttr: string;
        AttrAllpos: string;
        AttrVmode: string;
        CurrentAttrs: Array<string>;
        AvailStructs: Array<{sel:string; label:string; n:string}>;
        StructAttrs:{[attr:string]:Array<string>};
        CurrStructAttrs:Array<string>;
        AvailRefs:Array<{n:string; sel:string; label:string}>;
        ShowConcToolbar:boolean;
    }

    export interface IViewOptionsStore {
        initFromPageData(data:ViewOptions.PageData):void;
        loadData():RSVP.Promise<ViewOptions.PageData>;
        isLoaded():boolean;
        addOnSave(fn:(data:AjaxResponse.SaveViewAttrsOptionsResponse)=>void):void;
        getAttributes():Immutable.List<ViewOptions.AttrDesc>;
        getSelectAllAttributes():boolean;
        getStructures():Immutable.List<ViewOptions.StructDesc>;
        getStructAttrs():ViewOptions.AvailStructAttrs;
        getReferences():Immutable.List<RefsDesc>;
        getSelectAllReferences():boolean;
        getFixedAttr():string;
        getAttrsVmode():string;
        getAttrsAllpos():string;
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

        ident: string;

        value:string;

        selected:boolean;

        locked:boolean;

        /**
         * How many items are actually hidden behind the value (= have the same name).
         * Value 1 means there is a single unique value available (such a value should
         * provide a bibliography information). Higher values mean that there are
         * multiple items with the same name (which means no biblography info)
         */
        numGrouped:number;

        /**
         * A number of tokens matching the value
         */
        availItems?:number;

        extendedInfo?:{[key:string]:any};
    }

    export interface AutoCompleteItem {
        ident: string;
        label: string;
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

    export interface AttrInfo {

        /**
         * a URL link leading to a documentation for the attribute
         */
        doc:string;

        /**
         * ??
         */
        docLabel:string;
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

        attrInfo:AttrInfo;

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
        mapValues(mapFn:(item:AttributeValue, i?:number)=>AttributeValue):AttributeSelection;

        /**
         */
        getValues():Immutable.List<AttributeValue>;

        /**
         * Set new attribute values
         *
         * @return a new copy of the original AttributeSelection
         */
        setValues(values:Array<AttributeValue>):AttributeSelection;

        /**
         * Add a new value to the list of the current ones.
         */
        addValue(value:AttributeValue):AttributeSelection;

        /**
         * Remove a value from the list of the current ones.
         */
        removeValue(value:string):AttributeSelection;

        /**
         *
         */
        clearValues():AttributeSelection;

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

        getNumOfSelectedItems():number;

        /**
         * Preserve only such attribute values whose values can be
         * found in the items array. In case the selection does
         * not contain any values then all the values within 'items'
         * are imported!
         */
        updateItems(items:Array<string>):AttributeSelection;

        /**
         *
         */
        filter(fn:(v:AttributeValue)=>boolean):AttributeSelection;

        /**
         *
         */
        setExtendedInfo(idx:number, data:Immutable.Map<string, any>):AttributeSelection;
    }

    /**
     *
     */
    interface ITextInputAttributeSelection extends AttributeSelection {

        getTextFieldValue():string;

        setTextFieldValue(v:string):ITextInputAttributeSelection;

        /**
         * Sets a list of items containing hints based on
         * the current (incomplete) user entry. This applies
         * in raw text input implementations - checkbox ones
         * should silently ignore this call (unless they
         * use it in some way).
         */
        setAutoComplete(values:Array<AutoCompleteItem>):ITextInputAttributeSelection;

        getAutoComplete():Immutable.List<AutoCompleteItem>;

        resetAutoComplete():ITextInputAttributeSelection;

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
         *
         */
        getTextInputAttribute(ident:string):ITextInputAttributeSelection

        /**
         * Return a list of all the defined attributes
         */
        getAttributes():Array<AttributeSelection>;

        /**
         * Get all available values of a specific attribute before
         * any filters were applied.
         */
        getInitialAvailableValues(attrName:string):Immutable.List<TextTypes.AttributeValue>;

        /**
         * Export checkbox selections (e.g. for ajax requests)
         */
        exportSelections(lockedOnesOnly:boolean):{[attr:string]:any};

        /**
         * Reset store state
         */
        reset():void;

        /**
         * Filter existing values of an attribute based on provided values.
         * E.g. if the attribute "x1" contains values {value: "foo",...}, {value: "bar",...},
         *  {value:"baz",....} and the "values"" argument contains ["bar", "baz"] then
         * the store is expected to keep {value: "bar",...}, {value: "baz", ....} for "x1".
         */
        updateItems(attrName:string, values:Array<string>):void;

        /**
         *
         */
        filter(attrName:string, fn:(v:AttributeValue)=>boolean):void;

        /**
         * Update existing values of an attribute via provided map function.
         * If the map function updates a record then it should create
         * a new copy. Unchanged objects can be returned directly.
         */
        mapItems(attrName:string, mapFn:(v:TextTypes.AttributeValue, i:number)=>TextTypes.AttributeValue);

        /**
         * Sets a new list of values for a specific attribute.
         */
        setValues(attrName:string, values:Array<string>):void;

        /**
         * Please note that this may not apply for all the
         * attribute items.
         */
        setAutoComplete(attrName:string, values:Array<AutoCompleteItem>):void;

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
         * Return the total number of tokens in all the
         * possible attribute values groups.
         */
        getAttrSize(attrName:string):number;

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

        setRangeMode(attrName:string, rangeIsOn:boolean);

        getRangeModes():Immutable.Map<string, boolean>;
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

declare module Legacy {

    export interface IPopupBox {
        getContentElement():HTMLElement;
        close():void;
    }
}




