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
    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        storeProvider:any // TODO type
    ):Kontext.LayoutViews;
}

declare module "views/common" {

    export interface CommonViews {
        SaveFormatSelect:React.ReactClass;
    }

    export function init(componentHelpers:Kontext.ComponentHelpers):CommonViews;
}


declare module "views/concordance/lineSelection" {

    export interface LineSelectionViews {
        LineBinarySelectionMenu:React.ReactClass;
        LockedLineGroupsMenu:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        lineSelectionStore:Kontext.PageStore
    ):LineSelectionViews;
}

declare module "views/concordance/lineExtras" {

    export interface LineExtrasViews {
        AudioLink:React.ReactClass;
        TdLineSelection:React.ReactClass;
        SyntaxTreeButton:React.ReactClass;
        RefInfo:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers
    );
}


declare module "views/concordance/lines" {

    export interface ConcLinesViews {
        ConcLines:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        lineStore:Kontext.PageStore,
        lineSelectionStore:Kontext.PageStore
    ):ConcLinesViews;
}


declare module "views/concordance/paginator" {

    export interface PaginatorViews {
        Paginator:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        lineStore:Kontext.PageStore
    ):PaginatorViews;
}

declare module "views/concordance/main" {

    export interface ConcordanceView {
        ConcordanceView:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        stores:any // TODO type
    ):ConcordanceView;
}

declare module "views/concordance/detail" {

    export interface RefDetail {
        RefDetail: React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        concDetailStore:Kontext.PageStore
    ):RefDetail;
}

declare module "views/concordance/save" {

    export interface ConcSaveViews {
        ConcSaveForm: React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        concSaveStore:Kontext.PageStore
    ):ConcSaveViews;
}

declare module "views/subcorp/forms" {

    export interface SubcorpFormViews {
        SubcorpForm:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        corparchComponent:React.ReactClass,
        subcorpFormStore:Kontext.PageStore,
        subcorpWithinFormStore:Kontext.PageStore
    ):SubcorpFormViews;
}


declare module "views/subcorp/list" {

    export interface SubcorpListViews {
        SubcorpList:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        subcorpListStore:Kontext.PageStore
    ):SubcorpListViews;
}


declare module "views/textTypes" {

    export interface TextTypesViews {
        TextTypesPanel:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        textTypesStore:Kontext.PageStore
    ):TextTypesViews;

}


declare module "views/menu" {

    export interface MainMenuViews {
        MainMenu:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        concArgHandler:Kontext.IConcArgsHandler,
        mainMenuStore:Kontext.PageStore,
        asyncTaskStore:Kontext.IAsyncTaskStore,
        layoutViews:Kontext.LayoutViews
    ):MainMenuViews;
}


declare module "views/query/main" {

    export interface QueryFormViews {
        QueryForm:React.ReactClass;
        QueryFormLite:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        CorparchWidget:React.Component,
        queryStore:Kontext.PageStore,
        textTypesStore:Kontext.PageStore,
        queryHintStore:Kontext.PageStore,
        withinBuilderStore:Kontext.PageStore,
        virtualKeyboardStore:Kontext.PageStore,
        queryContextStore:Kontext.PageStore
    ):QueryFormViews;
}


declare module "views/query/aligned" {

    export interface AlignedQueryFormViews {
        AlignedCorpora:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        queryStore:Kontext.PageStore,
        queryHintStore:Kontext.PageStore,
        withinBuilderStore:Kontext.PageStore,
        virtualKeyboardStore:Kontext.PageStore
    ):AlignedQueryFormViews;
}


declare module "views/query/context" {

    export interface QueryContextViews {
        SpecifyContextForm:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers
    ):QueryContextViews;
}


declare module "views/query/filter" {

    export interface FilterFormViews {
        FilterForm:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        filterStore:Kontext.PageStore,
        queryHintStore:Kontext.PageStore,
        withinBuilderStore:Kontext.PageStore,
        virtualKeyboardStore:Kontext.PageStore
    ):FilterFormViews;

}

declare module "views/query/sort" {

    export interface SortFormViews {
        SortFormView:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        sortStore:Kontext.PageStore,
        multiLevelSortStore:Kontext.PageStore
    ):SortFormViews;
}


declare module "views/query/sampleShuffle" {

