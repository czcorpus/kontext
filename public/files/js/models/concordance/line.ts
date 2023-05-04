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
import { KWICSection, MLPositionsData, TextChunk } from './common';


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
            leftOffsets: pipe(
                left,
                List.foldr(
                    (r, v) => [(v.className ? 0 : v.text.length) + (r.length > 0 ? r[0] : 0)].concat(r), []
                )
            ),
            kwic,
            right,
            rightOffsets: pipe(
                right,
                List.foldr(
                    (r, v) => r.concat((v.className ? 0 : v.text.length) + (r.length > 0 ? r[r.length - 1] : 0)), [1 + (kwicLength > 0 ? kwicLength - 1 : 0)]),
                List.slice(0, -1)
            ),
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

    static findChunk(sect:KWICSection, chunkId:string):TextChunk {
        return List.find(v => v.id === chunkId, ConclineSectionOps.getAllChunks(sect));
    }
}
