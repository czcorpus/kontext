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
/// <reference path="../../ts/declarations/react.d.ts" />
/// <reference path="../../ts/declarations/flux.d.ts" />


declare module "views/document" {
    export function init(dispatcher:Dispatcher.Dispatcher<any>, mixins:any,
            storeProvider:any):Kontext.LayoutViews;
}


declare module "views/concordance/lineSelection" {

    export interface LineSelectionViews {
        LineSelectionMenu:React.ReactClass;
        LockedLineGroupsMenu:React.ReactClass;
    }

    export function init(dispatcher:Dispatcher.Dispatcher<any>, mixins:any,
            lineSelectionStore:any, userInfoStore:any):LineSelectionViews;
}


declare module "views/concordance/lines" {

    export interface ConcLinesViews {
        ConcLines:React.ReactClass;
    }

    export function init(dispatcher:Dispatcher.Dispatcher<any>, mixins:any,
            lineStore:any, lineSelectionStore:any):ConcLinesViews;
}


declare module "views/concordance/paginator" {

    export interface PaginatorViews {
        Paginator:React.ReactClass;
    }

    export function init(dispatcher:Dispatcher.Dispatcher<any>, mixins:any,
            lineStore:any):PaginatorViews;
}

declare module "views/concordance/main" {

    export interface ConcordanceView {
        ConcordanceView:React.ReactClass;
    }

    export function init(dispatcher:Dispatcher.Dispatcher<any>, mixins:any,
            lineStore:any, lineSelectionStore:any, userInfoStore:any,
            viewOptionsStore:ViewOptions.IViewOptionsStore,
            layoutViews:Kontext.LayoutViews):ConcordanceView;
}

declare module "views/concordance/detail" {

    export interface RefDetail {
        RefDetail: React.ReactClass;
    }

    export function init(dispatcher:Dispatcher.Dispatcher<any>, mixins:any):RefDetail;
}


declare module "views/subcorp/forms" {

    export interface SubcorpFormViews {
        WithinBuilder:React.ReactClass;
    }

    export function init(dispatcher:Dispatcher.Dispatcher<any>, mixins:any,
            subcorpFormStore:any):SubcorpFormViews;
}


declare module "views/subcorp/list" {

    export interface SubcorpListViews {
        SubcorpList:React.ReactClass;
    }

    export function init(dispatcher:Dispatcher.Dispatcher<any>, mixins:any,
            layoutViews:Kontext.LayoutViews, subcorpListStore:any):SubcorpListViews;
}


declare module "views/textTypes" {

    export interface TextTypesViews {
        TextTypesPanel:React.ReactClass;
    }

    export function init(dispatcher:Dispatcher.Dispatcher<any>, mixins:any,
            textTypesStore:any):TextTypesViews;

}


declare module "views/menu" {

    export interface MainMenuViews {
        MainMenu:React.ReactClass;
    }

    export function init(dispatcher:Dispatcher.Dispatcher<any>, mixins:any,
            concArgHandler:Kontext.IConcArgsHandler, asyncTaskStore:Kontext.IAsyncTaskStore):MainMenuViews;
}


declare module "views/query/context" {

    export interface QueryContextViews {
        SpecifyContextForm:React.ReactClass;
    }

    export function init(dispatcher:Dispatcher.Dispatcher<any>, mixins):QueryContextViews;
}


declare module "views/wordlist/forms" {

    export interface WordlistFormViews {
        SaveWlForm:React.ReactClass;
    }

    export function init(dispatcher:Dispatcher.Dispatcher<any>,
            mixins:any):WordlistFormViews;
}


declare module "views/options/structsAttrs" {

    export interface StructsAndAttrsViews {
        StructsAndAttrsForm: React.ReactClass;
    }

    export function init(dispatcher:Dispatcher.Dispatcher<any>,
            mixins:any, viewOptionsStore:ViewOptions.IViewOptionsStore):StructsAndAttrsViews;
}


declare module "views/overview" {

    export interface OverviewViews {
        OverviewArea: React.ReactClass;
        CorpusInfoBox: React.ReactClass;
    }

    export function init(dispatcher:Dispatcher.Dispatcher<any>, mixins:any,
            corpusInfoStore:any, popupBoxComponent:React.ReactClass):OverviewViews;
}
