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

declare module RSVP {

    export class Promise<T> {

        constructor(action:(resolve:(v:T)=>void, reject:(e:any)=>void)=>void);

        then<V>(onFulfilled?:(v:T)=>V, onRejected?:(err:any)=>any):Promise<V>;
        then<V>(onFulfilled?:(v:T)=>Promise<V>, onRejected?:(err:any)=>any):Promise<V>;
    }
}


declare module "vendor/rsvp" {
    export = RSVP;
}
