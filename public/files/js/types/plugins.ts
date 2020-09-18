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

import { Observable } from 'rxjs';
import { IEventEmitter, ITranslator, IFullActionControl, IModel, Action } from 'kombo';

import { Kontext, TextTypes } from '../types/common';
import { CoreViews } from './coreViews';
import { IConcLinesProvider } from '../types/concordance';
import { ConcServerArgs } from '../models/concordance/common';
import { QueryFormType } from '../models/query/actions';
import { IUnregistrable } from '../models/common/common';
import { QueryType } from '../models/query/common';

/**
 * An interface used by KonText plug-ins to access
 * core functionality (for core components, this is
 * typically provided by PageModel).
 */
export interface IPluginApi extends ITranslator {
    getConf<T>(key:string):T;
    getNestedConf<T>(...keys:Array<string>):T;
    createStaticUrl(path:string):string;
    createActionUrl<T>(
        path:string, args?:Array<[keyof T, T[keyof T]]>|Kontext.IMultiDict<T>):string;
    ajax$<T>(method:string, url:string, args:any, options?:Kontext.AjaxOptions):Observable<T>;
    showMessage(type:string, message:any, onClose?:()=>void);
    userIsAnonymous():boolean;
    dispatcher():IFullActionControl;
    getComponentHelpers():Kontext.ComponentHelpers;
    renderReactComponent<T, U>(reactClass:React.ComponentClass<T>|React.SFC<T>,
                            target:HTMLElement, props?:T):void;
    unmountReactComponent(element:HTMLElement):boolean;
    getModels():Kontext.LayoutModel;
    getViews():CoreViews.Runtime;
    pluginTypeIsActive(name:string):boolean;
    getConcArgs():ConcServerArgs;
    exportConcArgs():Kontext.IMultiDict<ConcServerArgs>;
    getCorpusIdent():Kontext.FullCorpusIdent;
    resetMenuActiveItemAndNotify():void;
    getHelpLink(ident:string):string;
    setLocationPost(path:string, args:Array<[string,string]>, blankWindow?:boolean):void;
}


export interface BasePlugin {
    isActive():boolean;
}


/**
 * PluginInterfaces contains individual interfaces KonText expect
 * from plug-ins to be implemented.
 */
export namespace PluginInterfaces {

    // ------------------------------------------------------------------------
    // --------------------------- [auth] plug-in -----------------------------

    export namespace Auth {

        export interface IPlugin extends BasePlugin {
            getUserPaneView():React.ComponentClass;
            getProfileView():React.ComponentClass;
            getSignUpView():React.ComponentClass|null;
        }

        export interface Factory {
            (pluginApi:IPluginApi):IPlugin;
        }
    }

    // ------------------------------------------------------------------------
    // --------------------------- [application_bar] plug-in ------------------

    export namespace ApplicationBar {

        export interface IPlugin extends IUnregistrable, BasePlugin {
        }

        export interface Factory {
            (pluginApi:IPluginApi):IPlugin;
        }
    }

    // ------------------------------------------------------------------------
    // --------------------------- [footer_bar] plug-in -----------------------

    export namespace FooterBar {

        export interface IPlugin extends BasePlugin {
        }

        export interface Factory {
            (pluginApi:IPluginApi):IPlugin;
        }

    }

    // ------------------------------------------------------------------------
    // --------------------------- [subcmixer] plug-in ------------------------

    export namespace SubcMixer {

        export interface Props {
            isActive:boolean;
        }

        export interface IPlugin extends BasePlugin {
            getWidgetView():View;
        }

        export type View = React.ComponentClass<Props>|React.SFC<Props>;

        export interface Factory {
            (
                pluginApi:IPluginApi,
                textTypesModel:TextTypes.ITextTypesModel<{}>,
                corpusIdAttr:string
            ):IPlugin;
        }
    }


    // ------------------------------------------------------------------------
    // ------------------------------ [syntax_viewer] plug-in -----------------

