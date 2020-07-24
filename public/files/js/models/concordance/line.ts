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

import { LangSection, TextChunk } from '../../types/concordance';
import { List, pipe } from 'cnc-tskit';



export class KWICSection extends LangSection {

    left:Array<TextChunk>;

    /**
     * This is used to obtain token number based on KWIC token number
     * which is the only one we know from the server.
     */
    leftOffsets:Array<number>;

    kwic:Array<TextChunk>;

    right:Array<TextChunk>;

    /**
     * This is used to obtain token number based on KWIC token number
     * which is the only one we know from the server.
     */
    rightOffsets:Array<number>;


    constructor(tokenNumber:number, lineNumber:number, ref:Array<string>,
            left:Array<TextChunk>, kwic:Array<TextChunk>,
            right:Array<TextChunk>) {
        super(tokenNumber, lineNumber, ref);
        this.left = left;
        this.leftOffsets = pipe(
            this.left,
            List.foldr(
                (r, v) => [(v.className ? 0 : v.text.length) + (r.length > 0 ? r[0] : 0)].concat(r), []
            )
        );
        this.kwic = kwic;
        this.right = right;
        this.rightOffsets = pipe(
            this.right,
            List.foldr((r, v) => r.concat((v.className ? 0 : v.text.length) + (r.length > 0 ? r[r.length - 1] : 0)), [1]),
            List.slice(0, -1)
        );
    }

    getAllChunks():Array<TextChunk> {
        return this.left.concat(this.kwic, this.right);
    }

    findChunk(chunkId:string):TextChunk {
        return this.getAllChunks().find(v => v.id === chunkId);
    }
}


export class SentSection extends LangSection {
    items:Array<TextChunk>;

    getAllChunks():Array<TextChunk> {
        return this.items;
    }

    findChunk(chunkId:string):TextChunk {
        return this.getAllChunks().find(v => v.id === chunkId);
    }
}
