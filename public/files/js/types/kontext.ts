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
import { IModel, StatelessModel } from 'kombo';

import * as CoreViews from './coreViews';
import { MainMenuModel } from '../models/mainMenu';
import { CorpusViewOptionsModel } from '../models/options/structsAttrs';
import { AsyncTaskChecker } from '../models/asyncTask';
import { GeneralViewOptionsModelState } from '../models/options/general';
import { CorpusSwitchModel } from '../models/common/corpusSwitch';
import { SearchHistoryModel } from '../models/searchHistory';
import { ScreenProps } from '../views/document/responsiveWrapper';
import { Dict, List, pipe } from 'cnc-tskit';
import { CorpusInfoModel } from '../models/common/corpusInfo';


/**
 *
 */
export type GeneralProps = {[key:string]:any};

export type AnyInterface<T> = {[P in keyof T]: T[P]};

export type ListOfPairs = Array<[string, string]>;

export type SubcorpListItem = {v:string; n:string; foreign?:boolean};

export interface StructuralAttribute {
    name:string;
    structureName:string;
    label:string;
    n: string;
    dtFormat?:string;
}

export type StructsAndAttrs = {[struct:string]:Array<StructuralAttribute>};

export type AttrItem = {n:string; label:string};

export function structsAndAttrsToStructList(structsAndAttrs: StructsAndAttrs):Array<string> {
    return Dict.keys(structsAndAttrs);
}

export function structsAndAttrsToStructAttrList(structsAndAttrs: StructsAndAttrs):Array<AttrItem> {
    return pipe(
        structsAndAttrs,
        Dict.values(),
        List.flatMap(v => v),
        List.map(v => ({
            label: v.label,
            n: v.n,
        }))
    )
}

export type ResponseFormat = 'plain'|'json'|'template'|'xml';

export type QuerySupertype = 'conc'|'pquery'|'wlist'|'kwords';

export type PqueryExpressionRoles = 'specification'|'subset'|'superset';

/**
 * full = pquery entered as a single query (PCQL)
 * split = pquery entered as a list of CQL queries (along with additional parameters)
 */
export type PqueryType = 'full'|'split';

export type BasicFreqModuleType = 'text-types' | 'tokens';

export type FreqModuleType = BasicFreqModuleType | '2-attribute' | 'dispersion';


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

export const TEXT_INPUT_WRITE_THROTTLE_INTERVAL_MS = 400;

// ----------------

export type UserMessageTypes = 'info'|'warning'|'error'|'mail'|'plain';

export type ResponseMessage = [UserMessageTypes, string];


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
    subcName?:string;
    foreignSubcorp?:boolean;

    /**
     * Main corpus size (even for subcorpora)
     */
    size:number;

    /**
     * Actual searchable size - i.e. for a subcorpus
     * this is the actual size of the subcorpus.
     */
    searchSize:number;
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
    messageType:UserMessageTypes;
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
    createActionLink<T>(path:string, args?:T):string;

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

    getHelpLink(ident:string):string;

    getElmPosition(elm:HTMLElement):[number, number];

    getWindowResizeStream():Observable<ScreenProps>;

    getLocale():string;

    browserInfo:IBrowserInfo;
}

export interface AjaxResponse {
    messages:Array<[UserMessageTypes, string]>;
}

export interface LayoutModel {
    corpusInfoModel:CorpusInfoModel,
    userInfoModel:IModel<{}>,
    corpusViewOptionsModel:CorpusViewOptionsModel,
    generalViewOptionsModel:StatelessModel<GeneralViewOptionsModelState>;
    asyncTaskInfoModel:AsyncTaskChecker,
    mainMenuModel:MainMenuModel;
    corpusSwitchModel:CorpusSwitchModel;
    searchHistoryModel:SearchHistoryModel;
}

export interface AjaxOptions {
    contentType?:string;
    responseType?:XMLHttpRequestResponseType;
    accept?:string;
    timeout?:number;
}

export type AsyncTaskStatus = 'PENDING'|'STARTED'|'SUCCESS'|'FAILURE';

export interface AsyncTaskInfo<T=GeneralProps> {
    ident:string;
    label:string;
    category:string;
    status:AsyncTaskStatus;
    created:number;
    error:string; // = Worker's "result" property in case status == 'FAILURE'
    args:T;
    url:string;
}

export interface AsyncTaskOnUpdate {
    (taskInfoList:Array<AsyncTaskInfo>):void;
}


export interface IURLHandler {
    createStaticUrl(path:string):string;
    createActionUrl<T>(path:string, args?:T):string;
}

/**
 * Possible types for PageModel's ajax method request args
 */
export type AjaxArgs = {[key:string]:any}|string;

/**
 *
 */
export interface IAjaxHandler {
    ajax$<T>(
        method:string,
        url:string,
        args:AjaxArgs,
        options?:AjaxOptions
    ):Observable<T>;
}

export interface IHistory {
    pushState<T, U={}>(action:string, args:T, stateData?:U,
        title?:string):void;
    replaceState<T, U={}>(action:string, args:T, stateData?:U,
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
    opid:ManateeOpCode;

    /**
     * Human-readable description of the current
     * operation.
     */
    nicearg:string;

    /**
     * contains
     */
    arg:string;

    /**
     * Result size in tokens after this operation
     * was executed.
     */
    size:number;

    /**
     * In case an implicit sample size was used,
     * this represents the full (non sampled) concordance
     * size.
     */
     fullsize:number;

     /**
      * A persistent key of the operation
      * Note: this is currently attached on the clinet from the pipeline
      * op list.
      */
     conc_persistence_op_id:string|null;

     /**
      * Provides info whether this operation was
      * created by a registered author. This helps
      * e.g. to decide about operation chain archiving
      * normalization (first few ops by anonymous,
      * additional ones by registered => only partially
      * archived chain)
      */
     is_registered_author:boolean;
}

export type VirtualKeys = Array<Array<[string, string]>>;

export interface VirtualKeyboardLayout {
    codes:Array<string>;
    label:string;
    name:string;
    keys:VirtualKeys;
    deadKeys?:Array<string>;
}

/**
ManateeOpCode defines query operation codes used by the Manatee engine:

- q: Query
- a: Query
- r: Random sample
- s: Sort
- f: Shuffle
- D: Remove nested matches
- F: First hits in documents
- n: Negative filter
- N: Negative filter (excluding KWIC)
- p: Positive filter
- P: Positive filter (excluding KWIC)
- x: Switch KWIC
*/
export type ManateeOpCode = 'q'|'a'|'n'|'N'|'p'|'P'|'s'|'r'|'f'|'x'|'D'|'F';

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

// structured as `{file format}-{subformat}`
export type ChartExportFormat = 'png' | 'svg' | 'png-print' | 'pdf';


export interface PreflightConf {
    corpname:string;
    subc:string;
    threshold_ipm:number;
    alt_corp:string;
}