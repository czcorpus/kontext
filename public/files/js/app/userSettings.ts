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

import {Kontext} from '../types/common';

/**
 *
 */
class NullStorage implements Storage {

    key(idx:number):string {
        return null
    }

    getItem(key:string):string {
        return null;
    }

    setItem(key:string, value:string) {
    }

    removeItem(key:string) {
    }

    clear():void {
    }

    length:number = 0;
    remainingSpace:number = 0;
    [key: string]: any;
    [index: number]: any;
}


/**
 * Local user settings
 */
export class UserSettings implements Kontext.IUserSettings {

    static ALIGNED_CORPORA_KEY = 'active_parallel_corpora';

    storage:Storage;

    storageKey:string;

    timestampKey:string;

    data:{[k:string]:any};

    private constructor(storage:Storage, storageKey:string, timestampKey:string) {
        this.storage = storage;
        this.storageKey = storageKey;
        this.timestampKey = timestampKey;
        this.data = {};
    }

    private getTimstamp():number {
        return new Date().getTime() / 1000;
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
            this.data = JSON.parse(this.storage.getItem(this.storageKey));

        } else {
            this.data[this.timestampKey] = this.getTimstamp();
        }
    }

    /**
     * createInstance is a factory function
     */
    static createInstance(conf:Kontext.IConfHandler):UserSettings {
        return new UserSettings(
            (typeof window.localStorage === 'object') ? window.localStorage : new NullStorage(),
            'kontext_ui',
            '__timestamp__'
        );
    }
}


