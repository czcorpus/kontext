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
    SaveFormatSelect:React.Component;
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
        SaveFormatSelect:React.Component;
    }

    export function init(componentHelpers:Kontext.ComponentHelpers):CommonViews;
}


declare module "views/concordance/lineSelection" {

    export interface LineSelectionViews {
        LineBinarySelectionMenu:React.Component;
        LockedLineGroupsMenu:React.Component;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        lineSelectionStore:Kontext.PageStore
    ):LineSelectionViews;
}

declare module "views/concordance/lineExtras" {

    export interface LineExtrasViews {
        AudioLink:React.Component;
        TdLineSelection:React.Component;
        SyntaxTreeButton:React.Component;
        RefInfo:React.Component;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers
    );
}


declare module "views/concordance/lines" {

    export interface ConcLinesViews {
        ConcLines:React.Component;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        lineStore:Kontext.PageStore,
        lineSelectionStore:Kontext.PageStore,
        concDetailStore:Kontext.PageStore
    ):ConcLinesViews;
}


declare module "views/concordance/paginator" {

    export interface PaginatorViews {
        Paginator:React.Component;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        lineStore:Kontext.PageStore
    ):PaginatorViews;
}

declare module "views/concordance/main" {

    export interface ConcordanceView {
        ConcordanceView:React.Component;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        stores:any // TODO type
    ):ConcordanceView;
}

declare module "views/concordance/detail" {

    export interface RefDetail {
        RefDetail: React.Component;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        concDetailStore:Kontext.PageStore,
        refsDetailStore:Kontext.PageStore,
        lineStore:Kontext.PageStore
    ):RefDetail;
}

declare module "views/concordance/save" {

    export interface ConcSaveViews {
        ConcSaveForm: React.Component;
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
        SubcorpForm:React.Component;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        corparchComponent:React.Component,
        subcorpFormStore:Kontext.PageStore,
        subcorpWithinFormStore:Kontext.PageStore
    ):SubcorpFormViews;
}


declare module "views/subcorp/list" {

    export interface SubcorpListViews {
        SubcorpList:React.Component;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        subcorpListStore:Kontext.PageStore
    ):SubcorpListViews;
}


declare module "views/textTypes" {

    export interface TextTypesViews {
        TextTypesPanel:React.Component;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        textTypesStore:Kontext.PageStore
    ):TextTypesViews;

}


declare module "views/menu" {

    export interface MainMenuViews {
        MainMenu:React.Component;
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
        QueryForm:React.Component;
        QueryFormLite:React.Component;
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
        AlignedCorpora:React.Component;
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
        SpecifyContextForm:React.Component;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers
    ):QueryContextViews;
}


declare module "views/query/filter" {

    export interface FilterFormViews {
        FilterForm:React.Component;
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
        SortFormView:React.Component;
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
        SampleFormView:React.Component;
        ShuffleFormView:React.Component;
        SwitchMainCorpFormView:React.Component;
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
        QueryFormView:React.Component;
        FilterFormView:React.Component;
        SortFormView:React.Component;
        SampleFormView:React.Component;
        ShuffleFormView:React.Component;
        SwitchMainCorpFormView:React.Component;
    }

    export interface QueryToolbarViews {
        QueryToolbar:React.Component;
        NonViewPageQueryToolbar:React.Component;
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
        RecentQueriesPageList:React.Component;
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
        QuerySaveAsForm:React.Component;
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
        WordlistSaveForm:React.Component;
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
        WordListForm:React.Component;
        CorpInfoToolbar:React.Component;
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
        WordlistResult:React.Component;
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
        StructAttrsViewOptions: React.Component;
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
        GeneralOptions:React.Component;
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
        OptionsContainer:React.Component;
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
        OverviewArea: React.Component;
        CorpusInfoBox: React.Component;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        corpusInfoStore:Kontext.PageStore
    ):OverviewViews;
}


declare module "views/analysis" {

    export interface AnalysisFrameViews {
        AnalysisFrame:React.Component;
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
        CollForm: React.Component;
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
        CollResultView: React.Component;
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
        FrequencyForm: React.Component;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        mlFreqStore:Kontext.PageStore,
        ttFreqStore:Kontext.PageStore,
        ctFreqFormStore:Kontext.PageStore
    ):FreqFormViews;
}


declare module "views/freqs/dataRows" {

    export interface FreqsDataRowsViews {
        DataTable: React.Component;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        freqDataRowsStore:Kontext.PageStore
    );
}


declare module "views/freqs/main" {

    export interface FreqsResultViews {
        FreqResultView: React.Component;
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
        SaveFreqForm: React.Component;
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
        CTFreqResultView: React.Component;
    }

    export function init(
        dispatcher:Kontext.FluxDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        ctFreqDataRowsStore:Kontext.PageStore,
        ctFlatFreqDataRowsStore:Kontext.PageStore
    ):CTFreqsResultViews;
}