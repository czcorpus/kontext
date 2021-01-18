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

import { Observable } from 'rxjs';
import { IEventEmitter, IModel, StatelessModel } from 'kombo';

import { CoreViews } from './coreViews';
import { MainMenuModel } from '../models/mainMenu';
import { CorpusViewOptionsModel } from '../models/options/structsAttrs';
import { AsyncTaskChecker } from '../models/asyncTask';
import { GeneralViewOptionsModelState } from '../models/options/general';
import { CorpusSwitchModel } from '../models/common/corpusSwitch';
import { WidgetView } from '../models/textTypes/common';
import { QueryType } from '../models/query/query';

/**
 *
 */
export namespace Kontext {

    /**
     *
     */
    export type GeneralProps = {[key:string]:any};

    export type AnyInterface<T> = {[P in keyof T]: T[P]};

    export type ListOfPairs = Array<[string, string]>;

    export type SubcorpListItem = {v:string; n:string; pub:string, foreign?:boolean};

    export type StructsAndAttrs = {[struct:string]:Array<string>};

    export type ResponseFormat = 'plain'|'json'|'template'|'xml';


    export interface FormValue<T> {

        value:T;

        isRequired:boolean;

        isInvalid:boolean;

        errorDesc?:string;

    }

    export const isFormValue = <T>(v:any):v is FormValue<T> => {
        return v !== null && v !== undefined && v.hasOwnProperty('value') &&
                v.hasOwnProperty('isRequired') && v.hasOwnProperty('isInvalid');
    }

    /**
     * Create a copy of the provided formValue and update it
     * with the provided data. If an empty object is provided as
     * an update then an exact copy is created.
     *
     * @param formValue
     * @param data
     */
    export const updateFormValue = <T>(formValue:FormValue<T>,
            data:{[P in keyof FormValue<T>]?: FormValue<T>[P]}) => {
        return {
            value: data.value !== undefined ? data.value : formValue.value,
            isInvalid: data.isInvalid !== undefined ? data.isInvalid : formValue.isInvalid,
            isRequired: data.isRequired !== undefined ? data.isRequired : formValue.isRequired,
            errorDesc: data.errorDesc !== undefined ? data.errorDesc : formValue.errorDesc
        };
    }

    export const newFormValue = <T>(v:T, isRequired:boolean):FormValue<T> => ({
        value: v,
        isInvalid: false,
        isRequired,
        errorDesc: undefined
    });

    export const resetFormValue = <T>(formValue:FormValue<T>, val:T) => ({
        value: val,
        isInvalid: false,
        isRequired:
        formValue.isRequired,
        errorDesc: undefined
    });

    // ----------------

    export type UserMessageTypes = 'info'|'warning'|'error'|'mail'|'plain';

    //

    /**
     * Represents possible sources for MultiDict
     * (either a list of 2-tuples or a dict).
     */
    export type MultiDictSrc = Array<[string,any]>|GeneralProps;

    export interface UserCredentials {
        id:number;
        firstname:string;
        lastname:string;
        affiliation:string;
        email:string;
        username:string;
        active:boolean;
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
        getNestedConf<T>(...keys:Array<string>):T;
        setConf<T>(key:string, value:T):void;
    }

    export interface FullCorpusIdent {
        id:string;
        variant:string;
        name:string;
        usesubcorp?:string;
        origSubcorpName?:string;
        foreignSubcorp?:boolean;
    }

    export interface ICorpusInfoModel extends IEventEmitter {
        getCurrentInfoData():any; // TODO
        isLoading():boolean;
    }


    // ---------------------- main menu ---------------------------------

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

    export interface SubmenuItem {
        ident:string;
        label:string;
        hint:string|null;
        disabled:boolean;
        currConc?:boolean;
    }

    export interface EventTriggeringSubmenuItem extends SubmenuItem {
        message:string; // a dispatcher action type
        args:GeneralProps;
        keyCode:number;
        keyMod:string;
        indirect:boolean;
    }

    export interface MenuItem {
        disabled:boolean;
        fallbackAction:string;
        label:string;
        items:Array<SubmenuItem>;
    }

    export type MenuEntry = [string, MenuItem];

    /**
     *
     */
    export interface IMainMenuShortcutMapper {
        get(keyCode:number, keyMod:string):EventTriggeringSubmenuItem;
        register(keyCode:number, keyMod:string, message:string, args:GeneralProps):void;
    }

    // ---------------------------------------------------------

    export interface UserNotification {
        messageId:string;
        messageType:Kontext.UserMessageTypes;
        messageText:string;
        ttl:number;
        timeFadeout:number;
    }

    /**
     * A function listening for change in a stateful model. This is
     * used by React components to handle stateful model updates.
     */
    export interface ModelListener {
        (err?:Error):void;
    }

    export interface IBrowserInfo {
        isFirefox():boolean;
    }

