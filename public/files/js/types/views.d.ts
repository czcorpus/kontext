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
/// <reference path="../vendor.d.ts/react.d.ts" />
/// <reference path="../vendor.d.ts/flux.d.ts" />


declare interface CommonViews {
    SaveFormatSelect:React.ReactClass;
}


declare module "views/document" {
    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            storeProvider:any):Kontext.LayoutViews;
}

declare module "views/common" {

    export interface CommonViews {
        SaveFormatSelect:React.ReactClass;
    }

    export function init(utils:any):CommonViews;
}


declare module "views/concordance/lineSelection" {

    export interface LineSelectionViews {
        LineSelectionMenu:React.ReactClass;
        LockedLineGroupsMenu:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            lineSelectionStore:any, userInfoStore:any):LineSelectionViews;
}

declare module "views/concordance/lineExtras" {

    export interface LineExtrasViews {
        AudioLink:React.ReactClass;
        TdLineSelection:React.ReactClass;
        SyntaxTreeButton:React.ReactClass;
        RefInfo:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, helpers:Kontext.ComponentHelpers);
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

declare module "views/concordance/save" {

    export interface ConcSaveViews {
        ConcSaveForm: React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any, layoutViews:Kontext.LayoutViews,
            concSaveStore:Kontext.PageStore):ConcSaveViews;
}

declare module "views/subcorp/forms" {

    export interface SubcorpFormViews {
        SubcorpForm:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            layoutViews:Kontext.LayoutViews, corparchComponent:React.ReactClass,
            subcorpFormStore:any, subcorpWithinFormStore:any):SubcorpFormViews;
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


declare module "views/query/main" {

    export interface QueryFormViews {
        QueryForm:React.ReactClass;
        QueryFormLite:React.ReactClass;
    }

    export function init(
            dispatcher:Kontext.FluxDispatcher,
            mixins:any,
            layoutViews:Kontext.LayoutViews,
            CorparchWidget:React.Component,
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
            queryReplayStore:Kontext.PageStore,
            mainMenuStore:Kontext.PageStore,
            saveAsFormStore:Kontext.PageStore):QueryToolbarViews;
}


declare module "views/query/history" {

    export interface RecentQueriesPageViews {
        RecentQueriesPageList:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, utils:any,
                    layoutViews:Kontext.LayoutViews, queryHistoryStore:any):RecentQueriesPageViews;
}


declare module "views/query/save" {

    export interface QuerySaveViews {
        QuerySaveAsForm:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, helpers:any,
                    layoutViews:Kontext.LayoutViews, saveAsFormStore:Kontext.PageStore);
}


declare module "views/wordlist/save" {

    export interface WordlistSaveViews {
        WordlistSaveForm:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher,
            mixins:any, layoutViews:Kontext.LayoutViews, commonViews:any, wordlistSaveStore:any):WordlistSaveViews;
}


declare module "views/wordlist/form" {

    export interface WordlistFormViews {
        WordListForm:React.ReactClass;
        CorpInfoToolbar:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher,
            mixins:any, layoutViews:Kontext.LayoutViews, CorparchWidget:React.Component,
            wordlistFormStore:any):WordlistFormViews;
}

declare module "views/wordlist/result" {

    export interface WordlistResultViews {
        WordlistResult:React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            layoutViews:Kontext.LayoutViews, wordlistSaveViews:any, wordlistResultStore:any):WordlistResultViews;

}


declare module "views/options/structsAttrs" {

    export interface StructsAndAttrsViews {
        StructAttrsViewOptions: React.ReactClass;
    }

    export function init(
            dispatcher:Kontext.FluxDispatcher,
            helpers:Kontext.ComponentHelpers,
            layoutViews:Kontext.LayoutViews,
            corpViewOptionsStore:ViewOptions.ICorpViewOptionsStore,
            mainMenustore:Kontext.PageStore):StructsAndAttrsViews;
}


declare module "views/options/general" {

    export interface GeneralOptionsViews {
        GeneralOptions:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        helpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        generalOptionsStore:ViewOptions.IGeneralViewOptionsStore
    ):GeneralOptionsViews;
}


declare module "views/options/main" {

    export interface OptionsContainerViews {
        OptionsContainer:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        helpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        generalOptionsStore:ViewOptions.IGeneralViewOptionsStore,
        corpViewOptionsStore:ViewOptions.ICorpViewOptionsStore,
        mainMenuStore:Kontext.PageStore
    ):OptionsContainerViews;
}


declare module "views/overview" {

    export interface OverviewViews {
        OverviewArea: React.ReactClass;
        CorpusInfoBox: React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            corpusInfoStore:Kontext.PageStore, popupBoxComponent:React.ReactClass):OverviewViews;
}


declare module "views/analysis" {

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


declare module "views/coll/forms" {

    export interface CollFormViews {
        CollForm: React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            layoutViews:any, collFormStore:any);
}


declare module "views/coll/result" {

    export interface CollResultView {
        CollResultView: React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any, layoutViews:any,
            collFormStore:any);
}


declare module "views/freqs/forms" {

    export interface FreqFormViews {
        FrequencyForm: React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any,
            layoutViews:any, mlFreqStore:any, ttFreqStore:any, ctFreqStore:any, ctFlatFreqStore:any);
}


declare module "views/freqs/dataRows" {

    export interface FreqsDataRowsViews {
        DataTable: React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any, freqDataRowsStore:any);
}


declare module "views/freqs/main" {

    export interface FreqsResultViews {
        FreqResultView: React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any, freqDataRowsStore:any,
            layoutViews:any):FreqsResultViews;
}

declare module "views/freqs/save" {

    export interface SaveFreqFormViews {
        SaveFreqForm: React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any, layoutViews:any,
            collSaveStore:any):SaveFreqFormViews;
}


declare module "views/freqs/ctResult" {

    export interface CTFreqsResultViews {
        CTFreqResultView: React.ReactClass;
    }

    export function init(dispatcher:Kontext.FluxDispatcher, mixins:any, layoutViews:any,
            ctFreqDataRowsStore:any, ctFlatFreqDataRowsStore:any):CTFreqsResultViews;
}