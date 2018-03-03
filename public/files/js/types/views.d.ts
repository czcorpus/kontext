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

declare module "views/concordance/lineSelection" {

    export interface LineSelectionViews {
        LineBinarySelectionMenu:React.ComponentClass;
        LockedLineGroupsMenu:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        lineSelectionModel:Kontext.EventEmitter
    ):LineSelectionViews;
}

declare module "views/concordance/lineExtras" {

    export interface LineExtrasViews {
        AudioLink:React.ComponentClass;
        TdLineSelection:React.ComponentClass;
        SyntaxTreeButton:React.ComponentClass;
        RefInfo:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        lineModel:Kontext.EventEmitter
    );
}


declare module "views/concordance/lines" {

    export interface ConcLinesViews {
        ConcLines:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        lineModel:Kontext.EventEmitter,
        lineSelectionModel:Kontext.EventEmitter,
        concDetailModel:Kontext.EventEmitter
    ):ConcLinesViews;
}


declare module "views/concordance/paginator" {

    export interface PaginatorViews {
        Paginator:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        lineModel:Kontext.EventEmitter
    ):PaginatorViews;
}

declare module "views/concordance/main" {

    export interface ConcordanceViews {
        ConcordanceDashboard:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        models:any // TODO type
    ):ConcordanceViews;
}

declare module "views/concordance/detail" {

    export interface RefDetail {
        RefDetail:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        concDetailModel:Kontext.EventEmitter,
        refsDetailModel:Kontext.EventEmitter,
        lineModel:Kontext.EventEmitter
    ):RefDetail;
}

declare module "views/concordance/save" {

    export interface ConcSaveViews {
        ConcSaveForm:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        concSaveModel:Kontext.EventEmitter
    ):ConcSaveViews;
}

declare module "views/subcorp/forms" {

    export interface SubcorpFormViews {
        SubcorpForm:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        corparchComponent:React.ComponentClass,
        subcorpFormModel:Kontext.EventEmitter,
        subcorpWithinFormModel:Kontext.EventEmitter
    ):SubcorpFormViews;
}


declare module "views/subcorp/list" {

    export interface SubcorpListViews {
        SubcorpList:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        subcorpListModel:Kontext.EventEmitter
    ):SubcorpListViews;
}


declare module "views/textTypes" {

    export interface TextTypesViews {
        TextTypesPanel:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        textTypesModel:Kontext.EventEmitter
    ):TextTypesViews;

}


declare module "views/menu" {

    export interface MainMenuViews {
        MainMenu:React.ComponentClass|React.SFC;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        concArgHandler:Kontext.IConcArgsHandler,
        mainMenuModel:Kontext.EventEmitter,
        asyncTaskModel:Kontext.IAsyncTaskModel,
        layoutViews:Kontext.LayoutViews
    ):MainMenuViews;
}


declare module "views/query/main" {

    export interface QueryFormViews {
        QueryForm:React.ComponentClass;
        QueryFormLite:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        CorparchWidget:React.ComponentClass,
        queryModel:Kontext.EventEmitter,
        textTypesModel:Kontext.EventEmitter,
        queryHintModel:Kontext.EventEmitter,
        withinBuilderModel:Kontext.EventEmitter,
        virtualKeyboardModel:Kontext.EventEmitter,
        queryContextModel:Kontext.EventEmitter,
        cqlEditorModel:any // TODO
    ):QueryFormViews;
}


declare module "views/query/aligned" {

    export interface AlignedQueryFormViews {
        AlignedCorpora:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        queryModel:Kontext.EventEmitter,
        queryHintModel:Kontext.EventEmitter,
        withinBuilderModel:Kontext.EventEmitter,
        virtualKeyboardModel:Kontext.EventEmitter,
        cqlEditorModel:Kontext.EventEmitter
    ):AlignedQueryFormViews;
}


declare module "views/query/context" {

    export interface QueryContextViews {
        SpecifyContextForm:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers
    ):QueryContextViews;
}

declare module "views/query/sort" {

    export interface SortFormViews {
        SortFormView:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        sortModel:Kontext.EventEmitter,
        multiLevelConcSortModel:Kontext.EventEmitter
    ):SortFormViews;
}

declare module "views/query/basicOverview" {

    export interface BasicQueryOverviewViews {
        EmptyQueryOverviewBar:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
    ):BasicQueryOverviewViews;
}


declare module "views/query/overview" {

    export interface QueryToolbarViewDeps {
        QueryFormView:React.ComponentClass;
        FilterFormView:React.ComponentClass;
        SubHitsForm:React.ComponentClass;
        FirstHitsForm:React.ComponentClass;
        SortFormView:React.ComponentClass;
        SampleForm:React.ComponentClass;
        ShuffleForm:React.ComponentClass;
        SwitchMainCorpForm:React.ComponentClass;
    }

    export interface QueryToolbarViews {
        QueryToolbar:React.ComponentClass;
        NonViewPageQueryToolbar:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        viewDeps:QueryToolbarViewDeps,
        queryReplayModel:Kontext.EventEmitter,
        mainMenuModel:Kontext.EventEmitter,
        saveAsFormModel:Kontext.EventEmitter
    ):QueryToolbarViews;
}


declare module "views/query/history" {

    export interface RecentQueriesPageViews {
        RecentQueriesPageList:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        queryHistoryModel:Kontext.EventEmitter
    ):RecentQueriesPageViews;
}


declare module "views/query/save" {

    export interface QuerySaveViews {
        QuerySaveAsForm:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        saveAsFormModel:Kontext.EventEmitter
    ):QuerySaveViews;
}


declare module "views/options/structsAttrs" {

    export interface StructsAndAttrsViews {
        StructAttrsViewOptions:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        corpViewOptionsModel:ViewOptions.ICorpViewOptionsModel,
        mainMenuModel:Kontext.EventEmitter
    ):StructsAndAttrsViews;
}


declare module "views/options/general" {

    export interface GeneralOptionsViews {
        GeneralOptions:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        generalOptionsModel:ViewOptions.IGeneralViewOptionsModel
    ):GeneralOptionsViews;
}


declare module "views/options/main" {

    export interface OptionsContainerViews {
        OptionsContainer:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        generalOptionsModel:ViewOptions.IGeneralViewOptionsModel,
        corpViewOptionsModel:ViewOptions.ICorpViewOptionsModel,
        mainMenuModel:Kontext.EventEmitter
    ):OptionsContainerViews;
}


declare module "views/overview" {

    export interface OverviewViews {
        OverviewArea:React.ComponentClass;
        CorpusInfoBox:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        corpusInfoModel:Kontext.EventEmitter
    ):OverviewViews;
}


declare module "views/analysis" {

    export interface AnalysisFrameViews {
        AnalysisFrame:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        collFormViews:any, // TODO type
        freqFormViews:any, // TODO type
        mainMenuModel:Kontext.EventEmitter
    ):AnalysisFrameViews;
}


declare module "views/coll/forms" {

    export interface CollFormViews {
        CollForm:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        collFormModel:Kontext.EventEmitter
    ):CollFormViews;
}


declare module "views/coll/result" {

    export interface CollResultView {
        CollResultView:React.ComponentClass;
    }

    export function init(
        dispatcher:Kontext.ActionDispatcher,
        componentHelpers:Kontext.ComponentHelpers,
        layoutViews:Kontext.LayoutViews,
        collFormModel:Kontext.EventEmitter
    ):CollResultView;
}
