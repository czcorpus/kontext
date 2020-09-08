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

import {Kontext, TextTypes} from '../types/common';
import { AjaxConcResponse, ConcQuickFilterServerArgs } from '../models/concordance/common';
import { QueryType } from '../models/query/common';

// TODO !! this should be broken and moved into respective modules

export namespace AjaxResponse {

    export interface CitationInfo {

        article_ref:Array<string>;

        default_ref:string;

        other_bibliography:string;
    }

    export interface WithinMaxHits extends Kontext.AjaxResponse {
        total:number;
    }

    export interface ServerSubcorpListItem {
        deleted:boolean;
        usesubcorp:string;
        orig_subcname:string;
        created:number;
        cql:string;
        human_corpname:string;
        corpname:string;
        size:number;
        name:string;
        published:boolean;
        description:string;
    }

    export interface SubcorpList extends Kontext.AjaxResponse {
        SubcorpList:Array<any>; // TODO - do we need this?
        subcorp_list:Array<ServerSubcorpListItem>;
        filter:{[k:string]:any};
        sort_key:{name:string; reverse:boolean};
        related_corpora:Array<string>,
        processed_subc:Array<Kontext.AsyncTaskInfo>;
    }

    export interface CreateSubcorpus extends Kontext.AjaxResponse {
        processed_subc:Array<Kontext.AsyncTaskInfo>;
    }

    export interface ConcStatus extends Kontext.AjaxResponse {
        relconcsize:number;
        concsize:number;
        finished:boolean;
        fullsize:number;

        /**
         * ARF metrics; please note that this value
         * is non-empty only once the status has
         * finished = true (i.e. the result is complete)
         */
        arf:number;
    }

    export interface QueryHistory extends Kontext.AjaxResponse {
        data:Array<Kontext.QueryHistoryItem>;
        limit:number;
        offset:number;
    }

    export interface WideCtx extends Kontext.AjaxResponse {
        content:Array<{class:string; str:string}>;
        expand_left_args:{
            pos:number;
            hitlen:number;
            detail_left_ctx:number;
            detail_right_ctx:number
        };
        expand_right_args:{
            pos:number;
            hitlen:number;
            detail_left_ctx:number;
            detail_right_ctx:number
        };
    }

    export interface FullRef extends Kontext.AjaxResponse {
        Refs:Array<{name:string; val:string}>;
    }

    export interface ConcFormArgs {
        form_type:Kontext.ConcFormTypes;
        op_key:string; // an ID used by conc_persistence
    }

    export interface QueryFormArgs extends ConcFormArgs {
        form_type:Kontext.ConcFormTypes.QUERY|Kontext.ConcFormTypes.LOCKED;
        curr_query_types:{[corpname:string]:QueryType};
        curr_queries:{[corpname:string]:string};
        curr_pcq_pos_neg_values:{[corpname:string]:'pos'|'neg'};
        curr_lpos_values:{[corpname:string]:string};
        curr_qmcase_values:{[corpname:string]:boolean};
        curr_default_attr_values:{[corpname:string]:string};
        curr_include_empty_values:{[corpname:string]:boolean};
        tag_builder_support:{[corpname:string]:boolean};
        selected_text_types:TextTypes.ServerCheckedValues;
        bib_mapping:TextTypes.BibMapping;
        has_lemma:{[corpname:string]:boolean};
        tagset_docs:{[corpname:string]:string};
    }

    export function isQueryFormArgs(args:ConcFormArgs):args is QueryFormArgs {
        return args['curr_query_types'] !== undefined && args['curr_queries'] !== undefined;
    }

    export interface QueryFormArgsResponse extends QueryFormArgs, Kontext.AjaxResponse {}

    export interface FilterFormArgs extends ConcFormArgs {
        form_type:Kontext.ConcFormTypes.FILTER|Kontext.ConcFormTypes.LOCKED;
        query_type:QueryType;
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
        within:boolean; // used when switching to an aligned corp without specific query (true)
        has_lemma:boolean;
        tagset_doc:string;
    }

    export function isFilterFormArgs(args:ConcFormArgs):args is FilterFormArgs {
        return args['query_type'] !== undefined && args['pnfilter'] !== undefined &&
                args['filfl'] !== undefined;
    }

    export interface FilterFormArgsResponse extends FilterFormArgs, Kontext.AjaxResponse {}

