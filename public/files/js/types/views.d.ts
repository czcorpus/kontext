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

