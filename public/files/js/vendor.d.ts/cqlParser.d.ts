/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

declare module "cqlParser/parser" {

    interface SrcPos {
        offset:number;
        line:number;
        column:number;
    }

    interface SrcRange {
        start:SrcPos;
        end:SrcPos;
    }

    interface TracerItem {
        type:string;
        rule:string;
        result?:string|Array<string>;
        location:SrcRange;
    }

    interface ITracer {
        trace: (v:TracerItem)=>void;
    }

    export interface Options {
        startRule?:string;
        tracer?:ITracer;
    }

    export interface SyntaxError extends Error {
        name:string;
        location:SrcRange;
        message:string;
        expected:Array<{
            type:string;
            text:string;
            ignoreCase:boolean;
        }>;
        found:string;
    }

    export interface RepetitionOther {
        repetitionType: 'atom-query'|'close-struct-tag'
    }

    export interface Seq {
        repetitionList: Array<RepetitionOther>;
    }

    export interface Sequence {
        seqList:Array<Seq>;
    }

    export interface Structure {
        structName:string;
        attList:Array<{
            attName:string;
            attValue:string;
        }>;
    }

    export interface RepetitionStruct {
        repetitionType: 'open-struct-tag'
        structure:Structure;
    }

    export interface WithinAttr {

    }

    export interface AST {
        withinOrContainingList:Array<{
            containsWithin:boolean,
            attrs:Array<RepetitionStruct>
        }>;
        sequence:Sequence;
    }

    export function parse(input:string, options?:Options):AST;
}