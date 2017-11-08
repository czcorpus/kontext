/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
/// <reference path="../../vendor.d.ts/immutable.d.ts" />
/// <reference path="../../types/ajaxResponses.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />

import {PageModel} from '../../pages/document';
import * as Immutable from 'vendor/immutable';
import {CTFormInputs, CTFormProperties, GeneralCTStore, CTFreqCell} from './generalCtable';
import {confInterval} from './statTables';

export interface FreqDataItem extends CTFreqCell {
    val1:string;
    val2:string;
}

/**
 *
 */
export class CTFlatStore extends GeneralCTStore {

    private origData:Immutable.List<FreqDataItem>;

    private data:Immutable.List<FreqDataItem>;

    private sortBy:string;

    private sortReversed:boolean;

    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel, props:CTFormProperties) {
        super(dispatcher, pageModel, props);
        this.origData = Immutable.List<FreqDataItem>();
        this.sortBy = 'ipm';
        this.sortReversed = true;
        dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'FREQ_CT_FORM_SET_DIMENSION_ATTR':
                    this.setDimensionAttr(payload.props['dimension'], payload.props['value']);
                    this.validateAttrs();
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_SET_MIN_FREQ':
                    if (this.validateMinAbsFreqAttr(payload.props['value'])) {
                        this.minFreq = payload.props['value'];
                        if (this.data) {
                            this.updateData();
                        }

                    } else {
                        // we do not show error because other active store for 2d table handles this
                    }
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_SET_MIN_FREQ_TYPE':
                    this.minFreqType = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_SET_ALPHA_LEVEL':
                    this.alphaLevel = payload.props['value'];
                    this.recalculateConfIntervals();
                    this.updateData();
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_SORT_FLAT_LIST':
                    this.sortBy = payload.props['value'];
                    this.sortReversed = payload.props['reversed'];
                    this.updateData();
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    private recalculateConfIntervals():void {
        this.origData = this.origData.map((cell, i) => {
            const confInt = confInterval(cell.abs, cell.domainSize, this.alphaLevel);
            return {
                order: i,
                val1: cell.val1,
                val2: cell.val2,
                ipm: cell.ipm,
                ipmConfInterval: <[number, number]>[confInt[0] * 1e6, confInt[1] * 1e6],
                abs: cell.abs,
                absConfInterval: <[number, number]>[confInt[0] * cell.domainSize, confInt[1] * cell.domainSize],
                domainSize: cell.domainSize,
                pfilter: cell.pfilter,
                bgColor: cell.bgColor
            }
        }).toList();
    }

    private updateData():void {
        const a1 = this.sortReversed ? -1 : 1;
        const a2 = this.sortReversed ? 1 : -1;
        this.data = this.origData.filter(this.createMinFreqFilterFn()).toList();

        switch (this.sortBy) {
            case this.attr1:
            this.data = this.data.sort((v1, v2) => {
                const s1 = v1.val1 + v1.val2;
                const s2 = v2.val1 + v2.val2;
                return s1.localeCompare(s2) * a1;
            }).toList();
            break;
            case 'abs':
            this.data = this.data.sort((v1, v2) => {
                if (v1.abs > v2.abs) {
                    return a1;
                }
                if (v1.abs === v2.abs) {
                    return 0;
                }
                if (v1.abs < v2.abs) {
                    return a2;
                }
            }).toList();
            break;
            case 'ipm':
            this.data = this.data.sort((v1, v2) => {
                if (v1.ipm > v2.ipm) {
                    return a1;
                }
                if (v1.ipm === v2.ipm) {
                    return 0;
                }
                if (v1.ipm < v2.ipm) {
                    return a2;
                }
            }).toList();
            break;
        }
    }

    importData(data:FreqResultResponse.CTFreqResultData):void {
        this.origData = Immutable.List<FreqDataItem>(data.map(item => {
            const confInt = confInterval(item[2], item[3], this.alphaLevel);
            return {
                val1: item[0],
                val2: item[1],
                abs: item[2],
                absConfInterval: [confInt[0] * item[3], confInt[1] * item[3]],
                ipm: this.calcIpm(item),
                ipmConfInterval: [confInt[0] * 1e6, confInt[1] * 1e6],
                domainSize: item[3],
                pfilter: this.generatePFilter(item[0], item[1])
            };
        }));
        this.updateData();
    }

    importDataAndNotify(data:FreqResultResponse.CTFreqResultData):void {
        this.importData(data);
        this.notifyChangeListeners();
    }

    getData():Immutable.List<FreqDataItem> {
        return this.data;
    }

    getAttr1():string {
        return this.attr1;
    }

    getAttr2():string {
        return this.attr2;
    }

    getSortCol():string {
        return this.sortBy;
    }

    getSortColIsReversed():boolean {
        return this.sortReversed;
    }

}