    export interface SortFormArgs extends ConcFormArgs {
        form_type:Kontext.ConcFormTypes.SORT|Kontext.ConcFormTypes.LOCKED;
        sattr:string;
        skey:string;
        spos:string;
        sicase:string;
        sbward:string;
        sortlevel:number;
        form_action:string;
        ml1icase:string;
        ml2icase:string;
        ml3icase:string;
        ml4icase:string;
        ml1bward:string;
        ml2bward:string;
        ml3bward:string;
        ml4bward:string;
        ml1pos:number;
        ml2pos:number;
        ml3pos:number;
        ml4pos:number;
        ml1ctx:string;
        ml2ctx:string;
        ml3ctx:string;
        ml4ctx:string;
    }

    export interface SortFormArgsResponse extends SortFormArgs, Kontext.AjaxResponse {}

    export interface BranchQuery extends Kontext.AjaxResponse {
        ops:Array<{id:string; form_args:any}>;
    }

    export interface SampleFormArgs extends ConcFormArgs {
        form_type:Kontext.ConcFormTypes.SAMPLE|Kontext.ConcFormTypes.LOCKED;
        rlines:string;
    }

    export interface SwitchMainCorpArgs extends ConcFormArgs {
        form_type:Kontext.ConcFormTypes.SWITCHMC|Kontext.ConcFormTypes.LOCKED;
        maincorp:string;
    }

    export interface FirstHitsFormArgs extends ConcFormArgs {
        form_type:Kontext.ConcFormTypes.FIRSTHITS|Kontext.ConcFormTypes.LOCKED;
        doc_struct:string;
    }

    export interface SampleFormArgsResponse extends SampleFormArgs, Kontext.AjaxResponse {}

    export interface ConcFormArgsResponse extends Kontext.AjaxResponse, ConcFormArgs {}

    export interface ConcFormsInitialArgs {
        query:QueryFormArgs;
        filter:FilterFormArgs;
        sort:SortFormArgs;
        sample:SampleFormArgs;
        firsthits:FirstHitsFormArgs;
        switchmc:SwitchMainCorpArgs;
    }

    export interface CorpusSwitchResponse extends AjaxConcResponse {
        corpname:string; // deprecated
        humanCorpname:string; // deprecated
        corpusIdent:Kontext.FullCorpusIdent;
        subcorpname:string;
        baseAttr:string;
        currentArgs:Array<[string, string]>;
        compiledQuery:Array<string>;
        concPersistenceOpId:string;
        alignedCorpora:Array<string>;
        availableAlignedCorpora:Array<Kontext.AttrItem>;
        activePlugins:Array<string>;
        queryOverview:Array<Kontext.QueryOperation>;
        numQueryOps:number;
        textTypesData:any; // TODO type
        structsAndAttrs:Kontext.StructsAndAttrs;
        menuData:any; // TODO type
        Wposlist:Array<any>; // TODO type
        AttrList:Array<any>; // TODO type
        StructAttrList:Array<Kontext.AttrItem>;
        StructList:Array<string>;
        InputLanguages:{[corpname:string]:string};
        ConcFormsArgs:any; // TODO type
        CurrentSubcorp:string;
        SubcorpList:Array<{v:string; n:string}>;
        TextTypesNotes:string;
        TextDirectionRTL:boolean;
        // here it is impossible to determine a detailed type in a reasonable way
        pluginData:{[plgName:string]:any};
        DefaultVirtKeyboard:string;
    }
}


export namespace FreqResultResponse {

    export interface Item {
        Word:Array<{n:string}>;
        pfilter:Array<[keyof ConcQuickFilterServerArgs,
            ConcQuickFilterServerArgs[keyof ConcQuickFilterServerArgs]]>;
        nfilter:Array<[keyof ConcQuickFilterServerArgs,
            ConcQuickFilterServerArgs[keyof ConcQuickFilterServerArgs]]>;
        fbar:number;
        freqbar:number;
        rel:number;
        relbar:number;
        freq:number;
        nbar:number;
        norm:number;
        norel:0|1; // (TODO bool?)
    }

    export interface Header {
        s:string;
        n:string;
    }

    export interface Block {
        TotalPages:number;
        Items:Array<Item>;
        Head:Array<Header>;
        Total:number;
    }

    export interface FreqResultResponse extends AjaxConcResponse {
        Blocks:Array<Block>;
        lastpage:number; // 0|1 TODO type
        paging:number;
        quick_to_line:number; // TODO type?
        quick_from_line:number;
        freq_ipm_warn_enabled:boolean;
        FCrit:Array<{fcrit:string}>;
        fcrit:Array<{fcrit:string}>;
        fmaxitems:number;
        concsize:number;
    }


}