    export namespace SyntaxViewer {

        export interface IPlugin extends BasePlugin {
            close():void;
            onPageResize():void;
            registerOnError(fn:(e:Error)=>void):void;
            getModel():IModel<BaseState>;
        }

        export interface Factory {
            (pluginApi:IPluginApi):IPlugin;
        }

        export interface BaseState {
            isBusy:boolean;
            tokenNumber:number;
            kwicLength:number;
            targetHTMLElementID:string;
        }
    }


    // ------------------------------------------------------------------------
    // ------------------------ [taghelper] plug-in ---------------------------

    export namespace TagHelper {


        /**
         * TagsetInfo specifies a complete information
         * about tagset - name, type and used positional
         * attributes.
         */
        export interface TagsetInfo {

            /**
             * Concrete tagset identifier. The values
             * are KonText-fabricated (pp_tagset, ud,...).
             * On the other hand, the values are not
             * hardcoded into the code as they are used
             * to fetch proper tagset configuration
             * (which is admin-defined).
             */
            ident:string;

            /**
             * 'other' declares that there is a defined
             * tagset for the corpus but not a supported one.
             */
            type:'positional'|'keyval'|'other';

            /**
             * A positional attribute reserved for part of speech info.
             * If null then we assume all the info is stored within featAttr
             * (see below).
             */
            posAttr:string|null;

            /**
             * A positional attribute all the (other) tag information
             * is stored within.
             */
            featAttr:string;
        }

        export interface ViewProps {
            sourceId:string;
            formType:QueryFormType;
            range:[number, number];
            onInsert:()=>void;
            onEscKey:()=>void;
        }

        export type View = React.ComponentClass<ViewProps>|React.SFC<ViewProps>;

        export interface IPlugin extends BasePlugin {
            getWidgetView(corpname:string,
                tagsetInfo:Array<PluginInterfaces.TagHelper.TagsetInfo>):TagHelper.View;
        }

        export interface Factory {
            (pluginApi:IPluginApi):IPlugin;
        }
    }

    // ------------------------------------------------------------------------
    // ------------------------ [query_storage] plug-in -----------------------

    export namespace QueryStorage {

        export interface IModel extends IEventEmitter {

            getCurrentCorpusOnly():boolean;
            getData():Array<Kontext.QueryHistoryItem>;
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
            formType:QueryFormType;
            onCloseTrigger:()=>void;
        }

        export type WidgetView = React.ComponentClass<WidgetProps>;

        export interface IPlugin extends BasePlugin {

            getWidgetView():WidgetView;

            getModel():IModel;
        }

        export interface Factory {
            (
                pluginApi:IPluginApi,
                offset:number,
                limit:number,
                pageSize:number,
                initialData:Array<Kontext.QueryHistoryItem>
            ):IPlugin;
        }
    }


    // ------------------------------------------------------------------------
    // ------------------------ [corparch] plug-in ----------------------------

    export namespace Corparch {


        /**
         * A general click action performed on featured/favorite/searched item
         */
        export interface CorplistItemClick {
            (corpora:Array<string>, subcorpId:string):void;
        }

        export type WidgetView = React.ComponentClass<{}>;

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

        export interface IPlugin extends IUnregistrable, BasePlugin {

