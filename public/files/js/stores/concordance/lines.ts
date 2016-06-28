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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../../ts/declarations/flux.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />

import {SimplePageStore} from '../../util';
import {PageModel} from '../../tpl/document';
import Immutable = require('vendor/immutable');
import {Line, KWICSection, TextChunk} from './line';

export interface ServerTextChunk {
    class:string;
    str:string;
}

export interface SingleCorpServerLineData {
    Left:Array<ServerTextChunk>;
    Right:Array<ServerTextChunk>;
    Kwic:Array<ServerTextChunk>;
    rightsize:number;
    hitlen:string;
    linegroup:string;
    leftsize:number;
    ref:string;
    rightspace:string;
    linenum:number;
    leftspace:string;
    kwiclen:number;
    toknum:number;
}

export interface ServerLineData extends SingleCorpServerLineData {
    Align:Array<SingleCorpServerLineData>;
}


function importData(data:Array<ServerLineData>):Immutable.List<Line> {
    let ans:Array<Line> = [];

    data.forEach((item:ServerLineData) => {
        let line:Array<KWICSection> = [];

        line.push({
            tokenNumber: item.toknum,
            lineNumber: item.linenum,
            ref: item.ref,
            left: Immutable.List<TextChunk>(item.Left.map(v => {return {className: v.class, text: v.str}; })),
            right: Immutable.List<TextChunk>(item.Right.map(v => {return {className: v.class, text: v.str}; })),
            kwic: Immutable.List<TextChunk>(item.Kwic.map(v => {return {className: v.class, text: v.str}; }))
        });

        line = line.concat((item.Align || []).map((item) => {
            return {
                tokenNumber: item.toknum,
                lineNumber: item.linenum,
                ref: item.ref,
                left: Immutable.List<TextChunk>(item.Left.map(v => {return {className: v.class, text: v.str}; })),
                right: Immutable.List<TextChunk>(item.Right.map(v => {return {className: v.class, text: v.str}; })),
                kwic: Immutable.List<TextChunk>(item.Kwic.map(v => {return {className: v.class, text: v.str}; }))
            };
        }));

        ans.push({
            lineNumber: item.linenum,
            lineGroup: item.linegroup,
            kwicLength: item.kwiclen,
            languages: Immutable.List(line)
        }); // TODO
    });

    return Immutable.List(ans);
}


export class ConcLineStore extends SimplePageStore {

    private layoutModel:PageModel;

    private lines:Immutable.List<Line>;


    constructor(layoutModel:PageModel, dispatcher:Dispatcher.Dispatcher<any>,
            initialData:Array<ServerLineData>) {
        super(dispatcher);
        let self = this;
        this.layoutModel = layoutModel;
        this.lines = importData(initialData);

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'CONC_LINES_KWIC_SELECTED':
                break;
            }
        });
    }

    getLines():Immutable.List<Line> {
        return this.lines;
    }
}

