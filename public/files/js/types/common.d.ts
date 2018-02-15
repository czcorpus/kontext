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

/// <reference path="../vendor.d.ts/react.d.ts" />
/// <reference path="../vendor.d.ts/flux.d.ts" />
/// <reference path="../vendor.d.ts/rsvp.d.ts" />
/// <reference path="../vendor.d.ts/immutable.d.ts" />

/// <reference path="../types/coreViews.d.ts" />


declare interface ObjectConstructor {
    assign(target: any, ...sources: any[]): any;
}


/**
 *
 */
declare module Kontext {

    /**
     *
     */
    export type GeneralProps = {[key:string]:any};

    /**
     * Represents possible sources for MultiDict
     * (either a list of 2-tuples or a dict).
     */
    export type MultiDictSrc = Array<[string,any]>|GeneralProps;

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
     * Specifies a configuration object generated at runtime.
     * In page models, layoutModel.getConf<T>() should be
     * always the preferred way how to access conf values.
     */
    export interface Conf {
        [key:string]: any;
    }

    export interface IConfHandler {
        getConf<T>(item:string):T;
        setConf<T>(key:string, value:T):void;
        addConfChangeHandler<T>(key:string, handler:(v:T)=>void):void;
    }

    /**
     *
     */
    export type FluxDispatcher = Dispatcher.Dispatcher<DispatcherPayload>;

    export interface FullCorpusIdent {
        id:string;
        canonicalId:string; // will be deprecated in 0.12.x
        variant:string;
        name:string;
    }

    /**
     * An interface used by KonText plug-ins
     */
    export interface PluginApi {
        getConf<T>(key:string):T;
        createStaticUrl(path:string):string;
        createActionUrl(path:string, args?:Array<[string,string]>|IMultiDict):string;
        ajax<T>(method:string, url:string, args:any, options?:AjaxOptions):RSVP.Promise<T>;
        showMessage(type:string, message:any, onClose?:()=>void);
        unpackServerError(resp:Kontext.AjaxResponse):Error;
        translate(text:string, values?:any):string;
        formatNumber(v:number):string;
        formatDate(d:Date, timeFormat?:number):string;
        userIsAnonymous():boolean;
        dispatcher():Kontext.FluxDispatcher;
        getComponentHelpers():Kontext.ComponentHelpers;
        renderReactComponent<T, U>(reactClass:React.ComponentClass<T, U>|React.FuncComponent<T>,
                             target:HTMLElement, props?:T):void;
        unmountReactComponent(element:HTMLElement):boolean;
        getStores():Kontext.LayoutStores;
        getViews():CoreViews.Runtime;
        pluginIsActive(name:string):boolean;
        getConcArgs():IMultiDict;
        registerSwitchCorpAwareObject(obj:Kontext.ICorpusSwitchAware<any>):void;
        resetMenuActiveItemAndNotify():void;
        getHelpLink(ident:string):string;
    }

    /**
     * This interface is used by legacy non-React code in corparch plug-ins.
     * It attaches miscellaneous events which may happen in the query form
     * and to which these plug-ins must react to.
     */
    export interface QuerySetupHandler {

        registerCorpusSelectionListener(fn:(corpusId:string, aligned:Immutable.List<string>, subcorpusId:string)=>void):void;

        getCorpora():Immutable.List<string>;

        getAvailableAlignedCorpora():Immutable.List<{n:string; label:string}>;

        getCurrentSubcorpus():string;
    }

    /**
     * A general click action performed on featured/favorite/searched item
     */
    export interface CorplistItemClick {
        (corpora:Array<string>, subcorpId:string):RSVP.Promise<any>;
    }

    /**
     * General specification of a plug-in object.
     */
    export interface PluginFactory<T> {
        (api:PluginApi):RSVP.Promise<T>;
    }


    /**
     * A Flux Store. Please note that only Flux Views are expected
     * to (un)register store's events.
     */
    export interface PageStore {

        addChangeListener(fn:()=>void):void;

        removeChangeListener(fn:()=>void):void;

        /**
         * NOTE: both arguments are deprecated. There should
         * be only a single source of state - Flux stores.
         */
        notifyChangeListeners(eventType?:string, error?:Error):void;
    }

