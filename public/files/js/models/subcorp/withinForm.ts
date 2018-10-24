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

import {Kontext} from '../../types/common';
import {StatefulModel} from '../base';
import * as Immutable from 'immutable';
import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';

/**
 *
 */
export class WithinLine {
    rowIdx:number;
    negated:boolean;
    structureName:string;
    attributeCql:Kontext.FormValue<string>;

    constructor(rowIdx:number, negated:boolean, structureName:string, attributeCql:Kontext.FormValue<string>) {
        this.rowIdx = rowIdx;
        this.negated = negated;
        this.structureName = structureName;
        this.attributeCql = attributeCql;
    }
}


/**
 *
 */
export class SubcorpWithinFormModel extends StatefulModel {

    private pageModel:PageModel;

    private lines:Immutable.List<WithinLine>;

    private lineIdGen:number;

    constructor(dispatcher:ActionDispatcher, pageModel:PageModel, initialStructName:string,
            initialState:Array<{[key:string]:string}>) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.lines = Immutable.List<WithinLine>();
        this.lineIdGen = 0;

        (initialState || []).forEach((item) => {
            this.importLine(item);
        });
        if (this.lines.size === 0) {
            this.lines = this.lines.push(new WithinLine(
                0,
                false,
                initialStructName,
                {value: '', isRequired: true, isInvalid: false}
            ));
        }
        this.dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'SUBCORP_FORM_WITHIN_LINE_ADDED':
                    this.addLine(
                        payload.props['structureName'],
                        payload.props['negated'],
                        payload.props['attributeCql']
                    );
                    this.notifyChangeListeners();
                break;
                case 'SUBCORP_FORM_WITHIN_LINE_SET_WITHIN_TYPE':
                    this.updateWithinType(payload.props['rowIdx'], payload.props['value']);
                    this.notifyChangeListeners();
                break;
                case 'SUBCORP_FORM_WITHIN_LINE_SET_STRUCT':
                    this.updateStruct(payload.props['rowIdx'], payload.props['value']);
                    this.notifyChangeListeners();
                break;
                case 'SUBCORP_FORM_WITHIN_LINE_SET_CQL':
                    this.updateCql(payload.props['rowIdx'], payload.props['value']);
                    this.notifyChangeListeners();
                break;
                case 'SUBCORP_FORM_WITHIN_LINE_REMOVED':
                    this.removeLine(payload.props['rowIdx']);
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    updateWithinType(rowIdx, negated) {
        const srchIdx = this.lines.findIndex(v => v.rowIdx === rowIdx);
        if (srchIdx > -1) {
            this.lines = this.lines.set(srchIdx, new WithinLine(
                srchIdx,
                negated,
                this.lines.get(srchIdx).structureName,
                this.lines.get(srchIdx).attributeCql
            ));
        }
    }

    updateStruct(rowIdx, structName) {
        const srchIdx = this.lines.findIndex(v => v.rowIdx === rowIdx);
        if (srchIdx > -1) {
            this.lines = this.lines.set(srchIdx, new WithinLine(
                srchIdx,
                this.lines.get(srchIdx).negated,
                structName,
                this.lines.get(srchIdx).attributeCql
            ));
        }
    }

    updateCql(rowIdx, cql) {
        const srchIdx = this.lines.findIndex(v => v.rowIdx === rowIdx);
        if (srchIdx > -1) {
            this.lines = this.lines.set(srchIdx, new WithinLine(
                srchIdx,
                this.lines.get(srchIdx).negated,
                this.lines.get(srchIdx).structureName,
                {value: cql, isRequired: true, isInvalid: false}
            ));
        }
    }

    importLine(data) {
        this.lineIdGen += 1;
        this.lines = this.lines.push(new WithinLine(
            this.lineIdGen,
            data['negated'],
            data['structure_name'],
            {value: data['attribute_cql'], isRequired: true, isInvalid: false}
        ));
    }

    addLine(structName:string, negated:boolean, cql:string):void {
        this.lineIdGen += 1;
        this.lines = this.lines.push(new WithinLine(
            this.lineIdGen,
            negated,
            structName,
            {value: cql, isRequired: true, isInvalid: false}
        ));
    }

    removeLine(rowIdx:number) {
        const srch = this.lines.findIndex(v => v.rowIdx === rowIdx);
        if (srch > -1) {
            this.lines = this.lines.remove(srch);
        }
    }

    getLines():Immutable.List<WithinLine> {
        return this.lines;
    }

    exportCql():string {
        return this.lines.filter((v)=>v != null).map(
            (v:WithinLine) => (
                (v.negated ? '!within' : 'within') + ' <' + v.structureName
                    + ' ' + v.attributeCql.value + ' />')
        ).join(' ');
    }

    exportJson():string {
        return JSON.stringify(this.lines.filter((v)=>v != null).map(
            (v:WithinLine) => ({
                    negated: v.negated,
                    structure_name: v.structureName,
                    attribute_cql: v.attributeCql.value
            })
        ));
    }

    validateForm():Error|null {
        const errIdx = this.lines.findIndex(v => v.attributeCql.value === '');
        console.log('validating ', this.lines.toArray());
        if (errIdx > -1) {
            console.log('error found at ', errIdx);
            const curr = this.lines.get(errIdx);
            this.lines = this.lines.set(errIdx, new WithinLine(
                curr.rowIdx,
                curr.negated,
                curr.structureName,
                Kontext.updateFormValue(curr.attributeCql, {isInvalid: true})
            ));
            return new Error(this.pageModel.translate('subcform__cql_cannot_be_empty'));
        }
        return null;
    }
}