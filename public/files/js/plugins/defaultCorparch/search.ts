/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

import { of as rxOf, Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { HTTP, List } from 'cnc-tskit';

import { IPluginApi } from '../../types/plugins';
import { MultiDict } from '../../multidict';
import { Kontext } from '../../types/common';


/**
 * This is used when the SearchTab tab asks server
 * for matching corpora according to the pattern
 * user has written to the search input.
 */
export interface SearchResultRow {
    name:string;
    favorite:boolean;
    path:string;
    desc:string;
    id:string;
    size:number;
    size_info:string;
    found_in?: Array<string>;
}

export interface SearchResponse extends Kontext.AjaxResponse {
    rows:Array<SearchResultRow>;
}

export interface SearchKeyword {
    id:string;
    label:string;
    color:string; // a CSS compatible color
    selected:boolean;
}

/**
 *
 */
class Cache {

    private phrases:Array<[string, Array<SearchResultRow>]>;

    private capacity:number;

    constructor(capacity:number) {
        this.capacity = capacity;
        this.phrases = [];
    }

    has(phrase:string):boolean {
        return List.some(([p,]) => p === phrase, this.phrases);
    }

    get(phrase:string):Array<SearchResultRow> {
        const idx = List.findIndex(([p, ]) => p === phrase, this.phrases);
        if (idx > -1) {
            return this.phrases[idx][1];
        }
        return [];
    }

    set(phrase:string, data:Array<SearchResultRow>) {
        if (this.phrases.length === this.capacity) {
            this.phrases.splice(0, 1);
        }
        this.phrases.push([phrase, data]);
    }
}

/**
 *
 */
export class SearchEngine {

    private cache:Cache;

    private pluginApi:IPluginApi;


    constructor(pluginApi:IPluginApi, cacheCapacity:number) {
        this.pluginApi = pluginApi;
        this.cache = new Cache(cacheCapacity);
    }

    private mkQuery(phrase:string, keywords:Array<SearchKeyword>):string {
        const kw = keywords.filter(item => item.selected).map(item => '+' + item.id).join(' ');
        return `${kw} ${phrase}`;
    }

    search(phrase:string, keywords:Array<SearchKeyword>):Observable<Array<SearchResultRow>> {
        const q = this.mkQuery(phrase, keywords);
        if (this.cache.has(q)) {
            return rxOf(this.cache.get(q));

        } else {
            const args = new MultiDict();
            args.set('query', q);
            return this.pluginApi.ajax$<SearchResponse>(
                HTTP.Method.GET,
                this.pluginApi.createActionUrl('corpora/ajax_list_corpora'),
                args
            ).pipe(
                tap(
                    (data) => {
                        this.cache.set(q, data.rows);
                    }
                ),
                map(
                    (data) => data.rows
                )
            );
        }
    }

}