    export type Mutable<T extends {[k:string]:any}> = {
        [P in keyof T]:T[P];
    }

    export interface Translator {

        /**
         * Translate a message key (and possible passed placeholder
         * replacement values) based on KonText translation mapping
         * JSON file.
         */
        translate(s:string, values?:any):string;
    }

    /**
     * Convenient functions used by KonText's React components
     */
    export interface ComponentHelpers extends Translator {

        /**
         * Create a proper action URL based on normalized format
         * (e.g. 'query' translates to
         * http://localhost/kontext/query depending
         * on a concrete configuration).
         */
        createActionLink(path:string, args?:MultiDictSrc):string;

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
         * @deprecated
         */
        cloneState<T>(obj:Readonly<T>|T):Mutable<T>;

        getHelpLink(ident:string):string;

        getElmPosition(elm:HTMLElement):[number, number];

        browserInfo:IBrowserInfo;
    }

    export interface AjaxResponse {
        messages:Array<[UserMessageTypes, string]>;
    }

    export interface LayoutModel {
        corpusInfoModel:ICorpusInfoModel,
        userInfoModel:IModel<{}>,
        corpusViewOptionsModel:CorpusViewOptionsModel,
        generalViewOptionsModel:StatelessModel<GeneralViewOptionsModelState>;
        asyncTaskInfoModel:AsyncTaskChecker,
        mainMenuModel:MainMenuModel;
        corpusSwitchModel:CorpusSwitchModel;
    }

    export interface AjaxOptions {
        contentType?:string;
        responseType?:string;
        accept?:string;
    }

    export interface AsyncTaskInfo {
        ident:string;
        label:string;
        category:string;
        status:'PENDING'|'STARTED'|'RETRY'|'FAILURE'|'SUCCESS';
        created:number;
        error:string; // = Celery's "result" property in case status == 'FAILURE'
        args:GeneralProps;
    }

    export interface AsyncTaskOnUpdate {
        (taskInfoList:Array<AsyncTaskInfo>):void;
    }

    /**
     * A dictionary allowing multiple values per-key.
     * It is mostly used to carry URL arguments.
     */
    export interface IMultiDict<T={[k:string]:string|number|boolean}> {
        head<K extends keyof T>(key:K):string;
        getList<K extends keyof T>(key:K):Array<string>;
        set<K extends keyof T>(key:K, value:T[K]):Kontext.IMultiDict<T>;
        replace<K extends keyof T>(key:K, values:Array<T[K]>):Kontext.IMultiDict<T>;
        remove<K extends keyof T>(key:K):Kontext.IMultiDict<T>;
        add<K extends keyof T>(key:K, value:T[K]):Kontext.IMultiDict<T>;
        items():Array<[string, string]>;
        toDict():{[key:string]:string};
        has<K extends keyof T>(key:K):boolean;
        size():number;
    }

    export interface IURLHandler {
        createStaticUrl(path:string):string;
        createActionUrl<T>(path:string, args?:Array<[keyof T, T[keyof T]]>|Kontext.IMultiDict<T>):string;
        encodeURLParameters<T>(params:IMultiDict<T>):string
    }

    /**
     * Possible types for PageModel's ajax method request args
     */
    export type AjaxArgs = IMultiDict|{[key:string]:any}|string;

    /**
     *
     */
    export interface IAjaxHandler {
        ajax$<T>(
            method:string,
            url:string,
            args:AjaxArgs,
            options?:Kontext.AjaxOptions
        ):Observable<T>;
    }

    export interface IHistory {
        pushState<T>(action:string, args:Kontext.IMultiDict<T>, stateData?:any,
            title?:string):void;
        replaceState<T>(action:string, args:Kontext.IMultiDict<T>, stateData?:any,
            title?:string):void;
        setOnPopState(fn:(event:PopStateEvent)=>void):void;
    }

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
         * QueryReplayModel.
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
        corpus_id:string;
        human_corpname:string;
        /**
         * a UNIX timestamp in seconds
         */
        created:number;
        query:string;

        /**
         * Query with syntax highlighting (using embedded HTML)
         */
        query_sh?:string;
        query_type:QueryType;
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
        selected_text_types:TextTypes.ExportedSelection;

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
            query_type:QueryType;
            query:string;
            corpname:string;
            human_corpname:string;
            lpos:string;
            qmcase:string;
            pcq_pos_neg:string;
            default_attr:string;
        }>;
    }

    export type AttrItem = {n:string; label:string};

    export type VirtualKeys = Array<Array<[string, string]>>;

    export interface VirtualKeyboardLayout {
        codes:Array<string>;
        label:string;
        name:string;
        keys:VirtualKeys;
        deadKeys?:Array<string>;
    }

    export enum ConcFormTypes {
        QUERY = 'query',
        FILTER = 'filter',
        SORT = 'sort',
        SAMPLE = 'sample',
        SHUFFLE = 'shuffle',
        SWITCHMC = 'switchmc',
        SUBHITS = 'subhits',

        /**
         * Form for finding all the first occurrences in
         * all documents.
         */
        FIRSTHITS = 'firsthits',

        /**
         * locked form type represents any query form with locked
         * editation and with compiled query output only. It also
         * means we cannot see its actual arguments even for reading.
         */
        LOCKED = 'locked',
        LGROUP = 'lgroup'
    }
}


