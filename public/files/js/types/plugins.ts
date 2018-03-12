/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

import * as Immutable from 'immutable';
import RSVP from 'rsvp';
import {Kontext, TextTypes} from '../types/common';
import {ActionDispatcher} from '../app/dispatcher';
import {CoreViews} from './coreViews';
import { EventEmitter } from 'events';


/**
 * An interface used by KonText plug-ins to access
 * core functionality (for core components, this is
 * typically provided by PageModel).
 */
export interface IPluginApi {
    getConf<T>(key:string):T;
    createStaticUrl(path:string):string;
    createActionUrl(path:string, args?:Array<[string,string]>|Kontext.IMultiDict):string;
    ajax<T>(method:string, url:string, args:any, options?:Kontext.AjaxOptions):RSVP.Promise<T>;
    showMessage(type:string, message:any, onClose?:()=>void);
    translate(text:string, values?:any):string;
    formatNumber(v:number):string;
    formatDate(d:Date, timeFormat?:number):string;
    userIsAnonymous():boolean;
    dispatcher():ActionDispatcher;
    getComponentHelpers():Kontext.ComponentHelpers;
    renderReactComponent<T, U>(reactClass:React.ComponentClass<T>|React.SFC<T>,
                            target:HTMLElement, props?:T):void;
    unmountReactComponent(element:HTMLElement):boolean;
    getModels():Kontext.LayoutModel;
    getViews():CoreViews.Runtime;
    pluginIsActive(name:string):boolean;
    getConcArgs():Kontext.IMultiDict;
    registerSwitchCorpAwareObject(obj:Kontext.ICorpusSwitchAware<any>):void;
    resetMenuActiveItemAndNotify():void;
    getHelpLink(ident:string):string;
    setLocationPost(path:string, args:Array<[string,string]>, blankWindow?:boolean);
}


/**
 * PluginInterfaces contains individual interfaces KonText expect
 * from plug-ins to be implemented.
 */
export namespace PluginInterfaces {

    export interface IAuth {
        getUserPaneView():React.ComponentClass;
        getProfileView():React.ComponentClass;
    }

    export interface IToolbar {
    }

    export interface IFooterBar {
    }

    // --------------------------- subcmixer -------------------------------

    export interface ISubcMixer {
        refreshData():void;
        getWidgetView():React.ComponentClass;
    }

    export type SubcMixerView = React.ComponentClass<{isActive:boolean}>;

    // ---------------------------------- syntax viewer ---------------------

    export interface ISyntaxViewer extends Kontext.EventEmitter {
        render(target:HTMLElement, tokenNumber:number, kwicLength:number):void;
        close():void;
        onPageResize():void;
        isWaiting():boolean;
    }

    // --------  tag helper ----------

    export interface TagHelperViewProps {
        sourceId:string;
        actionPrefix:string;
        range:[number, number];
        onInsert:()=>void;
        onEscKey:()=>void;
    }

    export type TagHelperView = React.ComponentClass<TagHelperViewProps>;

    export interface ITagHelper {
        getWidgetView():TagHelperView;
    }

    // --------- query storage ------

    export interface IQueryStorageModel extends Kontext.EventEmitter {

        getCurrentCorpusOnly():boolean;
        getData():Immutable.List<Kontext.QueryHistoryItem>;
        getQueryType():string;
        getOffset():number;
        getIsBusy():boolean;
        getHasMoreItems():boolean;
        getArchivedOnly():boolean;
        getEditingQueryId():string;
        getEditingQueryName():string;
    }

    export interface QueryStorageWidgetProps {
        sourceId:string;
        actionPrefix:string;
        onCloseTrigger:()=>void;
    }

    export type QueryStorageWidgetView = React.ComponentClass<QueryStorageWidgetProps>;

    export interface IQueryStorage {

        /**
         * Import data to the model. This is meant to be used right
         * after plug-in initialization and it should never
         * notify listeners.
         */
        importData(data:Array<Kontext.QueryHistoryItem>):void;

