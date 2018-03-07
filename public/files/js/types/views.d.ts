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

