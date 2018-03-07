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
        selected_text_types:TextTypes.ServerCheckedValues;
        bib_mapping:TextTypes.BibMapping;
        has_lemma:{[corpname:string]:boolean};
        tagset_docs:{[corpname:string]:boolean};
    }

    export interface QueryFormArgsResponse extends QueryFormArgs, Kontext.AjaxResponse {}

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
        within:number; // used when switching to an aligned corp without specific query (set to 1)
        has_lemma:boolean;
        tagset_doc:string;
    }

    export interface FilterFormArgsResponse extends FilterFormArgs, Kontext.AjaxResponse {}

    export interface SortFormArgs extends ConcFormArgs {
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
        rlines:string;
    }

    export interface SwitchMainCorpArgs extends ConcFormArgs {
        maincorp:string;
    }

    export interface FirstHitsFormArgs extends ConcFormArgs {
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
        switchmc:{};
    }

    export interface CorpusSwitchResponse extends Kontext.AjaxConcResponse {
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
        menuData:any; // TODO type
        Wposlist:Array<any>; // TODO type
        AttrList:Array<any>; // TODO type
        StructAttrList:Array<any>; // TODO type
        InputLanguages:{[corpname:string]:string};
        ConcFormsArgs:any; // TODO type
        CurrentSubcorp:string;
        SubcorpList:Array<{v:string; n:string}>;
        TextTypesNotes:string;
    }
}


export namespace FreqResultResponse {

    export interface Item {
        Word:Array<{n:string}>;
        pfilter:Array<[string, string]>;
        nfilter:Array<[string, string]>;
        fbar:number;
        freqbar:number;
        rel:number;
        relbar:number;
        freq:number;
        nbar:number;
        norm:number;
        norel:number; // 0|1 (TODO bool?)
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

    export interface FreqResultResponse extends Kontext.AjaxConcResponse {
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

    export type CTFreqResultItem = [string, string, number, number];

    export interface CTFreqResultData {
        data: Array<CTFreqResultItem>;
        full_size:number;
    }

    export interface CTFreqResultResponse extends Kontext.AjaxConcResponse {
        data:CTFreqResultData;
        attr1:string;
        attr2:string;
        ctfreq_form_args:{
            ctattr1:string;
            ctattr2:string;
            ctfcrit1:string;
            ctfcrit2:string;
            ctminfreq:string
        };
    }


}