    /**
     * A store that another store can wait for.
     */
    export interface ComposableStore extends PageStore {
        getDispatcherToken():string;
    }

    /**
     * A store managing access to a user information
     */
    export interface IUserInfoStore extends PageStore {
        getCredentials():UserCredentials;
        loadUserInfo(forceReload:boolean):RSVP.Promise<boolean>;
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

    export interface MainMenuAtom {
        actionName:string;
        actionArgs:GeneralProps;
        keyCode:number;
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

        exportKeyShortcutActions():Immutable.Map<number, MainMenuAtom>

        /**
         * Bind a custom event handler (typically a one dispatching a custom
         * Flux action) to a server-defined main menu sub-item. Server config
         * (see conf/main-menu.sample.json) is expected to provide a unique
         * 'ident' for the item which is then used when calling this method.
         * In case such an item is defined and no binding is called for the item,
         * main menu React component will omit it when rendering the result.
         *
         * This is an ideal solution for miscellaneous plug-in features not
         * included in KonText core.
         */
        bindDynamicItem(ident:string, label:string, handler:()=>void);
    }

    export interface UserNotification {
        messageId:string;
        messageType:string;
        messageText:string;
        fadingOut:boolean;
    }

    /**
     * A store managing system messages presented to a user
     */
    export interface MessagePageStore extends PageStore {
        addMessage(messageType:string, messageText:string, onClose:()=>void);
        getMessages():Immutable.List<UserNotification>;
        getTransitionTime():number;
    }

    /**
     * A function listening for change in a store. This is
     * used by React components to handle store updates.
     */
    export interface StoreListener {
        (err?:Error):void;
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
        props:GeneralProps;
    }

    /**
     * Convenient functions used by KonText's React components
     */
    export interface ComponentHelpers {

        /**
         * Translate a message key (and possible passed placeholder
         * replacement values) based on KonText translation mapping
         * JSON file.
         */
        translate(s:string, values?:any):string;

        /**
         * Create a proper action URL based on normalized format
         * (e.g. 'first_form' translates to
         * http://localhost/kontext/first_form depending
         * on a concrete configuration).
         */
        createActionLink(path:string):string;

        /**
         * Create a proper static resource URL based on normalized
         * format (.e.g. 'img/foo.svg' translates to
         * http://localhost/kontext/static/img/foo.svg' depending
         * on a concrete configuration).
         */
        createStaticUrl(path:string):string;

        /**
         * Format a number based on current UI locales.
         */
        formatNumber(value:number, fractionDigits?:number):string;

        /**
         * Format a date based on current UI locales.
         */
        formatDate(d:Date, timeFormat?:number):string;

        /**
         * Provides access to shared (= related to page layout)
         * components.
         */
        getLayoutViews():CoreViews.Runtime;

        addGlobalKeyEventHandler(fn:(evt:Event)=>void):void;

        removeGlobalKeyEventHandler(fn:(evt:Event)=>void):void;

        /**
         * Make a shallow copy of a (state) object.
         * It is best used with state objects containing
         * primitive values or Immutable.js instances.
         */
        cloneState<T>(obj:T):T;

        doThingsWithDelay(immediateFn:()=>void, actualFn:()=>void, delay:number):void;

        getHelpLink(ident:string):string;
    }

    export interface LayoutStores {
        corpusInfoStore:PageStore,
        messageStore:MessagePageStore,
        userInfoStore:IUserInfoStore,
        corpusViewOptionsStore:ViewOptions.ICorpViewOptionsStore,
        generalViewOptionsStore:ViewOptions.IGeneralViewOptionsStore;
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
        args:GeneralProps;
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
        size():number;
    }

    export interface IURLHandler {
        createStaticUrl(path:string):string;
        createActionUrl(path:string, args?:Array<Array<string>>|IMultiDict):string;
        encodeURLParameters(params:IMultiDict):string
    }

    export interface IConcArgsHandler {
        getConcArgs():IMultiDict;
        replaceConcArg(name:string, values:Array<string>):void;

        /**
         * Export current conc args to a URL with additional
         * argument updates. Original arguments stored in model
         * are unchanged.
         */
        exportConcArgs(args:Array<Array<string>>|GeneralProps):string;
    }

