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


import {SimplePageStore} from '../../util';


export class WithinLine {
    rowIdx:number;
    negated:boolean;
    structureName:string;
    attributeCql:string;

    constructor(rowIdx:number, negated:boolean, structureName:string, attributeCql:string) {
        this.rowIdx = rowIdx;
        this.negated = negated;
        this.structureName = structureName;
        this.attributeCql = attributeCql;
    }
}


export class SubcorpFormStore extends SimplePageStore {

    private lines:Array<WithinLine>;

    constructor(dispatcher:Kontext.FluxDispatcher, initialStructName:string,
            initialState:Array<{[key:string]:string}>) {
        super(dispatcher);
        let self = this;
        this.lines = [];

        (initialState || []).forEach((item) => {
            self.importLine(item);
        });
        if (this.lines.length === 0) {
            this.lines.push(new WithinLine(this.lines.length, false, initialStructName, ''));
        }
        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'LINE_ADDED':
                    self.addLine(payload.props);
                    self.notifyChangeListeners('LINE_ADDED');
                    break;
                case 'LINE_UPDATED':
                    self.updateLine(payload.props['row'], payload.props);
                    self.notifyChangeListeners('LINE_UPDATED');
                    break;
                case 'LINE_REMOVED':
                    self.removeLine(payload.props['rowIdx']);
                    self.notifyChangeListeners('LINE_REMOVED');
            }
        });
    }

    updateLine(i, data) {
        this.lines[i] = new WithinLine(i, data['negated'], data['structureName'], data['attributeCql']);
    }

    importLine(data) {
        this.lines.push(new WithinLine(this.lines.length, data['negated'], data['structure_name'], data['attribute_cql']));
    }

    addLine(data) {
        this.lines.push(new WithinLine(this.lines.length, data['negated'], data['structureName'], data['attributeCql']));
    }

    removeLine(idx) {
        this.lines[idx] = null; // we want to keep deleted index to not confuse React (hint: key={idx})
    }

    getLines():Array<WithinLine> {
        return this.lines;
    }

    exportCql():string {
        return this.lines.filter((v)=>v != null).map(
            (v:WithinLine) => (
                (v.negated ? '!within' : 'within') + ' <' + v.structureName
                    + ' ' + v.attributeCql + ' />')
        ).join(' ');
    }

    exportJson():string {
        return JSON.stringify(this.lines.filter((v)=>v != null).map(
            (v:WithinLine) => ({
                    negated: v.negated,
                    structure_name: v.structureName,
                    attribute_cql: v.attributeCql
            })
        ));
    }
}