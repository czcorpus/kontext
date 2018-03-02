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

declare module RsvpAjax {

    export interface RequestOptions {
        method:string;
        url:string;
        requestBody:string;
        contentType:string;
        accept: string;
    }

    export function request<T>(httpMethod:string, url:string):RSVP.Promise<T>;

    export function requestObject<T>(options:RequestOptions):RSVP.Promise<T>;
}


declare module "vendor/rsvp-ajax" {
    export = RsvpAjax;
}