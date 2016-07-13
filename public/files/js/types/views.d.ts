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


declare module "views/document" {
    export function init(dispatcher:any, mixins:any, storeProvider:any):Kontext.LayoutViews;
}


declare module "views/concordance/lineSelection" {

    export interface LineSelectionViews {
        LineSelectionMenu:any;
        LockedLineGroupsMenu:any;
    }

    export function init(dispatcher:any, mixins:any, lineSelectionStore:any, userInfoStore:any):LineSelectionViews;
}


declare module "views/concordance/lines" {

    export interface ConcLinesViews {
        ConcLines:any;
    }

    export function init(dispatcher:any, mixins:any, lineStore:any, lineSelectionStore:any):ConcLinesViews;
}


declare module "views/concordance/paginator" {

    export interface PaginatorViews {
        Paginator:any;
    }

    export function init(dispatcher:any, mixins:any, lineStore:any):PaginatorViews;
}

declare module "views/concordance/main" {

    export interface ConcordanceView {
        ConcordanceView:any;
    }

    export function init(dispatcher:any, mixins:any, lineStore:any, lineSelectionStore:any, userInfoStore:any,
            layoutViews:Kontext.LayoutViews):ConcordanceView;
}


declare module "views/subcorpForm" {

    export interface SubcorpFormViews {
        WithinBuilder:any;
    }

    export function init(dispatcher:any, mixins:any, subcorpFormStore:any):SubcorpFormViews;
}



declare module "views/textTypes" {

    export interface TextTypesViews {
        TextTypesPanel:any;
    }

    export function init(dispatcher:any, mixins:any, textTypesStore:any):TextTypesViews;

}


declare module "views/query/context" {

    export interface QueryContextViews {
        SpecifyContextForm:any;
    }

    export function init(dispatcher, mixins):QueryContextViews;
}
