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

import * as Immutable from 'immutable';


export class TextChunk {
    id:string;
    className:string;
    text:Array<string>;
    openLink:{speechPath:string};
    closeLink:{speechPath:string};
    continued:boolean;
    showAudioPlayer:boolean;
    tailPosAttrs:Array<string>;
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

    abstract getAllChunks():Immutable.List<TextChunk>;

    abstract findChunk(chunkId:string):TextChunk;
}

export class Line {
    lineGroup:number;
    lineNumber:number;
    kwicLength:number;
    hasFocus:boolean;
    languages:Immutable.List<LangSection>;

    clone():Line {
        const copy = new Line();
        copy.lineGroup = this.lineGroup;
        copy.lineNumber = this.lineNumber;
        copy.kwicLength = this.kwicLength;
        copy.hasFocus = this.hasFocus;
        copy.languages = this.languages;
        return copy;
    }
}

export interface IConcLinesProvider {
    getLines():Immutable.List<Line>;
    isUnfinishedCalculation():boolean;
    getRecommOverviewMinFreq():number;
}