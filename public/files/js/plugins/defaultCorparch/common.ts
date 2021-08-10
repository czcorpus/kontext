/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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


/*
 * Common types and functions used by plug-in objects
 */

/**
 *
 */
export enum Favorite {
    NOT_FAVORITE = 0,
    FAVORITE = 1
}


export interface ServerFavlistItem {
    id:string;
    name:string;
    subcorpus_id:string;
    subcorpus_orig_id:string;
    size:number;
    size_info:string;
    corpora:Array<{id:string; name:string}>;
    description:string;
}

export interface GeneratedFavListItem {
    subcorpus_id:string;
    subcorpus_orig_id:string;
    corpora:Array<string>;
}

/**
 * Generalized corplist item which may refer to a single
 * corpus, subcorpus, corpus with aligned corpora.
 */
export interface CorplistItem {
    id?:string;
    name:string;
    corpus_id:string;
    subcorpus_id:string;
    corpora:Array<string>;
    description:string;
    size:number;
    /**
     * A simplified/human readable version of size.
     * E.g. if the size is 1,200,000 then the size_info is '1M'
     */
    size_info:string;
    fav_id:string;
    featured:boolean;
    keywords:Array<[string, string]>;
}


export interface Filters {
    maxSize:string;
    minSize:string;
    name:string;
    query?:string;
}

export interface CorplistDataResponse extends Kontext.AjaxResponse {
    nextOffset:number;
    current_keywords:Array<string>;
    filters:Filters;
    keywords:Array<string>;
    rows:Array<CorplistItem>;
}