            /**
             * Create a corpus selection widget used on the query page
             */
            createWidget(targetAction:string,
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

        export type View = React.ComponentClass|React.SFC;

        export type CustomAttribute = React.ComponentClass|React.SFC;

        export interface Views {
            LiveAttrsView:View;
            LiveAttrsCustomTT:CustomAttribute;
        }

        export interface IPlugin extends IUnregistrable, BasePlugin {

            getViews(subcMixerView:SubcMixer.View, textTypesModel:IModel<{}>):Views;

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

        export interface Factory {
            (
                pluginApi:IPluginApi,
                textTypesModel:TextTypes.ITextTypesModel<{}>,
                isEnabled:boolean,
                controlsAlignedCorpora:boolean,
                args:PluginInterfaces.LiveAttributes.InitArgs
            ):IPlugin;
        }
    }


    // ------------------------------------------------------------------------
    // ------------------------- [issue_reporting] plug-in --------------------

    export namespace IssueReporting {

        export interface IPlugin extends BasePlugin {

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

        export interface IPlugin extends BasePlugin {
            getWidgetView():WidgetWiew;
        }

        export enum Actions {
            FetchInfo = 'KWIC_CONNECT_FETCH_INFO'
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
                is_kwic_view:boolean;
                contents:Array<[string, string]>;
                found:boolean;
                heading:string;
            }>;
        }

        export interface RendererData {
            data: Array<[string, string]>;
        }

        export type Renderer = React.ComponentClass<Kontext.GeneralProps>|
            React.SFC<Kontext.GeneralProps>;

        export interface DataAndRenderer {
            renderer:Renderer;
            contents:Kontext.GeneralProps; // TODO use unknown and generics
            isKwicView:boolean;
            found:boolean;
            heading:string;
        }

        export interface TCData {
            token:string;
            renders:Array<DataAndRenderer>;
        }

        export interface IPlugin extends BasePlugin {

            fetchTokenConnect(corpusId:string, tokenId:number, numTokens:number):Observable<TCData>;

            selectRenderer(typeId:string):Renderer;

            providesAnyTokenInfo():boolean;
        }

        export interface Factory {
            (pluginApi:IPluginApi, alignedCorpora:Array<string>):IPlugin;
        }
    }


    // ------------------------------------------------------------------------
    // ------------------------- [query_suggest] plug-in -----------------------

    export namespace QuerySuggest {

        export interface IPlugin extends BasePlugin {
            createElement<T>(dr:DataAndRenderer<T>):React.ReactElement;
            isEmptyResponse<T>(v:DataAndRenderer<T>):boolean;
            listCurrentProviders():Array<string>;
        }

        export enum ActionName {
            AskSuggestions = 'QUERY_SUGGEST_ASK_SUGGESTIONS',
            ClearSuggestions = 'QUERY_SUGGEST_CLEAR_SUGGESTIONS',
            SuggestionsReceived = 'QUERY_SUGGEST_SUGGESTIONS_RECEIVED'
        }

        export type SuggestionValueType = 'posattr'|'struct'|'structattr'|'unspecified';

        export enum SuggestionVisibility {
            DISABLED = 0,
            MANUAL = 1,
            AUTO = 2
        }

        export interface SuggestionArgs {
            sourceId:string;
            value:string;
            rawAnchorIdx:number;
            rawFocusIdx:number;
            valueType:SuggestionValueType;
            queryType:QueryType;
            corpora:Array<string>;
            subcorpus:string|undefined;
            posAttr:string|undefined;
            struct:string|undefined;
            structAttr:string|undefined;
        }

        export interface SuggestionAnswer {
            parsedWord:string; // the word actually used to search the suggestion
            results:Array<DataAndRenderer<unknown>>;
            isPartial:boolean;
        }

        export type SuggestionReturn = SuggestionArgs & SuggestionAnswer;

        export namespace Actions {

            export interface AskSuggestions extends Action<SuggestionArgs> {
                name: ActionName.AskSuggestions
            }

            export interface ClearSuggestions extends Action<{}> {
                name: ActionName.ClearSuggestions
            }

            export interface SuggestionsReceived extends Action<SuggestionReturn> {
                name: ActionName.SuggestionsReceived
            }

        }

        export type Renderer = React.ComponentClass<Kontext.GeneralProps>|
            React.SFC<Kontext.GeneralProps>;

        export interface DataAndRenderer<T> {
            rendererId:string;
            contents:T;
            heading:string;
        }

        export type Factory = (pluginApi:IPluginApi)=>IPlugin;
    }

}
