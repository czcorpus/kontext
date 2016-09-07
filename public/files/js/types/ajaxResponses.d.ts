/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

declare module AjaxResponse {

    export interface CitationInfo {

        article_ref:Array<string>;

        default_ref:string;

        other_bibliography:string;
    }

    export interface CorpusInfo extends Kontext.AjaxResponse {

        attrlist:Array<{name:string; size:string}>;

        citation_info:CitationInfo;

        corpname:string;

        description:string;

        size:string; // formatted number

        web_url:string;
    }

    export interface WithinMaxHits extends Kontext.AjaxResponse {
        total:number;
    }

    export interface ServerSubcorpListItem {
        deleted:boolean;
        usesubcorp:string;
        created:number;
        cql:string;
        human_corpname:string;
        corpname:string;
        size:number;
        name:string;
    }

    export interface SubcorpList extends Kontext.AjaxResponse {
        SubcorpList:Array<any>; // TODO - do we need this?
        subcorp_list:Array<ServerSubcorpListItem>;
        filter:{[k:string]:any};
        sort_key:{name:string; reverse:boolean};
        related_corpora:Array<string>,
        unfinished_subc:Array<Kontext.AsyncTaskInfo>;
    }

    export interface CreateSubcorpus extends Kontext.AjaxResponse {
        unfinished_subc:Array<Kontext.AsyncTaskInfo>;
    }

}