    export interface IHistory {
        pushState(action:string, args:Kontext.IMultiDict, stateData?:any, title?:string):void;
        replaceState(action:string, args:Kontext.IMultiDict, stateData?:any, title?:string):void;
        setOnPopState(fn:(event:{state: any})=>void):void;
    }

    export type RGBAColor = [number, number, number, number];

    /**
     * This represent an already encode query
     * operation (i.e. the one without individual
     * form attributes but with encoded q=[...] value
     * understood by Manatee).
     *
     * Please note that these objects are used
     * only marginally and as read-only ones.
     */
    export interface QueryOperation {

        op:string;

        /**
         * A single letter operation type ID as used by
         * the server-side (see function mapOpIdToFormType()
         * below). Do not confuse with opKey used within
         * QueryReplayStore.
         */
        opid:string;

        /**
         * Human-readable description of the current
         * operation.
         */
        nicearg:string;

        /**
         * Contains URL-encoded query including all the previous
         * query operations (see the difference with the 'arg' below).
         */
        tourl:string;

        /**
         * contains
         */
        arg:string;

        /**
         * Generated by server but unused on client-side
         */
        churl:string;

        /**
         * Result size in tokens after this operation
         * was executed.
         */
        size:number;
    }

    export interface QueryHistoryItem {
        /**
         * An index in list, always respecting offset (i.e. the
         * server can return values starting from i > 0).
         */
        idx:number;

        /**
         * If not null then the item is persistent
         */
        name?:string;

        corpname:string;
        canonical_corpus_id:string;
        human_corpname:string;
        /**
         * a UNIX timestamp in seconds
         */
        created:number;
        query:string;
        query_type:string;
        query_id:string;
        subcorpname:string;
        lpos:string;
        qmcase:string;
        pcq_pos_neg:string;
        default_attr:string;

        /**
         * Text type values selected by user in query.
         * In case of configured bibliography structattr,
         * this is little bit more complicated as the values
         * (IDs) are not the ones displayed to user (Titles)
         * - see bib_mapping in this interface.
         */
        selected_text_types:TextTypes.ServerCheckedValues;

        /**
         * Mappings from unique bib_id (e.g. "the_great_gatsby_fsf_01")
         * to an actual title (here: "The Great Gatsby"). For corpora
         * where live-attributes does not have a bibliography structattr
         * configured, this is typically empty as all the values
         * checked/entered to text types are used directly because
         * we don't care whether they map to unique books/newspapers/whatever
         * (we just want matching values).
         */
        bib_mapping:TextTypes.BibMapping;

        aligned:Array<{
            query_type:string;
            query:string;
            corpname:string;
            canonical_corpus_id: string;
            human_corpname:string;
            lpos:string;
            qmcase:string;
            pcq_pos_neg:string;
            default_attr:string;
        }>;
    }

    /**
     * ICorpusSwitchAware represents an object which keeps
     * some of its properties persistent even when KonText
     * switches active corpus (which deletes most of the
     * client-side objects - typically all the stores and views).
     * I.e. the object stores some of the attributes and
     * its successor will use these values to set the
     * same properties.
     */
    export interface ICorpusSwitchAware<T> {

        /**
         * Export desired properties packed into
         * a single object T
         */
        csExportState():T;

        /**
         * Import desired properties from object T
         */
        csSetState(state:T):void;

        /**
         * Return a key under which the data will
         * be stored.
         */
        csGetStateKey():string;
    }

    export type AttrItem = {n:string; label:string};

    export type VirtualKeys = Array<Array<[string, string]>>;

    export interface VirtualKeyboardLayout {
        codes:Array<string>;
        label:string;
        name:string;
        keys:VirtualKeys;
    }
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

    export interface SaveViewAttrsOptionsResponse extends Kontext.AjaxResponse {
        widectx_globals:Array<[string, string]>;
    }

    export interface ICorpViewOptionsStore extends Kontext.PageStore {
        getCorpusIdent():Kontext.FullCorpusIdent;
        initFromPageData(data:ViewOptions.PageData):void;
        loadData():RSVP.Promise<ViewOptions.PageData>;
        isLoaded():boolean;
        addOnSave(fn:(data:SaveViewAttrsOptionsResponse)=>void):void;
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

