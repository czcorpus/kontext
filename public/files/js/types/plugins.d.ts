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

declare module PluginInterfaces {

    export interface IAuth {
    }

    export interface IToolbar {
    }

    export interface IFooterBar {
    }

    export interface ISubcMixer {
        refreshData():void;
        getWidgetView():React.ReactClass;
    }

    export interface ISyntaxViewer {
    }

    export interface ITagHelper {
        getWidgetView():React.ReactClass;
    }

    export interface IQueryStorage {
        getWidgetView():React.ReactClass;
    }

    export interface ILiveAttributes extends TextTypes.AttrValueTextInputListener {
        getViews(subcMixerView:React.ReactClass, textTypesStore:TextTypes.ITextTypesStore):any; // TODO types
        notifyChangeListeners():void;
    }

    /**
     * A factory class for generating corplist page. The page is expected
     * to contain two blocks
     *  - a form (typically a filter)
     *  - a dataset (= list of matching corpora)
     *
     */
    export interface ICorplistPage {

        createForm(targetElm:HTMLElement, properties:any):void;

        createList(targetElm:HTMLElement, properties:any):void;
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

    export function create(pluginApi:Kontext.PluginApi):RSVP.Promise<PluginInterfaces.IToolbar>;
}

declare module 'plugins/footerBar/init' {
    export function create(pluginApi:Kontext.PluginApi):RSVP.Promise<PluginInterfaces.IFooterBar>;
}

declare module "plugins/corparch/init" {

    export function createWidget(targetAction:string, pluginApi:Kontext.PluginApi,
        queryStore:any, querySetupHandler:Kontext.QuerySetupHandler, conf:Kontext.GeneralProps):React.Component;

    export function initCorplistPageComponents(pluginApi:Kontext.PluginApi):PluginInterfaces.ICorplistPage;
}

declare module "plugins/liveAttributes/init" {

    export default function create(pluginApi:Kontext.PluginApi,
                     textTypesStore:TextTypes.ITextTypesStore,
                     selectedCorporaProvider:()=>Immutable.List<string>,
                     ttCheckStatusProvider:()=>boolean,
                     bibAttr:string):RSVP.Promise<PluginInterfaces.ILiveAttributes>;

}

declare module "plugins/queryStorage/init" {
    export default function create(pluginApi:Kontext.PluginApi):RSVP.Promise<PluginInterfaces.IQueryStorage>;
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
