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

import {TextTypes} from '../../types/common';
import {StatefulModel} from '../base';
import * as Immutable from 'immutable';
import {MultiDict} from '../../util';
import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import {TextTypesModel} from '../../models/textTypes/attrValues';

export class SubcorpFormModel extends StatefulModel {

    private pageModel:PageModel;

    private inputMode:string;

    private corpname:string;

    private subcname:string;

    private isPublic:boolean;

    private description:string;

    private withinFormModel:SubcorpWithinFormModel;

    private textTypesModel:TextTypesModel;

    private alignedCorporaProvider:()=>Immutable.List<TextTypes.AlignedLanguageItem>;

    constructor(dispatcher:ActionDispatcher, pageModel:PageModel,
            withinFormModel:SubcorpWithinFormModel, textTypesModel:TextTypesModel, corpname:string,
            alignedCorporaProvider:()=>Immutable.List<TextTypes.AlignedLanguageItem>) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.withinFormModel = withinFormModel;
        this.textTypesModel = textTypesModel;
        this.corpname = corpname;
        this.alignedCorporaProvider = alignedCorporaProvider;
        this.inputMode = 'gui';
        this.subcname = '';
        this.isPublic = false;
        this.description = '';

        this.dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'SUBCORP_FORM_SET_INPUT_MODE':
                    this.inputMode = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'SUBCORP_FORM_SET_SUBCNAME':
                    this.subcname = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'SUBCORP_FORM_SET_SUBC_AS_PUBLIC':
                    this.isPublic = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'SUBCORP_FORM_SET_DESCRIPTION':
                    this.description = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'SUBCORP_FORM_SUBMIT':
                    this.submit();
                    // leaves the page here
                break;
            }
        });
    }

    private getSubmitArgs():MultiDict {
        const args = new MultiDict();
        args.set('corpname', this.corpname);
        args.set('subcname', this.subcname);
        args.set('publish', this.isPublic ? '1' : '0');
        args.set('description', this.description);
        const alignedCorpora = this.alignedCorporaProvider().map(v => v.value).toArray();
        if (alignedCorpora.length > 0) {
            args.replace('aligned_corpora', this.alignedCorporaProvider().map(v => v.value).toArray());
            args.set('attrs', JSON.stringify(this.textTypesModel.exportSelections(false)));
        }
        if (this.inputMode === 'raw') {
            args.set('within_json', this.withinFormModel.exportJson());

        } else if (this.inputMode === 'gui') {
            const selections = this.textTypesModel.exportSelections(false);
            for (let p in selections) {
                args.replace(`sca_${p}`, selections[p]);
            }
        }
        return args;
    }

    submit():void {
        const args = this.getSubmitArgs();
        if (this.subcname != '') {
            this.pageModel.setLocationPost(
                this.pageModel.createActionUrl('/subcorpus/subcorp'),
                args.items()
            );

        } else {
            this.pageModel.showMessage('error',
                    this.pageModel.translate('subcform__missing_subcname'));
        }

    }

    getSubcname():string {
        return this.subcname;
    }

    getInputMode():string {
        return this.inputMode;
    }

    getIsPublic():boolean {
        return this.isPublic;
    }

    getDescription():string {
        return this.description;
    }
}

/**
 *
 */
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


/**
 *
 */
export class SubcorpWithinFormModel extends StatefulModel {

    private lines:Immutable.List<WithinLine>;

    constructor(dispatcher:ActionDispatcher, initialStructName:string,
            initialState:Array<{[key:string]:string}>) {
        super(dispatcher);
        this.lines = Immutable.List<WithinLine>();

        (initialState || []).forEach((item) => {
            this.importLine(item);
        });
        if (this.lines.size === 0) {
            this.lines = this.lines.push(new WithinLine(this.lines.size, false, initialStructName, ''));
        }
        this.dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'SUBCORP_FORM_WITHIN_LINE_ADDED':
                    this.addLine(payload.props);
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

    updateWithinType(i, negated) {
        this.lines = this.lines.set(i, new WithinLine(
            i,
            negated,
            this.lines.get(i).structureName,
            this.lines.get(i).attributeCql
        ));
    }

    updateStruct(i, structName) {
        this.lines = this.lines.set(i, new WithinLine(
            i,
            this.lines.get(i).negated,
            structName,
            this.lines.get(i).attributeCql
        ));
    }

    updateCql(i, cql) {
        this.lines = this.lines.set(i, new WithinLine(
            i,
            this.lines.get(i).negated,
            this.lines.get(i).structureName,
            cql
        ));
    }

    importLine(data) {
        this.lines = this.lines.push(new WithinLine(this.lines.size, data['negated'], data['structure_name'], data['attribute_cql']));
    }

    addLine(data) {
        this.lines = this.lines.push(new WithinLine(this.lines.size, data['negated'], data['structureName'], data['attributeCql']));
    }

    removeLine(idx) {
        this.lines = this.lines.remove(idx);
    }

    getLines():Immutable.List<WithinLine> {
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