    export interface IGeneralViewOptionsStore extends Kontext.PageStore {
        addOnSubmitResponse(fn:()=>void):void;
        getLineNumbers():boolean;
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

        extendedInfo?:Kontext.GeneralProps;
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

    export interface BibMapping {
        [bib_id:string]:string;
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
        exportSelections(lockedOnesOnly:boolean):Array<string>;

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
        setExtendedInfo(ident:string, data:Immutable.Map<string, any>):AttributeSelection;
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

        applyCheckedItems(checkedItems:TextTypes.ServerCheckedValues, bibMapping:TextTypes.BibMapping):void;

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
        exportSelections(lockedOnesOnly:boolean):TextTypes.ServerCheckedValues;

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
         * Returns true if a specific attribute (or at least one attribute
         * if attrName is undefined) contains at least one selected value.
         */
        hasSelectedItems(attrName?:string):boolean;

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
         * Return the total number of tokens in
         * texts matching all the attribute values
         * belonging to the provided attrName.
         *
         * Please note that individual sizes
         * (and thus the total size) may change
         * during the existence of the object
         * (e.g. by interactive text type selection).
         */
        getAttrSize(attrName:string):number;

        /**
         * Activate a support for attaching an extended information
         * for a specific attribute. The 'fn' callback is expected
         * to update store(s) in such a way that the information becomes
         * available.
         */
        setExtendedInfoSupport<T>(attrName:string, fn:(ident:string)=>RSVP.Promise<T>):void;

        /**
         * Returns true if a specific attribute has activated support
         * for displaying extended information.
         */
        hasDefinedExtendedInfo(attrName:string):boolean;

        /**
         * Attaches an extended information item to a specific attribute value.
         * This is typically used by setExtendedInfoSupport's callback function.
         */
        setExtendedInfo(attrName:string, ident:string, data:Immutable.Map<string, any>):void;


        setTextInputChangeCallback(fn:(attrName:string, inputValue:string)=>RSVP.Promise<any>):void;

        getTextInputPlaceholder():string;

        setTextInputPlaceholder(s:string):void;

        setRangeMode(attrName:string, rangeIsOn:boolean);

        getRangeModes():Immutable.Map<string, boolean>;

        /**
         * Other stores may listen for selection changes and update
         * themselves accordingly.
         */
        addSelectionChangeListener(fn:(target:TextTypes.ITextTypesStore)=>void):void;

        /**
         * Save the currect selection to object's local history.
         * This is mainly for UNDO function.
         */
        snapshotState():void;

        /**
         * Return selection state back to the previous
         * one stored via snapshotState().
         */
        undoState():void;

        canUndoState():boolean;

        isBusy():boolean;
    }

    /**
     * An additional information containing information
     * about an attribute.
     */
    export interface AttrSummary {
        text:string;
        help?:string;
    }


    export interface AlignedLanguageItem {
        value:string;
        label:string;
        selected:boolean;
        locked:boolean;
    }

    /**
     * Represents an object which is able to provide
     * a callback function initiated by textTypesStore
     * every time user enters a text into one of raw text inputs
     * (used whenever the number of items to display is too high).
     */
    export interface AttrValueTextInputListener {
        getAutoCompleteTrigger():(attrName:string, value:string)=>RSVP.Promise<any>;
        getTextInputPlaceholder():string; // a text displayed in a respective text field
        addUpdateListener(fn:()=>void):void;
        removeUpdateListener(fn:()=>void):void;
        getAlignedCorpora():Immutable.List<AlignedLanguageItem>;
        selectLanguages(languages:Immutable.List<string>, notifyListeners:boolean);
        hasSelectedLanguages():boolean;
        hasSelectionSteps():boolean;
        setControlsEnabled(v:boolean):void;
        reset():void;
        notifyChangeListeners():void;
    }

    export type ExportedSelection = {[attr:string]:Array<string>};

    /**
     *
     */
    export interface IAdHocSubcorpusDetector {
        usesAdHocSubcorpus():boolean;
        exportSelections(lockedOnesOnly:boolean):ExportedSelection;
    }
}

declare module Legacy {

    export interface IPopupBox {
        getContentElement():HTMLElement;
        close():void;
    }
}

declare module "misc/keyboardLayouts" {
    var kb:Array<Kontext.VirtualKeyboardLayout>;
    export = kb;
}