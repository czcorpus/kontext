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

export interface ConcToken {
    className:string;
    text:Array<string>; // array => multiple words per 'pseudo-position'
    tailPosAttrs:Array<string>; // array => multiple pos attrs per whole 'pseudo-position'
}


export class TextChunkBase implements ConcToken {
    className:string;
    text:Array<string>;
    tailPosAttrs:Array<string>;
    viewAttrs:Array<string>;
}


export class TextChunk extends TextChunkBase {
    id:string;
    openLink:{speechPath:string};
    closeLink:{speechPath:string};
    continued:boolean;
    showAudioPlayer:boolean;
}


export abstract class LangSection {
    tokenNumber:number;
    lineNumber:number;
    ref:Array<string>;

    constructor(tokenNumber:number, lineNumber:number, ref:Array<string>) {
        this.tokenNumber = tokenNumber;
        this.lineNumber = lineNumber;
        this.ref = ref;
    }

    abstract getAllChunks():Array<TextChunk>;

    abstract findChunk(chunkId:string):TextChunk;
}

export interface Line {
    lineGroup:number|undefined;
    lineNumber:number;
    kwicLength:number;
    hasFocus:boolean;
    languages:Array<LangSection>;
}


export interface IConcLinesProvider {
    isUnfinishedCalculation():boolean;
    getRecommOverviewMinFreq():number;
}