    export interface SampleFormViews {
        SampleFormView:React.ReactClass;
        ShuffleFormView:React.ReactClass;
        SwitchMainCorpFormView:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        sampleStore:Kontext.PageStore,
        switchMcStore:Kontext.PageStore
    ):SampleFormViews;
}


declare module "views/query/overview" {

    export interface QueryToolbarViewDeps {
        QueryFormView:React.ReactClass;
        FilterFormView:React.ReactClass;
        SortFormView:React.ReactClass;
        SampleFormView:React.ReactClass;
        ShuffleFormView:React.ReactClass;
        SwitchMainCorpFormView:React.ReactClass;
    }

    export interface QueryToolbarViews {
        QueryToolbar:React.ReactClass;
        NonViewPageQueryToolbar:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        viewDeps:QueryToolbarViewDeps,
        queryReplayStore:Kontext.PageStore,
        mainMenuStore:Kontext.PageStore,
        saveAsFormStore:Kontext.PageStore
    ):QueryToolbarViews;
}


declare module "views/query/history" {

    export interface RecentQueriesPageViews {
        RecentQueriesPageList:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        queryHistoryStore:Kontext.PageStore
    ):RecentQueriesPageViews;
}


declare module "views/query/save" {

    export interface QuerySaveViews {
        QuerySaveAsForm:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        saveAsFormStore:Kontext.PageStore
    ):QuerySaveViews;
}


declare module "views/wordlist/save" {

    export interface WordlistSaveViews {
        WordlistSaveForm:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        commonViews:CommonViews,
        wordlistSaveStore:Kontext.PageStore
    ):WordlistSaveViews;
}


declare module "views/wordlist/form" {

    export interface WordlistFormViews {
        WordListForm:React.ReactClass;
        CorpInfoToolbar:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        CorparchWidget:React.Component,
        wordlistFormStore:Kontext.PageStore
    ):WordlistFormViews;
}

declare module "views/wordlist/result" {

    export interface WordlistResultViews {
        WordlistResult:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        wordlistSaveViews:any, // TODO type
        wordlistResultStore:Kontext.PageStore
    ):WordlistResultViews;
}


declare module "views/options/structsAttrs" {

    export interface StructsAndAttrsViews {
        StructAttrsViewOptions: React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        corpViewOptionsStore:ViewOptions.ICorpViewOptionsStore,
        mainMenustore:Kontext.PageStore
    ):StructsAndAttrsViews;
}


declare module "views/options/general" {

    export interface GeneralOptionsViews {
        GeneralOptions:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
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
        componentHelpers:Kontext.ComponentHelpers,
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

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        corpusInfoStore:Kontext.PageStore
    ):OverviewViews;
}


declare module "views/analysis" {

    export interface AnalysisFrameViews {
        AnalysisFrame:React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        collFormViews:any, // TODO type
        freqFormViews:any, // TODO type
        mainMenuStore:Kontext.PageStore
    ):AnalysisFrameViews;
}


declare module "views/coll/forms" {

    export interface CollFormViews {
        CollForm: React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        collFormStore:Kontext.PageStore
    ):CollFormViews;
}


declare module "views/coll/result" {

    export interface CollResultView {
        CollResultView: React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        collFormStore:Kontext.PageStore
    ):CollResultView;
}


declare module "views/freqs/forms" {

    export interface FreqFormViews {
        FrequencyForm: React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        mlFreqStore:Kontext.PageStore,
        ttFreqStore:Kontext.PageStore,
        ctFreqStore:Kontext.PageStore,
        ctFlatFreqStore:Kontext.PageStore
    ):FreqFormViews;
}


declare module "views/freqs/dataRows" {

    export interface FreqsDataRowsViews {
        DataTable: React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        freqDataRowsStore:Kontext.PageStore
    );
}


declare module "views/freqs/main" {

    export interface FreqsResultViews {
        FreqResultView: React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        freqDataRowsStore:Kontext.PageStore,
        layoutViews:Kontext.LayoutViews
    ):FreqsResultViews;
}

declare module "views/freqs/save" {

    export interface SaveFreqFormViews {
        SaveFreqForm: React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        collSaveStore:Kontext.PageStore
    ):SaveFreqFormViews;
}


declare module "views/freqs/ctResult" {

    export interface CTFreqsResultViews {
        CTFreqResultView: React.ReactClass;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        ctFreqDataRowsStore:Kontext.PageStore,
        ctFlatFreqDataRowsStore:Kontext.PageStore
    ):CTFreqsResultViews;
}