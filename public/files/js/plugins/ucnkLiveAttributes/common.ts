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

/**
 * A minimal interface required by RangeSelector to cooperate with
 * text types checkboxes.
 */
export interface CheckboxLists {

    applyOnCheckboxes(attribName:string, callback:{(i:number, item:HTMLElement):void}):void;

    tableIsRange(attribName:string):boolean;

    getTable(name:string):HTMLElement;

    updateCheckboxes(data:any):void;
}

/**
 * This is just a pre-1.4 way to specify either
 * an array (= list of attributes) or an object with length property
 * (= too long list replacement)
 */
export interface AvailAttrValues {
    length: number;
    push?: (value:any) => void;
}

/**
 * Stores attributes and their respective values
 */
export interface AttributesMap {
    poscount?: number;
    aligned?: Array<string>;
    //[attr: string]: AvailAttrValues;
}

