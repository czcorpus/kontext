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
    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            storeProvider:any):Kontext.LayoutViews;
}


declare module "views/concordance/lineSelection" {

    export interface LineSelectionViews {
        LineSelectionMenu:React.ReactClass;
        LockedLineGroupsMenu:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            lineSelectionStore:any, userInfoStore:any):LineSelectionViews;
}


declare module "views/concordance/lines" {

    export interface ConcLinesViews {
        ConcLines:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            lineStore:any, lineSelectionStore:any):ConcLinesViews;
}


declare module "views/concordance/paginator" {

    export interface PaginatorViews {
        Paginator:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            lineStore:any):PaginatorViews;
}

declare module "views/concordance/main" {

    export interface ConcordanceView {
        ConcordanceView:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        mixins:any,
        layoutViews:Kontext.LayoutViews,
        stores:any
    ):ConcordanceView;
}

declare module "views/concordance/detail" {

    export interface RefDetail {
        RefDetail: React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any, layoutViews:any,
            concDetailStore:Kontext.PageStore):RefDetail;
}


declare module "views/subcorp/forms" {

    export interface SubcorpFormViews {
        WithinBuilder:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            subcorpFormStore:any):SubcorpFormViews;
}


declare module "views/subcorp/list" {

    export interface SubcorpListViews {
        SubcorpList:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            layoutViews:Kontext.LayoutViews, subcorpListStore:any):SubcorpListViews;
}


declare module "views/textTypes" {

    export interface TextTypesViews {
        TextTypesPanel:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            textTypesStore:any):TextTypesViews;

}


declare module "views/menu" {

    export interface MainMenuViews {
        MainMenu:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            concArgHandler:Kontext.IConcArgsHandler, mainMenuStore:any,
            asyncTaskStore:Kontext.IAsyncTaskStore,
            layoutViews:Kontext.LayoutViews):MainMenuViews;
}

declare module "views/query/corpSel" {

    export interface CorpusSelectionViews {
        TRCorpusField:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        mixins:any
    ):CorpusSelectionViews;
}


declare module "views/query/main" {

    export interface QueryFormViews {
        QueryForm:React.ReactClass;
        QueryFormLite:React.ReactClass;
    }

    export function init(
            dispatcher:Kontext.FluxDispatcher,
            mixins:any,
            layoutViews:Kontext.LayoutViews,
            queryStore:any,
            textTypesStore:any,
            queryHintStore:any,
            withinBuilderStore:any,
            virtualKeyboardStore:any,
            queryContextStore:any):QueryFormViews;
}


declare module "views/query/aligned" {

    export interface AlignedQueryFormViews {
        AlignedCorpora:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            queryStore:any):AlignedQueryFormViews;
}


declare module "views/query/context" {

    export interface QueryContextViews {
        SpecifyContextForm:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any):QueryContextViews;
}


declare module "views/query/filter" {

    export interface FilterFormViews {
        FilterForm:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any, layoutViews:Kontext.LayoutViews,
            filterStore:any, queryHintStore:any, withinBuilderStore:any, virtualKeyboardStore:any):FilterFormViews;

}

declare module "views/query/sort" {

    export interface SortFormViews {
        SortFormView:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher,
        mixins:any, layoutViews:Kontext.LayoutViews, sortStore:any, multiLevelSortStore:any):SortFormViews;
}


declare module "views/query/sampleShuffle" {

    export interface SampleFormViews {
        SampleFormView:React.ReactClass;
        ShuffleFormView:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any, sampleStore:any):SampleFormViews;
}


declare module "views/query/overview" {

    export interface QueryToolbarViewDeps {
        QueryFormView:React.ReactClass;
        FilterFormView:React.ReactClass;
        SortFormView:React.ReactClass;
        SampleFormView:React.ReactClass;
        ShuffleFormView:React.ReactClass;
    }

    export interface QueryToolbarViews {
        QueryToolbar:React.ReactClass;
        NonViewPageQueryToolbar:React.ReactClass;
    }

    export function init(
            dispatcher:Kontext.FluxDispatcher,
            mixins:any,
            layoutViews:Kontext.LayoutViews,
            viewDeps:QueryToolbarViewDeps,
            queryReplayStore:any,
            mainMenuStore:any):QueryToolbarViews;
}


declare module "views/wordlist/save" {

    export interface WordlistSaveViews {
        SaveWlForm:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher,
            mixins:any):WordlistSaveViews;
}


declare module "views/wordlist/form" {

    export interface WordlistFormViews {
        WordlistCorpSelection:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher,
            mixins:any, wordlistPageStore:any):WordlistFormViews;
}


declare module "views/options/structsAttrs" {

    export interface StructsAndAttrsViews {
        StructAttrsViewOptions: React.ReactClass;
    }

    export function init(
            dispatcher:Kontext.FluxDispatcher,
            mixins:any,
            layoutViews:Kontext.LayoutViews,
            viewOptionsStore:any,
            mainMenustore:any):StructsAndAttrsViews;
}


declare module "views/overview" {

    export interface OverviewViews {
        OverviewArea: React.ReactClass;
        CorpusInfoBox: React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            corpusInfoStore:any, popupBoxComponent:React.ReactClass):OverviewViews;
}


declare module "views/analysis/frame" {

    export interface AnalysisFrameViews {
        AnalysisFrame:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        mixins:any,
        layoutViews:Kontext.LayoutViews,
        collFormViews:any,
        freqFormViews:any,
        mainMenuStore:any
    );
}


declare module "views/analysis/coll" {

    export interface CollFormViews {
        CollForm: React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            layoutViews:any, collFormStore:any);
}


declare module "views/analysis/freq" {

    export interface FreqFormViews {
        FrequencyForm: React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            layoutViews:any, mlFreqStore:any, ttFreqStore:any);
}