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

import { List, pipe } from 'cnc-tskit';
import { KWICSection, MLPositionsData, TextChunk, textChunkMatchesLinkId } from './common';


export class ConclineSectionOps {

    static newKWICSection(
        tokenNumber:number,
        lineNumber:number,
        kwicLength:number,
        ref:Array<string>,
        left:Array<TextChunk>,
        kwic:Array<TextChunk>,
        right:Array<TextChunk>,
        mlPositions:MLPositionsData,
        refMlPositions?:MLPositionsData,
    ) {
        const ans:KWICSection = {
            tokenNumber,
            lineNumber,
            ref,
            left,
            kwic,
            right,
            highlightMLPositions: refMlPositions ?
                pipe(
                    mlPositions.kwic,
                    List.slice(refMlPositions.left.length, refMlPositions.left.length + refMlPositions.kwic.length),
                    List.map(pos => [pos, pos])
                ) :
                []
        };
        return ans;
    }

    static getAllChunks(sect:KWICSection):Array<TextChunk> {
        return sect.left.concat(sect.kwic, sect.right);
    }

    static findChunk(sect:KWICSection, linkId:string):TextChunk {
        return List.find(v => textChunkMatchesLinkId(v, linkId), ConclineSectionOps.getAllChunks(sect));
    }
}
