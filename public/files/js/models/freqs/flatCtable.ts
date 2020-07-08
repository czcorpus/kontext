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

import {TextTypes} from '../../types/common';
import {PageModel, DownloadType} from '../../app/page';
import {FreqResultResponse} from '../../types/ajaxResponses';
import * as Immutable from 'immutable';
import {GeneralFreq2DModel, CTFreqCell} from './generalCtable';
import {CTFormProperties,  FreqFilterQuantities, roundFloat} from './ctFreqForm';
import {MultiDict} from '../../multidict';
import { Action, IFullActionControl } from 'kombo';
import { Maths } from 'cnc-tskit';

/**
 * En extended 2d freq. data item containing
 * also a value pair.
 */
export interface FreqDataItem extends CTFreqCell {
    val1:string;
    val2:string;
}


/**
 * A helper type used when exporting data for Excel etc.
 */
export type ExportTableRow = [string, string, number, number, number, number, number, number];


/**
 * A type representing exported (for Excel etc.) data
 * sent to a server for conversion.
 */
export interface FormatConversionExportData {
    headings:Array<string>;
    minFreq:number;
    minFreqType:string;
    alphaLevel:number;
    data:Array<ExportTableRow>;
}


/**
 * A model for operations on a flat version of 2d frequency table
 */
export class Freq2DFlatViewModel extends GeneralFreq2DModel {

    /**
     * Original data as imported from page initialization.
     */
    private origData:Immutable.List<FreqDataItem>;

    /**
     * Current data derived from origData by applying filters etc.
     */
    private data:Immutable.List<FreqDataItem>;

    private sortBy:string;

    private sortReversed:boolean;

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, props:CTFormProperties,
            adhocSubcDetector:TextTypes.IAdHocSubcorpusDetector) {
        super(dispatcher, pageModel, props, adhocSubcDetector);
        this.origData = Immutable.List<FreqDataItem>();
        this.sortBy = 'ipm';
        this.sortReversed = true;

        dispatcher.registerActionListener((action:Action) => {
            switch (action.name) {
                case 'FREQ_CT_SET_MIN_FREQ':
                    if (this.validateMinAbsFreqAttr(action.payload['value'])) {
                        this.minFreq = action.payload['value'];
                        if (this.data) {
                            this.updateData();
                        }

                    } else {
                        // we do not show error because other active model for 2d table handles this
                    }
                    this.emitChange();
                break;
                case 'FREQ_CT_SET_MIN_FREQ_TYPE':
                    this.minFreqType = action.payload['value'];
                    this.emitChange();
                break;
                case 'FREQ_CT_SET_ALPHA_LEVEL':
                    this.alphaLevel = action.payload['value'];
                    this.recalculateConfIntervals();
                    this.updateData();
                    this.emitChange();
                break;
                case 'FREQ_CT_SORT_FLAT_LIST':
                    this.sortBy = action.payload['value'];
                    this.sortReversed = action.payload['reversed'];
                    this.updateData();
                    this.emitChange();
                break;
            }
        });
    }

    private recalculateConfIntervals():void {
        this.origData = this.origData.map((cell, i) => {
            const confInt = Maths.wilsonConfInterval(cell.abs, cell.domainSize, this.alphaLevel);
            return {
                origOrder: i,
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
        this.fullSize = data.full_size;
        this.origData = Immutable.List<FreqDataItem>(data.data.map((item, i) => {
            const confInt = Maths.wilsonConfInterval(item[2], item[3], this.alphaLevel);
            return {
                origOrder: i,
                val1: item[0],
                val2: item[1],
                abs: item[2],
                absConfInterval: [Math.round(confInt[0] * item[3]), Math.round(confInt[1] * item[3])],
                ipm: this.calcIpm(item),
                ipmConfInterval: [roundFloat(confInt[0] * 1e6), roundFloat(confInt[1] * 1e6)],
                domainSize: item[3],
                pfilter: this.generatePFilter(item[0], item[1])
            };
        }));
        this.updateData();
    }

    private getFreqFetchFn():(c:CTFreqCell)=>number {
        switch (this.minFreqType) {
            case FreqFilterQuantities.ABS:
            case FreqFilterQuantities.ABS_PERCENTILE:
                return (c:CTFreqCell) => c.abs;
            case FreqFilterQuantities.IPM:
            case FreqFilterQuantities.IPM_PERCENTILE:
                return (c:CTFreqCell) => c.ipm;
            default:
                throw new Error('Unknown quantity: ' + this.minFreqType);
        }
    }

    createPercentileSortMapping():Immutable.Map<number, number> {
        const fetchFreq = this.getFreqFetchFn();
        return Immutable.Map<number, number>(this.origData
            .map(x => [x.origOrder, fetchFreq(x)])
            .filter(x => x !== undefined)
            .sort((x1, x2) => x1[1] - x2[1])
            .map((x, i) => [x[0], i]));
    }

    importDataAndNotify(data:FreqResultResponse.CTFreqResultData):void {
        this.importData(data);
        this.emitChange();
    }

    exportData():FormatConversionExportData {
        const data = this.data.map<ExportTableRow>(v => ([
            v.val1,
            v.val2,
            v.absConfInterval[0],
            v.abs,
            v.absConfInterval[1],
            v.ipmConfInterval[0],
            v.ipm,
            v.ipmConfInterval[1]
        ]));
        return {
            headings: [
                this.attr1,
                this.attr2,
                this.pageModel.translate('freq__ct_abs_freq_label'),
                this.pageModel.translate('freq__ct_ipm_freq_label')
            ],
            minFreq: parseFloat(this.minFreq),
            minFreqType: this.minFreqType,
            alphaLevel: parseFloat(this.alphaLevel),
            data: data.toArray()
        };
    }

    submitDataConversion(format:string):void {
        const args = new MultiDict();
        args.set('saveformat', format);
        args.set('savemode', 'flat');
        this.pageModel.bgDownload(
            `2d-frequency.${format}`,
            DownloadType.FREQ2D,
            this.pageModel.createActionUrl('export_freqct', args),
            {data: JSON.stringify(this.exportData())}
        );
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