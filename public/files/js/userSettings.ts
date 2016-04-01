/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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


/// <reference path="../ts/declarations/common.d.ts" />


/**
 * Local user settings
 */
export class UserSettings implements Kontext.IUserSettings {

    static ALIGNED_CORPORA_KEY = 'active_parallel_corpora';

    storage:Storage;

    storageKey:string;

    timestampKey:string;

    uiStateTTL:number;

    data:{[k:string]:any};

    constructor(storage:Storage, storageKey:string, timestampKey:string, uiStateTTL:number) {
        this.storage = storage;
        this.storageKey = storageKey;
        this.timestampKey = timestampKey;
        this.uiStateTTL = uiStateTTL;
        this.data = {};
    }


    private getTimstamp():number {
        return new Date().getTime() / 1000;
    }

    private dataIsRecent(data) {
        return !data[this.timestampKey] || data[this.timestampKey]
            && ( (new Date().getTime() / 1000 - data[this.timestampKey]) < this.uiStateTTL);
    }

    private dumpToStorage() {
        this.data[this.timestampKey] = this.getTimstamp();
        this.storage.setItem(this.storageKey, JSON.stringify(this.data));
    }

    get<T>(key:string):T {
        return this.data[key];
    }

    set(key:string, value):void {
        this.data[key] = value;
        this.dumpToStorage();
    }

    init():void {
        if (this.storageKey in this.storage) {
            let tmp = JSON.parse(this.storage.getItem(this.storageKey));
            if (this.dataIsRecent(tmp)) {
                this.data = tmp;
            }

        } else {
            this.data[this.timestampKey] = this.getTimstamp();
        }
    }
}
