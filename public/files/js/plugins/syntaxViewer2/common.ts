/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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


export type ReferencedValues = Array<[number,string]>;

export type DetailValue = string | ReferencedValues;

export type DetailAttrOrders = {[treeId:string]:Array<string>};


/**
 * Specifies a function which is joined to size
 * calculation chain in case calculated size of
 * syntax viewer frame is bigger then its maxWidth
 * or maxHeight size.
 *
 * It allows user to modify viewer's parent elements
 * to be able to handle such overflow. User may
 * or may not modify the original size passed as
 * arguments. But in any case user must return
 * valid width and height.
 */
export interface OverflowHandler {
    (width:number, height:number):[number,number];
}

/**
 * Viewer's configuration. Please note that
 * some properties are modifiable via plug-in's
 * CSS file.
 */
export interface Options {
    width?:number;
    height?:number;
    paddingTop?:number;
    paddingBottom?:number;
    paddingLeft?:number;
    paddingRight?:number;
    edgeWidth?:number;
    edgeColor?:string;
    nodeColor?:string;
    onOverflow?:OverflowHandler;
}

export interface Label {
    color:string; // CSS format color
    value:string;
}

export interface TreeNode {
    id:string;
    hint:string;
    labels:Array<Label>;
    parent:string;
    depth:number;
    data:Array<[string, DetailValue]>,
    x:number;
    y:number;
    hidden:boolean;
}

export type TreeNodeMap = {[ident:string]:TreeNode};

/**
 * Tree graph edge
 */
export interface Edge {
    x1:number;
    y1:number;
    x2:number;
    y2:number;
}

/**
 * Linear sentence token
 */
export interface Token {
    id:string;
    value:string;
    isKwic:boolean;
    multivalFlag:'start'|'end'|null;
}


export type Sentence = Array<Token>;