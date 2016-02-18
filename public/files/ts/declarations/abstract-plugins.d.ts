/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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
/// <reference path="../../js/common/plugins/liveAttributes.ts" />
/// <reference path="../../js/common/plugins/corparch.ts" />

declare module "plugins/applicationBar/init" {
    export function createInstance(pluginApi:Kontext.PluginApi);
}

declare module "plugins/corparch/init" {
    export function create(target:HTMLElement, pluginApi:Kontext.QueryPagePluginApi,
        conf:CorpusArchive.Options);

    export function initCorplistPageComponents(pluginApi:Kontext.PluginApi):Customized.CorplistPage;
}

declare module "plugins/liveAttributes/init" {
    export function init(pluginApi:Kontext.QueryPagePluginApi,
                     conf:{[key:string]:string},
                     updateButton:HTMLElement, resetButton:HTMLElement,
                     attrFieldsetWrapper:HTMLElement):RSVP.Promise<LiveAttributes.Widget>
}

declare module "plugins/queryStorage/init" {
    export function createInstance(pluginApi:Kontext.PluginApi):Plugins.IQueryStorage;
}