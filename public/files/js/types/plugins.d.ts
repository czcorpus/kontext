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

/// <reference path="../vendor.d.ts/rsvp.d.ts" />
/// <reference path="../vendor.d.ts/react.d.ts" />

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

The actual 'generic name' => 'actual name' mapping is
performed during webpack compilation where proper
aliases are defined for TS compiler.
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

    export default function create(pluginApi):RSVP.Promise<PluginInterfaces.IToolbar>;
}

declare module 'plugins/footerBar/init' {
    export default function create(pluginApi:IPluginApi):RSVP.Promise<PluginInterfaces.IFooterBar>;
}

declare module "plugins/corparch/init" {

    export function createWidget(targetAction:string, pluginApi:IPluginApi,
        queryStore:PluginInterfaces.ICorparchStore, querySetupHandler:Kontext.QuerySetupHandler, conf:Kontext.GeneralProps):React.ComponentClass;

    export function initCorplistPageComponents(pluginApi:IPluginApi):PluginInterfaces.ICorplistPage;
}

declare module "plugins/liveAttributes/init" {

    export default function create(pluginApi:IPluginApi,
                     textTypesStore:TextTypes.ITextTypesStore,
                     selectedCorporaProvider:()=>Immutable.List<string>,
                     ttCheckStatusProvider:()=>boolean,
                     args:PluginInterfaces.ILiveAttrsInitArgs):RSVP.Promise<PluginInterfaces.ILiveAttributes>;

}

declare module "plugins/queryStorage/init" {
    export default function create(pluginApi:IPluginApi, offset:number, limit:number, pageSize:number):RSVP.Promise<PluginInterfaces.IQueryStorage>;
}

declare module "plugins/taghelper/init" {
    let create:(pluginApi:IPluginApi)=>RSVP.Promise<PluginInterfaces.ITagHelper>;
    export default create;
}

declare module "plugins/auth/init" {
    export default function create(pluginApi:IPluginApi):RSVP.Promise<PluginInterfaces.IAuth>;
}

declare module "plugins/syntaxViewer/init" {
    export default function create(pluginApi:IPluginApi):RSVP.Promise<PluginInterfaces.ISyntaxViewer>;
}


declare module "plugins/subcmixer/init" {

    export default function create(pluginApi:IPluginApi,
            textTypesStore:TextTypes.ITextTypesStore,
            getCurrentSubcnameFn:()=>string,
            getAlignedCoroporaFn:()=>Immutable.List<TextTypes.AlignedLanguageItem>,
            corpusIdAttr:string):RSVP.Promise<PluginInterfaces.ISubcMixer>;
}


declare module "plugins/issueReporting/init" {
    export default function create(pluginApi:IPluginApi):RSVP.Promise<PluginInterfaces.IIssueReporting>;
}


declare module "plugins/tokenDetail/init" {
    export default function create(
        pluginApi:IPluginApi,
        alignedCorpora:Array<string>
    ):RSVP.Promise<PluginInterfaces.TokenDetail.IPlugin>;
}
