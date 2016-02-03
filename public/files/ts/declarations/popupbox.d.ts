/*
 * Copyright (c) 2012 Institute of the Czech National Corpus
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

 /// <reference path="./jquery.d.ts" />

declare module "popupbox" {

    export interface Position {
        top: number;
        left: number;
        width?: number;
        height?: number;
    }

    export interface Options {
        width?: number|string;
        height?: number;
        fontSize?: number;
        timeout?: number;
        type?: string;
        closeIcon?: boolean;
        onClose?: (e: Event) => void;
        beforeOpen?: (e: Event) => void;
        onShow?: (obj:JQuery) => void;
        onError?: (obj:JQuery) => void;
        domId?: string;
        htmlClass?: string;
        calculatePosition?: boolean;
        messages?: {[key:string]: string};
        translator?:(s:string)=>string;
    }


    /**
     *
     */
    export interface TooltipBox {

        getRootElement(): HTMLElement;

        getPosition(): Position;

        importElement(elm: HTMLElement): void;

        findElement(elm: any): JQuery;

        setCss(name: string, value: any);

        close(): void;

        mapTypeToIcon(type: string): string;

        open(whereElement: HTMLElement, contents: any, options: Options);

        importMessages(messages:{[key: string]: string});

        toString(): string;
    }

    // type ContentProvider: function | string;


    export function open(contents: any, position: Position, options: Options);

    export function bind(elm: HTMLElement, contents: any, options: Options);
    export function bind(query: string, contents: any, options: Options);
    export function bind(query: JQuery, contents: any, options: Options);

    export function abbr(context?: any); // TODO type

    export function hasAttachedPopupBox(elm: any); // TODO type

    export function close(elm: any); // TODO type

}