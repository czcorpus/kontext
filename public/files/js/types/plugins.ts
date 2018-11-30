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
import * as Rx from '@reactivex/rxjs';
import RSVP from 'rsvp';
import {Kontext, TextTypes} from '../types/common';
import {ActionDispatcher} from '../app/dispatcher';
import {CoreViews} from './coreViews';
import {IConcLinesProvider} from '../types/concordance';

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
    ajax$<T>(method:string, url:string, args:any, options?:Kontext.AjaxOptions):Rx.Observable<T>;
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
    getCorpusIdent():Kontext.FullCorpusIdent;
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

    // ------------------------------------------------------------------------
    // --------------------------- [auth] plug-in -----------------------------

    export namespace Auth {

        export interface IPlugin {
            getUserPaneView():React.ComponentClass;
            getProfileView():React.ComponentClass;
        }

        export interface Factory {
            (pluginApi:IPluginApi):IPlugin;
        }
    }

    // ------------------------------------------------------------------------
    // --------------------------- [application_bar] plug-in ------------------

    export namespace ApplicationBar {

        export interface IPlugin {
        }

        export interface Factory {
            (pluginApi:IPluginApi):IPlugin;
        }
    }

    // ------------------------------------------------------------------------
    // --------------------------- [footer_bar] plug-in -----------------------

    export namespace FooterBar {

        export interface IPlugin {
        }

        export interface Factory {
            (pluginApi:IPluginApi):IPlugin;
        }

    }

    // ------------------------------------------------------------------------
    // --------------------------- [subcmixer] plug-in ------------------------

    export namespace SubcMixer {

        export interface IPlugin {
            refreshData():void;
            getWidgetView():React.ComponentClass;
        }

        export type View = React.ComponentClass<{isActive:boolean}>;

        export interface ISubcorpFormModel {
            getIsPublic():boolean;
            getDescription():Kontext.FormValue<string>;
            getSubcName():Kontext.FormValue<string>;
            addChangeListener(fn:Kontext.ModelListener):void;
            removeChangeListener(fn:Kontext.ModelListener):void;
            validateForm():Error|null;
        }

        export interface Factory {
            (
                pluginApi:IPluginApi,
                textTypesModel:TextTypes.ITextTypesModel,
                subcorpFormModel:PluginInterfaces.SubcMixer.ISubcorpFormModel,
                getAlignedCorporaFn:()=>Immutable.List<TextTypes.AlignedLanguageItem>,
                corpusIdAttr:string
            ):IPlugin;
        }
    }


    // ------------------------------------------------------------------------
    // ------------------------------ [syntax_viewer] plug-in -----------------

    export namespace SyntaxViewer {

        export interface IPlugin extends Kontext.EventEmitter {
            render(target:HTMLElement, tokenNumber:number, kwicLength:number):void;
            close():void;
            onPageResize():void;
            registerOnError(fn:(e:Error)=>void):void;
            isWaiting():boolean;
        }

        export interface Factory {
            (pluginApi:IPluginApi):IPlugin;
        }
    }


    // ------------------------------------------------------------------------
    // ------------------------ [taghelper] plug-in ---------------------------

    export namespace TagHelper {

        export interface ViewProps {
            sourceId:string;
            actionPrefix:string;
            range:[number, number];
            onInsert:()=>void;
            onEscKey:()=>void;
        }

        export type View = React.ComponentClass<ViewProps>;

        export interface IPlugin {
            getWidgetView():TagHelper.View;
        }

        export interface Factory {
            (pluginApi:IPluginApi):IPlugin;
        }
    }

    // ------------------------------------------------------------------------
    // ------------------------ [query_storage] plug-in -----------------------

    export namespace QueryStorage {

        export interface IModel extends Kontext.EventEmitter {

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

        export interface WidgetProps {
            sourceId:string;
            actionPrefix:string;
            onCloseTrigger:()=>void;
        }

        export type WidgetView = React.ComponentClass<WidgetProps>;

        export interface IPlugin {

            /**
             * Import data to the model. This is meant to be used right
             * after plug-in initialization and it should never
             * notify listeners.
             */
            importData(data:Array<Kontext.QueryHistoryItem>):void;

            getWidgetView():WidgetView;

            getModel():IModel;
        }

        export interface Factory {
            (pluginApi:IPluginApi, offset:number, limit:number, pageSize:number):IPlugin;
        }
    }


    // ------------------------------------------------------------------------
    // ------------------------ [corparch] plug-in ----------------------------

    export namespace Corparch {

        export type WidgetView = React.ComponentClass<{}>;


        export interface ICorpSelection extends Kontext.EventEmitter {
            getCurrentSubcorpus():string;
            getCurrentSubcorpusOrigName():string;
            getIsForeignSubcorpus():boolean;
            getAvailableSubcorpora():Immutable.List<Kontext.SubcorpListItem>;
            getAvailableAlignedCorpora():Immutable.List<Kontext.AttrItem>;
            getCorpora():Immutable.List<string>;
        }

        /**
         * A factory class for generating corplist page. The page is expected
         * to contain two blocks
         *  - a form (typically a filter)
         *  - a dataset (= list of matching corpora)
         *
         */
        export interface ICorplistPage {

            getForm():React.ComponentClass|React.SFC<{}>;

            getList():React.ComponentClass|React.SFC<{}>;
        }

        export interface IPlugin {
            createWidget(targetAction:string, corpSel:ICorpSelection,
                    options:Kontext.GeneralProps):React.ComponentClass<{}>;
            initCorplistPageComponents(initialData:any):ICorplistPage;
        }

        export interface Factory {
            (pluginApi:IPluginApi):IPlugin;
        }
    }

    // ------------------------------------------------------------------------
    // -------------------------- [live_attributes] plug-in -------------------

    export namespace LiveAttributes {

        export interface IPlugin extends TextTypes.AttrValueTextInputListener {
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
        export interface InitArgs {

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

        export type View = React.ComponentClass<{}>;

        export type CustomAttribute = React.ComponentClass<{}>;

        export interface Factory {
            (
                pluginApi:IPluginApi,
                textTypesModel:TextTypes.ITextTypesModel,
                selectedCorporaProvider:()=>Immutable.List<string>,
                ttCheckStatusProvider:()=>boolean,
                args:PluginInterfaces.LiveAttributes.InitArgs
            ):IPlugin;
        }
    }


    // ------------------------------------------------------------------------
    // ------------------------- [issue_reporting] plug-in --------------------

    export namespace IssueReporting {

        export interface IPlugin {

            getWidgetView():React.ComponentClass|React.SFC<{}>;
        }

        export interface Factory {
            (pluginApi:IPluginApi):IPlugin;
        }
    }


    // ------------------------------------------------------------------------
    // ------------------------- [kwic_connect] plug-in -----------------------

    export namespace KwicConnect {

        export type WidgetWiew = React.ComponentClass<{}>|React.SFC<{}>;

        export interface IPlugin {
            getView():WidgetWiew;
        }

        export enum Actions {
            FETCH_INFO = 'KWIC_CONNECT_FETCH_INFO'
        }

        export type Factory = (pluginApi:IPluginApi, concLinesProvider:IConcLinesProvider,
                               alignedCorpora:Array<string>)=>IPlugin;
    }


    // ------------------------------------------------------------------------
    // ------------------------- [token_connect] plug-in ----------------------

    export namespace TokenConnect {


        export interface Response {
            token:string;
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

        export interface TCData {
            token:string;
            renders:Immutable.List<DataAndRenderer>;
        }

        export interface IPlugin {

            fetchTokenConnect(corpusId:string, tokenId:number, numTokens:number):RSVP.Promise<TCData>;

            selectRenderer(typeId:string):Renderer;
        }

        export interface Factory {
            (pluginApi:IPluginApi, alignedCorpora:Array<string>):IPlugin;
        }
    }

}
