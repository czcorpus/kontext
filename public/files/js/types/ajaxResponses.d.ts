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

    export interface ConcStatus extends Kontext.AjaxResponse {
        end:any; // TODO
        relconcsize:number;
        concsize:number;
        finished:boolean;
        fullsize:number;
    }


    export interface QueryHistoryItem {
        corpname:string;
        humanCorpname:string;
        created:[string,string]; // date string and time string
        details:string;
        query:string;
        query_form_url:string;
        query_type:string;
        query_type_translated:string;
        subcorpname:string;
        params:{[key:string]:any}
    }

    export interface QueryHistory extends Kontext.AjaxResponse {
        data:Array<QueryHistoryItem>;
        limit:number;
        offset:number;
    }

    export interface WideCtx extends Kontext.AjaxResponse {
        content:Array<{class:string; str:string}>;
        expand_left_args:{pos:number; hitlen:number; detail_left_ctx:number; detail_right_ctx:number};
        expand_right_args:{pos:number; hitlen:number; detail_left_ctx:number; detail_right_ctx:number};
    }

    export interface FullRef extends Kontext.AjaxResponse {
        Refs:Array<{name:string; val:string}>;
    }

    export interface WithinBuilderData extends Kontext.AjaxResponse {
        structattrs:{[attr:string]:Array<string>};
    }


    export interface ConcFormArgs {
        form_type:string;
        op_key:string; // an ID used by conc_persistence
    }

    export interface QueryFormArgs extends ConcFormArgs {
        curr_query_types:{[corpname:string]:string};
        curr_queries:{[corpname:string]:string};
        curr_pcq_pos_neg_values:{[corpname:string]:string};
        curr_lpos_values:{[corpname:string]:string};
        curr_qmcase_values:{[corpname:string]:boolean};
        curr_default_attr_values:{[corpname:string]:string};
        tag_builder_support:{[corpname:string]:boolean};
    }

    export interface FilterFormArgs extends ConcFormArgs {
        query_type:string;
        query:string;
        maincorp:string;
        pnfilter:string;
        filfl:string;
        filfpos:string;
        filtpos:string;
        inclkwic:boolean;
        qmcase:boolean;
        default_attr_value:string;
        tag_builder_support:boolean;
        lpos:string;
    }

    export interface SortFormArgs extends ConcFormArgs {
        sattr:string;
        skey:string;
        spos:string;
        sicase:string;
        sbward:string;
    }

    export interface BranchQuery extends Kontext.AjaxResponse {
        ops:Array<{id:string; form_args:any}>;
    }

}