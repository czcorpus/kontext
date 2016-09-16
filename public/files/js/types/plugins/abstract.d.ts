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

/// <reference path="../common.d.ts" />
/// <reference path="./liveAttributes.d.ts" />
/// <reference path="./subcmixer.d.ts" />
/// <reference path="./corparch.ts" />

/*
This module contains "fake" plugin modules representing
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

declare module 'plugins/applicationBar/init' {

    export interface Toolbar extends Kontext.Plugin {
        openLoginDialog():void;
    }

    export function create(pluginApi:Kontext.PluginApi):RSVP.Promise<Toolbar>;

    export function openLoginDialog():void;
}

declare module "plugins/applicationBar/toolbar" {
    export function openLoginDialog():void;
}

declare module 'plugins/footerBar/init' {
    export function create(pluginApi:Kontext.PluginApi):RSVP.Promise<Kontext.Plugin>;
}

declare module "plugins/corparch/init" {
    export function create(target:HTMLElement, targetAction:string, pluginApi:Kontext.QueryPagePluginApi,
        conf:CorpusArchive.Options);

    export function initCorplistPageComponents(pluginApi:Kontext.PluginApi):Customized.CorplistPage;
}

declare module "plugins/liveAttributes/init" {
    export = LiveAttributesInit;
}

declare module "plugins/queryStorage/init" {
    export function create(pluginApi:Kontext.PluginApi):Plugins.IQueryStorage;
}

declare module "plugins/taghelper/init" {
    export function create(pluginApi:Kontext.PluginApi,
            insertCallback:(value:string)=>void, widgetId:number):(box:Legacy.IPopupBox, finalize:()=>void)=>void;
}

declare module "plugins/syntaxViewer/init" {
    export function create(pluginApi:Kontext.PluginApi):void;
}


declare module "plugins/subcmixer/init" {

    export function getViews(
        dispatcher:Dispatcher.Dispatcher<any>,
        mixins:any,
        layoutViews:any,
        subcmixerStore:Subcmixer.ISubcMixerStore
    ):Subcmixer.SubcMixerViews

    export function create(pluginApi:Kontext.PluginApi,
            textTypesStore:TextTypes.ITextTypesStore):Subcmixer.ISubcMixerStore;
}
