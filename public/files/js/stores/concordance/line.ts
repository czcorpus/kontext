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

/// <reference path="../../../ts/declarations/immutable.d.ts" />

import Immutable = require('vendor/immutable');


export class TextChunk {
    className:string;
    text:string;
    openLink:{speechPath:string};
    closeLink:{speechPath:string};
    continued:boolean;
    showAudioPlayer:boolean;
}


export abstract class LangSection {
    tokenNumber:number;
    lineNumber:number;
    ref:string;

    constructor(tokenNumber:number, lineNumber:number, ref:string) {
        this.tokenNumber = tokenNumber;
        this.lineNumber = lineNumber;
        this.ref = ref;
    }

    abstract getAllChunks():Immutable.List<TextChunk>;
}


export class KWICSection extends LangSection {
    left:Immutable.List<TextChunk>;
    kwic:Immutable.List<TextChunk>;
    right:Immutable.List<TextChunk>;

    constructor(tokenNumber:number, lineNumber:number, ref:string,
            left:Immutable.List<TextChunk>, kwic:Immutable.List<TextChunk>,
            right:Immutable.List<TextChunk>) {
        super(tokenNumber, lineNumber, ref);
        this.left = left;
        this.kwic = kwic;
        this.right = right;
    }

    getAllChunks():Immutable.List<TextChunk> {
        return this.left.concat(this.kwic, this.right).toList();
    }

}


export class SentSection extends LangSection {
    items:Immutable.List<TextChunk>;

    getAllChunks():Immutable.List<TextChunk> {
        return this.items;
    }
}


export class Line {
    lineGroup:string;
    lineNumber:number;
    kwicLength:number;
    languages:Immutable.List<LangSection>;
}