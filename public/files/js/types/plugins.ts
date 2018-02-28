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

import {Kontext, TextTypes} from '../types/common';
import * as Immutable from 'immutable';
import {ActionDispatcher} from '../app/dispatcher';



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
    dispatcher():any; // TODO
    getComponentHelpers():Kontext.ComponentHelpers;
    renderReactComponent<T, U>(reactClass:React.ComponentClass<T, U>|React.FuncComponent<T>,
                            target:HTMLElement, props?:T):void;
    unmountReactComponent(element:HTMLElement):boolean;
    getStores():Kontext.LayoutStores;
    getViews():CoreViews.Runtime;
    pluginIsActive(name:string):boolean;
    getConcArgs():Kontext.IMultiDict;
    registerSwitchCorpAwareObject(obj:Kontext.ICorpusSwitchAware<any>):void;
    resetMenuActiveItemAndNotify():void;
    getHelpLink(ident:string):string;
    setLocationPost(path:string, args:Array<[string,string]>, blankWindow?:boolean);
}

/**
 * General specification of a plug-in object.
 */
export interface PluginFactory<T> {
    (api:IPluginApi):RSVP.Promise<T>;
}

/**
 *
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

    export interface ISubcMixer {
        refreshData():void;
        getWidgetView():React.ComponentClass;
    }

    export interface ISyntaxViewer extends Kontext.PageStore {
        render(target:HTMLElement, tokenNumber:number, kwicLength:number):void;
        close():void;
        onPageResize():void;
        isWaiting():boolean;
    }

    export interface ITagHelper {
        getWidgetView():React.ComponentClass;
    }

    export interface IQueryStorageStore extends Kontext.PageStore {

        /**
         *
         */
        getData():Immutable.List<Kontext.QueryHistoryItem>;
    }

    export interface IQueryStorage {

        /**
         * Import data to store. This is meant to be used right
         * after plug-in initialization and it should never
         * notify listeners.
         */
        importData(data:Array<Kontext.QueryHistoryItem>):void;

        getWidgetView():React.ComponentClass;

        getStore():IQueryStorageStore;
    }

    export interface ICorparchStore {
        getCurrentSubcorpus():string;
        getAvailableSubcorpora():Immutable.List<string>;
        addChangeListener(fn:Kontext.StoreListener):void;
        removeChangeListener(fn:Kontext.StoreListener):void;
    }

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
        getViews(subcMixerView:React.ComponentClass, textTypesStore:TextTypes.ITextTypesStore):any; // TODO types
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
         * corpus then the store's internal list is updated
         * accordingly)
         */
        manualAlignCorporaMode:boolean;
    }

    /**
     * A factory class for generating corplist page. The page is expected
     * to contain two blocks
     *  - a form (typically a filter)
     *  - a dataset (= list of matching corpora)
     *
     */
    export interface ICorplistPage {

        setData(data:any):void; // TODO type

        getForm():React.ComponentClass;

        getList():React.ComponentClass;
    }


    export interface IIssueReporting {

        getWidgetView():React.ComponentClass;

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

        export interface DataAndRenderer {
            renderer:React.ComponentClass;
            contents:Array<[string, string]>;
            found:boolean;
            heading:string;
        }


        export interface IPlugin {

            fetchTokenDetail(corpusId:string, tokenId:number):RSVP.Promise<Array<DataAndRenderer>>;

            selectRenderer(typeId:string):React.ComponentClass;
        }
    }
}
