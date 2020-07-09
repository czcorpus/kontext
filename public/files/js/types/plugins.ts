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
import {Kontext, TextTypes} from '../types/common';
import {CoreViews} from './coreViews';
import {IConcLinesProvider} from '../types/concordance';
import { IEventEmitter, ITranslator, IFullActionControl } from 'kombo';
import { ConcServerArgs } from '../models/concordance/common';
import { QueryFormType } from '../models/query/actions';

/**
 * An interface used by KonText plug-ins to access
 * core functionality (for core components, this is
 * typically provided by PageModel).
 */
export interface IPluginApi extends ITranslator {
    getConf<T>(key:string):T;
    getNestedConf<T>(...keys:Array<string>):T;
    createStaticUrl(path:string):string;
    createActionUrl<T>(path:string, args?:Array<[string, T]>|Kontext.IMultiDict<T>):string;
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
    pluginIsActive(name:string):boolean;
    getConcArgs():Kontext.IMultiDict<ConcServerArgs>;
    getCorpusIdent():Kontext.FullCorpusIdent;
    registerSwitchCorpAwareObject(obj:Kontext.ICorpusSwitchAwareModel<any>):void;
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
            getSignUpView():React.ComponentClass|null;
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
            getWidgetView():React.ComponentClass;
        }

        export type View = React.ComponentClass<{isActive:boolean}>;

        export interface Factory {
            (
                pluginApi:IPluginApi,
                textTypesModel:TextTypes.ITextTypesModel,
                corpusIdAttr:string
            ):IPlugin;
        }
    }


    // ------------------------------------------------------------------------
    // ------------------------------ [syntax_viewer] plug-in -----------------

    export namespace SyntaxViewer {

        export interface IPlugin extends IEventEmitter {
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

        export interface IPlugin {
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

            /**
             * Create a corpus selection widget used on the query page
             */
            createWidget(targetAction:string,
                options:Kontext.GeneralProps):React.ComponentClass<{}>;

            /**
             * This is needed when corpus change is performed.
             */
            disposeWidget():void;

            initCorplistPageComponents(initialData:any):ICorplistPage;
        }

        export interface Factory {
            (pluginApi:IPluginApi):IPlugin;
        }
    }

    // ------------------------------------------------------------------------
    // -------------------------- [live_attributes] plug-in -------------------

    export namespace LiveAttributes {

        export interface IPlugin {
            getViews(subcMixerView:React.ComponentClass,
                textTypesModel:TextTypes.ITextTypesModel):any; // TODO types
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
                isEnabled:boolean,
                controlsAlignedCorpora:boolean,
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
            contents:Kontext.GeneralProps;
            isKwicView:boolean;
            found:boolean;
            heading:string;
        }

        export interface TCData {
            token:string;
            renders:Array<DataAndRenderer>;
        }

        export interface IPlugin {

            fetchTokenConnect(corpusId:string, tokenId:number, numTokens:number):Observable<TCData>;

            selectRenderer(typeId:string):Renderer;

            providesAnyTokenInfo():boolean;
        }

        export interface Factory {
            (pluginApi:IPluginApi, alignedCorpora:Array<string>):IPlugin;
        }
    }

}
