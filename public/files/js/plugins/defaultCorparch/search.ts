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

import * as Immutable from 'immutable';
import RSVP from 'rsvp';
import {IPluginApi} from '../../types/plugins';
import {MultiDict} from '../../util';
import {Kontext} from '../../types/common';


/**
 * This is used when the SearchTab tab asks server
 * for matching corpora according to the pattern
 * user has written to the search input.
 */
export interface SearchResultRow {
    name: string;
    favorite: boolean;
    path: string;
    desc: string;
    id: string;
    size: number;
    size_info: string;
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

    private phrases:Immutable.OrderedMap<string, Immutable.List<SearchResultRow>>;

    private capacity:number;

    constructor(capacity:number) {
        this.capacity = capacity;
        this.phrases = Immutable.OrderedMap<string, Immutable.List<SearchResultRow>>();
    }

    has(phrase:string):boolean {
        return this.phrases.has(phrase);
    }

    get(phrase:string):Immutable.List<SearchResultRow> {
        if (this.phrases.has(phrase)) {
            return this.phrases.get(phrase);
        }
        return Immutable.List<SearchResultRow>();
    }

    set(phrase:string, data:Array<SearchResultRow>) {
        if (this.phrases.size === this.capacity) {
            this.phrases = this.phrases.remove(this.phrases.keySeq().first());
        }
        this.phrases = this.phrases.set(phrase, Immutable.List<SearchResultRow>(data));
    }
}

/**
 *
 */
export class SearchEngine {

    private currKeywords:Immutable.List<string>;

    private availKeywords:Immutable.List<SearchKeyword>;

    private cache:Cache;

    private pluginApi:IPluginApi;

    private onWaiting:()=>void;

    private onDone:()=>void;


    constructor(pluginApi:IPluginApi, cacheCapacity:number, keywords:Array<[string, string, string]>) {
        this.pluginApi = pluginApi;
        this.cache = new Cache(cacheCapacity);
        this.currKeywords = Immutable.List<string>();
        this.availKeywords = Immutable.List<SearchKeyword>(keywords.map(item => {
            return {id: item[0], label: item[1], color: item[2], selected:false};
        }));
    }

    addOnWaiting(fn:()=>void):void {
        this.onWaiting = fn;
    }

    addOnDone(fn:()=>void):void {
        this.onDone = fn;
    }

    private mkQuery(phrase:string):string {
        const kw = this.availKeywords.filter(item => item.selected).map(item => '+' + item.id).join(' ');
        return `${kw} ${phrase}`;
    }

    search(phrase:string):RSVP.Promise<Immutable.List<SearchResultRow>> {
        if (this.onWaiting) {
            this.onWaiting();
        }
        const q = this.mkQuery(phrase);
        return (() => {
            if (this.cache.has(q)) {
                return new RSVP.Promise((resolve:(v)=>void, reject:(e)=>void) => {
                    resolve(this.cache.get(q));
                });

            } else {
                const args = new MultiDict();
                args.set('query', q);
                return this.pluginApi.ajax(
                    'GET',
                    this.pluginApi.createActionUrl('corpora/ajax_list_corpora'),
                    args
                ).then(
                    (data:SearchResponse) => {
                        this.cache.set(q, data.rows);
                        return data.rows;
                    }
                );
            }
        })().then(
            (data:Array<SearchResultRow>) => {
                if (this.onDone) {
                    this.onDone();
                }
                return Immutable.List<SearchResultRow>(data);
            }
        );
    }

    getAvailKeywords():Immutable.List<SearchKeyword> {
        return this.availKeywords;
    }

    resetKeywordSelectStatus():void {
        this.availKeywords = this.availKeywords.map(item => {
            return {
                id: item.id,
                label: item.label,
                color: item.color,
                selected: false
            };
        }).toList();
    }

    setKeywordSelectedStatus(id:string, status:boolean, exclusive:boolean):void {
        if (exclusive) {
            this.resetKeywordSelectStatus();
        }
        const idx = this.availKeywords.findIndex(x => x.id === id);
        if (idx > -1) {
            const v = this.availKeywords.get(idx);
            this.availKeywords = this.availKeywords.set(idx,
                {
                    id: v.id,
                    label: v.label,
                    color: v.color,
                    selected: status
                }
            );

        } else {
            throw new Error(`Cannot change label status - label ${id} not found`);
        }
    }

    hasSelectedKeywords():boolean {
        return this.availKeywords.find(x => x.selected) !== undefined;
    }

}