        getWidgetView():QueryStorageWidgetView;

        getModel():IQueryStorageModel;
    }

    // ------------------------ corparch -------------------------


    export type CorparchWidgetView = React.ComponentClass<{}>;


    export interface ICorparchCorpSelection {
        getCurrentSubcorpus():string;
        getAvailableSubcorpora():Immutable.List<{n:string; v:string}>;
        getAvailableAlignedCorpora():Immutable.List<Kontext.AttrItem>;
        getCorpora():Immutable.List<string>;
    }

    // -------------------------- live attributes --------------------------

    export interface ILiveAttributes extends TextTypes.AttrValueTextInputListener {
        getAutoCompleteTrigger():(attrName:string, value:string)=>RSVP.Promise<any>;
        setControlsEnabled(v:boolean):void;
        selectLanguages(languages:Immutable.List<string>, notifyListeners:boolean):void;
        hasSelectionSteps():boolean;
        reset():void;
        hasSelectedLanguages():boolean;
        removeUpdateListener(fn:()=>void):void;
        addUpdateListener(fn:()=>void):void;
        getTextInputPlaceholder():string;
        getViews(subcMixerView:React.ComponentClass, textTypesModel:TextTypes.ITextTypesModel):any; // TODO types
        getAlignedCorpora():Immutable.List<TextTypes.AlignedLanguageItem>;
        notifyChangeListeners():void;
    }

    /**
     *
     */
    export interface ILiveAttrsInitArgs {

        /**
         * A structural attribute used to uniquely identify a bibliographic
         * item (i.e. a book). Typically something like "doc.id".
         */
        bibAttr:string;

        /**
         * A list of aligned corpora available to be attached to
         * the current corpus.
         */
        availableAlignedCorpora:Array<Kontext.AttrItem>;

        /**
         * Enable "refine" button when component is initialized?
         * (e.g. for restoring some previous state where user
         * already selected some values).
         */
        refineEnabled:boolean;

        /**
         * If manual mode is disabled then the list of
         * aligned corpora is synced automatically from
         * the query form (i.e. if user selects/drops an aligned
         * corpus then the model's internal list is updated
         * accordingly)
         */
        manualAlignCorporaMode:boolean;
    }

    export type LiveAttributesView = React.ComponentClass<{}>;

    export type LiveAttributesCustomAttribute = React.ComponentClass<{}>;


    // ------------------------------------------------

    /**
     * A factory class for generating corplist page. The page is expected
     * to contain two blocks
     *  - a form (typically a filter)
     *  - a dataset (= list of matching corpora)
     *
     */
    export interface ICorplistPage {

        setData(data:any):void; // TODO type

        getForm():React.ComponentClass|React.SFC<{}>;

        getList():React.ComponentClass|React.SFC<{}>;
    }


    export interface IssueReporting {

        getWidgetView():React.ComponentClass|React.SFC<{}>;

    }


    export namespace KwicConnect {

        export type WidgetWiew = React.ComponentClass<{}>|React.SFC<{}>;

        export interface IPlugin {
            getView():WidgetWiew;
        }

        export enum Actions {
            FETCH_INFO = 'KWIC_CONNECT_FETCH_INFO'
        }
    }


    export namespace TokenDetail {


        export interface Response {
            items:Array<{
                renderer:string;
                contents:Array<[string, string]>;
                found:boolean;
                heading:string;
            }>;
        }

        export interface RendererData {
            data: Array<[string, string]>;
        }

        export type Renderer = React.ComponentClass<Kontext.GeneralProps>|React.SFC<Kontext.GeneralProps>;

        export interface DataAndRenderer {
            renderer:Renderer;
            contents:Kontext.GeneralProps;
            found:boolean;
            heading:string;
        }

        export interface IPlugin {

            fetchTokenDetail(corpusId:string, tokenId:number):RSVP.Promise<Array<DataAndRenderer>>;

            selectRenderer(typeId:string):Renderer;
        }
    }
}
