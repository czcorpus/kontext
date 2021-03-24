/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Kontext, TextTypes } from '../../types/common';
import { QueryFormType } from '../query/actions';
import { QueryType } from '../query/query';


export interface QueryHistoryItem {
    /**
     * An index in list, always respecting offset (i.e. the
     * server can return values starting from i > 0).
     */
    idx:number;

    /**
     * If not null then the item is persistent
     */
    name?:string;

    corpname:string;
    corpus_id:string;
    human_corpname:string;
    /**
     * a UNIX timestamp in seconds
     */
    created:number;
    query:string;

    /**
     * Query with syntax highlighting (using embedded HTML)
     */
    query_sh?:string;
    query_type:QueryType;
    q_supertype:Kontext.QuerySupertype;
    query_id:string;
    subcorpname:string;
    lpos:string;
    qmcase:string;
    pcq_pos_neg:string;
    default_attr:string;

    /**
     * Text type values selected by user in query.
     * In case of configured bibliography structattr,
     * this is little bit more complicated as the values
     * (IDs) are not the ones displayed to user (Titles)
     * - see bib_mapping in this interface.
     */
    selected_text_types:TextTypes.ExportedSelection;

    /**
     * Mappings from unique bib_id (e.g. "the_great_gatsby_fsf_01")
     * to an actual title (here: "The Great Gatsby"). For corpora
     * where live-attributes does not have a bibliography structattr
     * configured, this is typically empty as all the values
     * checked/entered to text types are used directly because
     * we don't care whether they map to unique books/newspapers/whatever
     * (we just want matching values).
     */
    bib_mapping:TextTypes.BibMapping;

    aligned:Array<{
        query_type:QueryType;
        query:string;
        corpname:string;
        human_corpname:string;
        lpos:string;
        qmcase:string;
        pcq_pos_neg:string;
        default_attr:string;
    }>;
}


export interface GetHistoryResponse extends Kontext.AjaxResponse {
    data:Array<QueryHistoryItem>;
    limit:number;
    offset:number;
}

export interface WidgetProps {
    sourceId:string;
    formType:QueryFormType;
    onCloseTrigger:()=>void;
}

export interface ModelState {
    data:Array<QueryHistoryItem>;
    offset:number;
    limit:number;
    querySupertype:Kontext.QuerySupertype;
    currentCorpusOnly:boolean;
    isBusy:boolean;
    pageSize:number;
    hasMoreItems:boolean;
    archivedOnly:boolean;
    editedItem:number|undefined;
    currentItem:number;
}

