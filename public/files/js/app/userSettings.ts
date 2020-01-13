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
class TransientStorage implements Storage {

    private data:{[key:string]:any};

    constructor() {
        this.data = {}
    }

    key(idx:number):string {
        return null
    }

    getItem(key:string):string {
        return this.data[key];
    }

    setItem(key:string, value:string) {
        this.data[key] = value;
    }

    removeItem(key:string) {
        delete this.data[key];
    }

    clear():void {
        this.data = {};
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
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(this.data));

        } catch (e) {
            console.error(`Storage access error ${e}. Switching to NullStorage.`);
            this.storage = new TransientStorage();
            this.storage.setItem(this.storageKey, JSON.stringify(this.data));
        }
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
            let src:string;
            try {
                src = this.storage.getItem(this.storageKey);

            } catch (e) {
                console.error(`Storage access error ${e}. Switching to NullStorage.`);
                this.storage = new TransientStorage();
                src = '{}';
            }

            try {
                this.data = JSON.parse(src);

            } catch (e) {
                this.data = {};
                this.storage.setItem(this.storageKey, '{}');
            }

        } else {
            this.data[this.timestampKey] = this.getTimstamp();
        }
    }

    /**
     * createInstance is a factory function for UserSettings
     */
    static createInstance():UserSettings {
        return new UserSettings(
            typeof window.localStorage === 'object' ?
                window.localStorage : new TransientStorage(),
            'kontext_ui',
            '__timestamp__'
        );
    }
}


