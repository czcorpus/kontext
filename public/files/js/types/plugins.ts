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
import { ITranslator, IFullActionControl, IModel, Action } from 'kombo';

import { Kontext, TextTypes } from '../types/common';
import { CoreViews } from './coreViews';
import { ConcServerArgs, IConcLinesProvider } from '../models/concordance/common';
import { QueryFormType } from '../models/query/actions';
import { IUnregistrable } from '../models/common/common';
import { AnyQuery, QuerySuggestion, QueryType } from '../models/query/query';

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
    renderReactComponent<T, U>(reactClass:React.ComponentClass<T>|React.FC<T>,
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
            (pluginApi:IPluginApi, initToolbar:boolean):IPlugin;
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

        export type View = React.ComponentClass<Props>|React.FC<Props>;

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

        export type View = React.ComponentClass<ViewProps>|React.FC<ViewProps>;

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

        export interface WidgetProps {
            sourceId:string;
            formType:QueryFormType;
            onCloseTrigger:()=>void;
        }

        export interface ModelState {
            data:Array<Kontext.QueryHistoryItem>;
            offset:number;
            limit:number;
            queryType:string;
            currentCorpusOnly:boolean;
            isBusy:boolean;
            pageSize:number;
            hasMoreItems:boolean;
            archivedOnly:boolean;
            editingQueryId:string;
            editingQueryName:string;
            currentItem:number;
        }

        export type WidgetView = React.ComponentClass<WidgetProps>;

        export interface IPlugin extends BasePlugin {

            getWidgetView():WidgetView;

            getModel():IModel<ModelState>;
        }

        export interface Factory {
            (
                pluginApi:IPluginApi,
                offset:number,
                limit:number,
                pageSize:number
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

            getForm():React.ComponentClass|React.FC<{}>;

            getList():React.ComponentClass|React.FC<{}>;
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

        export type View = React.ComponentClass|React.FC;

        export type CustomAttribute = React.ComponentClass|React.FC;


        export enum ActionName {
            RefineClicked = 'LIVE_ATTRIBUTES_REFINE_CLICKED',
            RefineReady = 'LIVE_ATTRIBUTES_REFINE_READY',
            ResetClicked = 'LIVE_ATTRIBUTES_RESET_CLICKED',
            UndoClicked = 'LIVE_ATTRIBUTES_UNDO_CLICKED',
            ToggleMinimizeAlignedLangList = 'LIVE_ATTRIBUTES_TOGGLE_MINIMIZE_ALIGNED_LANG_LIST',
            AlignedCorpChanged = 'LIVE_ATTRIBUTES_ALIGNED_CORP_CHANGED',

        }

        export namespace Actions {

            export interface RefineClicked extends Action<{
            }> {
                name:ActionName.RefineClicked;
            }

            export interface RefineReady extends Action<{
                selections:TextTypes.ExportedSelection;
            }> {
                name:ActionName.RefineReady;
            }

            export interface ResetClicked extends Action<{
            }> {
                name:ActionName.ResetClicked;
            }

            export interface UndoClicked extends Action<{
            }> {
                name:ActionName.UndoClicked;
            }

            export interface ToggleMinimizeAlignedLangList extends Action<{
            }> {
                name:ActionName.ToggleMinimizeAlignedLangList;
            }

            export interface AlignedCorpChanged extends Action<{
                idx:number;
            }> {
                name:ActionName.AlignedCorpChanged;
            }
        }

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

            getWidgetView():React.ComponentClass|React.FC<{}>;
        }

        export interface Factory {
            (pluginApi:IPluginApi):IPlugin;
        }
    }


    // ------------------------------------------------------------------------
    // ------------------------- [kwic_connect] plug-in -----------------------

    export namespace KwicConnect {

        export type WidgetWiew = React.ComponentClass<{}>|React.FC<{}>;

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
            React.FC<Kontext.GeneralProps>;

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

            /**
             * Fetch a detail information about a token with numeric ID equal to tokenId. The
             * token can be multi-word (numTokens > 1). Also an optional additional context
             * can be considered (e.g. when using the plug-in as a source for alternative kwic
             * detail).
             */
            fetchTokenConnect(
                corpusId:string,
                tokenId:number,
                numTokens:number,
                context?:[number, number]
            ):Observable<TCData>;

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

        export interface IPlugin extends BasePlugin, IUnregistrable {
            createElement<T>(
                dr:QuerySuggestion<T>,
                itemClickHandler:(providerId:string, value:unknown)=>void
            ):React.ReactElement;
            isEmptyResponse<T>(v:QuerySuggestion<T>):boolean;
            listCurrentProviders():Array<string>;
            applyClickOnItem(query:AnyQuery, tokenIdx:number, providerId:string, value:unknown):void;
        }

        export enum ActionName {
            AskSuggestions = 'QUERY_SUGGEST_ASK_SUGGESTIONS',
            ClearSuggestions = 'QUERY_SUGGEST_CLEAR_SUGGESTIONS',
            SuggestionsRequested = 'QUERY_SUGGEST_SUGGESTIONS_REQUESTED',
            SuggestionsReceived = 'QUERY_SUGGEST_SUGGESTIONS_RECEIVED',
            ItemClicked = 'QUERY_SUGGEST_ITEM_CLICKED'
        }

        export type SuggestionValueType = 'posattr'|'struct'|'structattr'|'unspecified';

        /**
         * formats are:
         * regexp: simple query with regexp support enabled
         * simple: simple query with regexp disabled and case sensitive
         *   - this mode probably won't be needed (TODO)
         * simple_ic: simple query with regexp disabled and ignoring case enabled
         * advanced: CQL query
         */
        export type QueryValueSubformat = 'regexp'|'simple'|'simple_ic'|'advanced';

        export interface SuggestionArgs {
            timeReq:number;
            sourceId:string;
            formType:QueryFormType;
            value:string;
            valueStartIdx:number;
            valueEndIdx:number;
            attrStartIdx?:number;
            attrEndIdx?:number;
            valueType:SuggestionValueType;
            valueSubformat:QueryValueSubformat;
            queryType:QueryType;
            corpora:Array<string>;
            subcorpus:string|undefined;
            posAttr:string|undefined;
            struct:string|undefined;
            structAttr:string|undefined;
        }

        export interface SuggestionAnswer {
            parsedWord:string; // the word actually used to search the suggestion
            results:Array<QuerySuggestion<unknown>>;
            isPartial:boolean;
        }

        export type SuggestionReturn = SuggestionArgs & SuggestionAnswer;

        export namespace Actions {

            export interface AskSuggestions extends Action<SuggestionArgs> {
                name: ActionName.AskSuggestions
            }

            export interface ClearSuggestions extends Action<{
                formType:QueryFormType;
            }> {
                name: ActionName.ClearSuggestions
            }

            export interface SuggestionsRequested extends Action<SuggestionArgs> {
                name: ActionName.SuggestionsRequested
            }

            export interface SuggestionsReceived extends Action<SuggestionReturn> {
                name: ActionName.SuggestionsReceived
            }

            export interface ItemClicked extends Action<{
                value:unknown;
                tokenIdx:number;
                sourceId:string;
                providerId:string;
                formType:string;
            }> {
                name: ActionName.ItemClicked
            }

        }

        export type Renderer = React.ComponentClass<Kontext.GeneralProps>|
            React.FC<Kontext.GeneralProps>;

        export type Factory = (pluginApi:IPluginApi)=>IPlugin;
    }

}