export namespace ViewOptions {

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
        selectAllAttrs: boolean;
    }

    export interface StructAttrDesc {
        n: string;
        selected: boolean;
    }

    export interface RefDesc {
        label: string;
        n: string;
        selected: boolean;
        locked: boolean;
        selectAllAttrs: boolean;
    }

    export interface RefAttrDesc {
        n: string;
        label: string;
        selected: boolean;
    }

    /**
     * Modes of how positional attributes are shown
     */
    export enum AttrViewMode {
        VISIBLE_ALL = 'visible-all',
        VISIBLE_KWIC = 'visible-kwic',
        VISIBLE_MULTILINE = 'visible-multiline',
        MOUSEOVER = 'mouseover'
    }

    export type AvailStructAttrs = {[key:string]:Array<StructAttrDesc>};

    export interface PageData {
        AttrList:Array<AttrDesc>;
        FixedAttr:string;
        AttrVmode:ViewOptions.AttrViewMode;
        CurrentAttrs:Array<string>;
        AvailStructs:Array<{sel:string; label:string; n:string}>;
        StructAttrs:{[attr:string]:Array<string>};
        CurrStructAttrs:Array<string>;
        AvailRefs:Array<{n:string; sel:string; label:string}>;
        ShowConcToolbar:boolean;
        BaseViewAttr:string;
        QueryHintEnabled:boolean;
    }

    export interface LoadOptionsResponse extends Kontext.AjaxResponse {
        AttrList: Array<AttrDesc>;
        Availstructs: Array<{sel:string; label:string; n:string}>;
        Availrefs:Array<{n:string; sel:string; label:string}>;
        curr_structattrs:Array<string>;
        fixed_attr:string;
        attr_vmode:AttrViewMode;
        base_viewattr:string;
        use_conc_toolbar:boolean;
        structattrs:{[attr:string]:Array<string>};
        CurrentAttrs:Array<string>;
        qs_enabled:boolean;
    }

    export interface SaveViewAttrsOptionsResponse extends Kontext.AjaxResponse {
        widectx_globals:Array<[string, string]>;
        conc_persistence_op_id:string|null;
        conc_args:Array<[string, string]>;
    }

}


/**
 * This module contains types used along with text type
 * selection component (e.g. when creating a subcorpus).
 */
export namespace TextTypes {

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

        extendedInfo?:TextTypes.ExtendedInfo;
    }

    export interface AutoCompleteItem {
        ident: string;
        label: string;
    }

    export interface BibMapping {
        [bibId:string]:string;
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

    export type TTSelectionTypes = 'full'|'text'|'regexp';

    export function isEncodedSelectionType(sel:TTSelectionTypes):boolean {
        return sel === 'regexp';
    }

    export interface FullAttributeSelection {
        attrInfo:TextTypes.AttrInfo;
        isInterval:boolean;
        widget:WidgetView;
        isNumeric:boolean;
        label:string;
        name:string;
        values:Array<AttributeValue>;
        type:'full';
    }

    export interface TextInputAttributeSelection {
        attrInfo:AttrInfo;
        isInterval:boolean;
        widget:WidgetView;
        isNumeric:boolean;
        label:string;
        name:string;
        autoCompleteHints:Array<AutoCompleteItem>;
        values:Array<AttributeValue>; // it supports appending values via a single text input
        textFieldValue:string;
        type:'text';
    }

    export interface RegexpAttributeSelection {
        attrInfo:AttrInfo;
        widget:WidgetView;
        label:string;
        name:string;
        textFieldValue:string;
        textFieldDecoded:string;
        isLocked:boolean;
        type:'regexp';
    }

    export type AnyTTSelection = TextInputAttributeSelection|FullAttributeSelection|
            RegexpAttributeSelection;

    export type ExportedSelection = {[sca:string]:Array<string>|string};

    /**
     *
     */
    export interface IAdHocSubcorpusDetector {
        usesAdHocSubcorpus():boolean;
        UNSAFE_exportSelections(lockedOnesOnly:boolean):ExportedSelection;
    }

    export interface ITextTypesModel<T> extends IModel<T> {
        UNSAFE_exportSelections(lockedOnesOnly:boolean):ExportedSelection;
        getInitialAvailableValues():Array<AnyTTSelection>;
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

    export type ExtendedInfo = Array<[string, string]>|{__message__:string};

}


export const typedProps = <T>(props) => <T>props;