/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="./common.d.ts" />
/// <reference path="../vendor.d.ts/rsvp.d.ts" />

/**
 *
 */
declare module PluginInterfaces {

    export interface IAuth {
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

/*
The following part contains "fake" plugin modules representing
virtual general plug-ins implementations with proper module
names which can be hardcoded in KonText source codes.

E.g.: KonText requires (if configured) module
"plugins/applicationBar/init" but a custom implementation
must use a different name,
e.g.: "plugins/myOrganizationApplicationBar/init".

To be able to compile the project, TypeScript compiler must be
persuaded that general names actually exist. At runtime, RequireJS
remaps these names to custom ones.
*/

/**
 * This represents an external library provided
 * by toolbar provider.
 */
declare module 'plugins/applicationBar/toolbar' {
    export function init():void;
    export function openLoginDialog():void;
}

declare module 'plugins/applicationBar/init' {

    export default function create(pluginApi:Kontext.PluginApi):RSVP.Promise<PluginInterfaces.IToolbar>;
}

declare module 'plugins/footerBar/init' {
    export default function create(pluginApi:Kontext.PluginApi):RSVP.Promise<PluginInterfaces.IFooterBar>;
}

declare module "plugins/corparch/init" {

    export function createWidget(targetAction:string, pluginApi:Kontext.PluginApi,
        queryStore:PluginInterfaces.ICorparchStore, querySetupHandler:Kontext.QuerySetupHandler, conf:Kontext.GeneralProps):React.ComponentClass;

    export function initCorplistPageComponents(pluginApi:Kontext.PluginApi):PluginInterfaces.ICorplistPage;
}

declare module "plugins/liveAttributes/init" {

    export default function create(pluginApi:Kontext.PluginApi,
                     textTypesStore:TextTypes.ITextTypesStore,
                     selectedCorporaProvider:()=>Immutable.List<string>,
                     ttCheckStatusProvider:()=>boolean,
                     args:PluginInterfaces.ILiveAttrsInitArgs):RSVP.Promise<PluginInterfaces.ILiveAttributes>;

}

declare module "plugins/queryStorage/init" {
    export default function create(pluginApi:Kontext.PluginApi, offset:number, limit:number, pageSize:number):RSVP.Promise<PluginInterfaces.IQueryStorage>;
}

declare module "plugins/taghelper/init" {
    let create:(pluginApi:Kontext.PluginApi)=>RSVP.Promise<PluginInterfaces.ITagHelper>;
    export default create;
}

declare module "plugins/auth/init" {
    export default function create(pluginApi:Kontext.PluginApi):RSVP.Promise<PluginInterfaces.IAuth>;
}

declare module "plugins/syntaxViewer/init" {
    export default function create(pluginApi:Kontext.PluginApi):RSVP.Promise<PluginInterfaces.ISyntaxViewer>;
}


declare module "plugins/subcmixer/init" {

    export default function create(pluginApi:Kontext.PluginApi,
            textTypesStore:TextTypes.ITextTypesStore,
            getCurrentSubcnameFn:()=>string,
            getAlignedCoroporaFn:()=>Immutable.List<TextTypes.AlignedLanguageItem>,
            corpusIdAttr:string):RSVP.Promise<PluginInterfaces.ISubcMixer>;
}


declare module "plugins/issueReporting/init" {
    export default function create(pluginApi:Kontext.PluginApi):RSVP.Promise<PluginInterfaces.IIssueReporting>;
}


declare module "plugins/tokenDetail/init" {
    export default function create(
        pluginApi:Kontext.PluginApi,
        alignedCorpora:Array<string>
    ):RSVP.Promise<PluginInterfaces.TokenDetail.IPlugin>;
}
