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

import * as Kontext from '../../types/kontext';
import * as TextTypes from '../../types/textTypes';
import * as PluginInterfaces from '../../types/plugins';
import { CtxLemwordType } from './common';
import { QueryType } from './query';


export interface ConcFormArgs {
    form_type:Kontext.ConcFormTypes;
    op_key:string; // an ID used by conc_persistence
}

/**
 * array of
 *   tuple (
 *      arg conjunction
 *          with items either
 *              arg1 == val1
 *          or (arg1a == val1 | arg1b == val1 |...|arg1N == val1)
 *      true if extended else false
 *   )
 */
export type SubmitEncodedSimpleTokens = Array<[Array<[string|Array<string>, string]>, boolean]>;

/**
 *
 */
export interface QueryFormArgs extends ConcFormArgs {
    form_type:Kontext.ConcFormTypes.QUERY|Kontext.ConcFormTypes.LOCKED;
    curr_query_types:{[corpname:string]:QueryType};
    curr_queries:{[corpname:string]:string};
    curr_parsed_queries:{[corpname:string]:SubmitEncodedSimpleTokens};
    curr_pcq_pos_neg_values:{[corpname:string]:'pos'|'neg'};
    curr_lpos_values:{[corpname:string]:string};
    curr_qmcase_values:{[corpname:string]:boolean};
    curr_default_attr_values:{[corpname:string]:string};
    curr_use_regexp_values:{[corpname:string]:boolean};
    curr_include_empty_values:{[corpname:string]:boolean};
    tagsets:{[corpname:string]:Array<PluginInterfaces.TagHelper.TagsetInfo>};
    selected_text_types:TextTypes.ExportedSelection;
    bib_mapping:TextTypes.BibMapping;
    has_lemma:{[corpname:string]:boolean};
    fc_lemword_type:CtxLemwordType;
    fc_lemword_wsize:[number, number];
    fc_lemword:string;
    fc_pos_type:CtxLemwordType;
    fc_pos_wsize:[number, number];
    fc_pos:Array<string>;
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
    pnfilter:'p'|'n';
    filfl:'f'|'l';
    filfpos:string;
    filtpos:string;
    inclkwic:boolean;
    qmcase:boolean;
    default_attr:string;
    use_regexp:boolean;
    tagsets:Array<PluginInterfaces.TagHelper.TagsetInfo>;
    lpos:string;
    within:boolean; // used when switching to an aligned corp without specific query (true)
    has_lemma:boolean;
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


