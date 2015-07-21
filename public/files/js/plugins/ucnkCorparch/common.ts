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

/**
 * Generalized corplist item which may refer to a single
 * corpus, subcorpus, corpus with aligned corpora.
 */
export interface CorplistItem {
    id?: string;
    name: string;
    type: string;
    corpus_id: string;
    canonical_id: string;
    subcorpus_id: string;
    corpora: Array<string>;
    description: string;
    featured: Favorite;
    user_item: boolean;
    size: number;
    /**
     * A simplified/human readable version of size.
     * E.g. if the size is 1,200,000 then the size_info is '1M'
     */
    size_info: string;
    user_access: boolean;
}

/**
 * A factory for CorplistItem
 */
export function createEmptyCorplistItem():CorplistItem {
    return {
        id: null, name: null, type: null, corpus_id: null, canonical_id: null,
        subcorpus_id: null, corpora: null, description: null, featured: null,
        size: null, size_info: null, user_item: null, user_access: null
    }
}


