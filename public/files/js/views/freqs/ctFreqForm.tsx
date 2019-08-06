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
import * as React from 'react';
import * as Immutable from 'immutable';
import {IActionDispatcher} from 'kombo';

import {Freq2DFormModel, FreqFilterQuantities, AlignTypes, Dimensions} from '../../models/freqs/ctFreqForm';
import { Subscription } from 'rxjs';


interface CTFreqFormProps {
}

interface CTFreqFormState {
    posAttrs:Immutable.List<Kontext.AttrItem>;
    structAttrs:Immutable.List<Kontext.AttrItem>;
    attr1:string;
    attr1IsStruct:boolean;
    attr2:string;
    attr2IsStruct:boolean;
    minFreq:string;
    minFreqType:FreqFilterQuantities;
    minFreqHint:string;
    positionRangeLabels:Array<string>,
    alignType1:AlignTypes;
    alignType2:AlignTypes;
    ctxIndex1:number;
    ctxIndex2:number;
    usesAdHocSubcorpus:boolean;
}

interface ExportedComponents {
    CTFreqForm:React.ComponentClass<CTFreqFormProps>;
}


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    ctFreqFormModel:Freq2DFormModel):ExportedComponents {


    // -------------------- <CTFreqFormMinFreqInput /> --------------------------------------------

    interface CTFreqFormMinFreqInputProps {
        freqType:FreqFilterQuantities;
        value:string;
        hint:string;
    }

    const CTFreqFormMinFreqInput:React.SFC<CTFreqFormMinFreqInputProps> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                name: 'FREQ_CT_FORM_SET_MIN_FREQ',
                payload: {
                    value: evt.target.value
                }
            });
        };

        const handleTypeChange = (evt) => {
            dispatcher.dispatch({
                name: 'FREQ_CT_FORM_SET_MIN_FREQ_TYPE',
                payload: {value: evt.target.value}
            });
        };

        return (
            <span>
                <label>
                    {he.translate('freq__ct_min_freq_label')}
                    {'\u00a0'}
                    <select onChange={handleTypeChange} value={props.freqType}>
                        <option value="abs">{he.translate('freq__ct_min_abs_freq_opt')}</option>
                        <option value="pabs">{he.translate('freq__ct_min_pabs_freq_opt')}</option>
                        <option value="ipm">{he.translate('freq__ct_min_ipm_opt')}</option>
                        <option value="pipm">{he.translate('freq__ct_min_pipm_opt')}</option>
                    </select>
                    {'\u00a0'}:{'\u00a0'}
                    <input type="text" onChange={handleInputChange}
                            value={props.value} style={{width: '3em'}} />
                </label>
                {props.hint ? <span className="hint"> ({props.hint})</span> : null}
            </span>
        );
    };

    // -------- <CTFreqPosSelect /> --------------------------------

    interface CTFreqPosSelectProps {
        dim:number;
        value:number;
        positionRangeLabels:Array<string>;
    }

    const CTFreqPosSelect:React.SFC<CTFreqPosSelectProps> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch({
                name: 'FREQ_CT_FORM_SET_CTX',
                payload: {
                    dim: props.dim,
                    value: parseInt(evt.target.value, 10)
                }
            });
        };

        return (
            <select value={props.value} onChange={handleChange}>
                {props.positionRangeLabels.map((item, i) => <option key={i} value={i}>{item}</option>)}
            </select>
        );
    };

    // -------- <CTFreqNodeStartSelect /> --------------------------------

    interface CTFreqNodeStartSelectProps {
        dim:number;
        value:string;
    }

    const CTFreqNodeStartSelect:React.SFC<CTFreqNodeStartSelectProps> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch({
                name: 'FREQ_CT_FORM_SET_ALIGN_TYPE',
                payload: {
                    dim: props.dim,
                    value: evt.target.value
                }
            });
        };

        return (
            <select onChange={handleChange} value={props.value}>
                <option>{he.translate('freq__align_type_left')}</option>
                <option>{he.translate('freq__align_type_right')}</option>
            </select>
        );
    };

    // -------------------- <CTFreqForm /> --------------------------------------------

    class CTFreqForm extends React.Component<CTFreqFormProps, CTFreqFormState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = this._fetchState();
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
            this._handleAttrSelChange = this._handleAttrSelChange.bind(this);
        }


        _fetchState() {
            return {
                posAttrs: ctFreqFormModel.getPosAttrs(),
                structAttrs: ctFreqFormModel.getStructAttrs(),
                attr1: ctFreqFormModel.getAttr1(),
                attr1IsStruct: ctFreqFormModel.getAttr1IsStruct(),
                attr2: ctFreqFormModel.getAttr2(),
                attr2IsStruct: ctFreqFormModel.getAttr2IsStruct(),
                minFreq: ctFreqFormModel.getMinFreq(),
                minFreqType: ctFreqFormModel.getMinFreqType(),
                minFreqHint: ctFreqFormModel.getMinFreqHint(),
                positionRangeLabels: ctFreqFormModel.getPositionRangeLabels(),
                alignType1: ctFreqFormModel.getAlignType(1),
                alignType2: ctFreqFormModel.getAlignType(2),
                ctxIndex1: ctFreqFormModel.getCtxIndex(1),
                ctxIndex2: ctFreqFormModel.getCtxIndex(2),
                usesAdHocSubcorpus: ctFreqFormModel.getUsesAdHocSubcorpus()
            };
        }

        getInitialState() {
            return this._fetchState();
        }

        componentDidMount() {
            this.modelSubscription = ctFreqFormModel.addListener(this._modelChangeHandler);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        _modelChangeHandler() {
            this.setState(this._fetchState());
        }

        _handleAttrSelChange(dimension, evt) {
            dispatcher.dispatch({
                name: 'FREQ_CT_FORM_SET_DIMENSION_ATTR',
                payload: {
                    dimension: dimension,
                    value: evt.target.value
                }
            });
        }

        _renderPosAttrOpts(dim:Dimensions) {
            return [
                <tr key="label">
                    <th>
                        {he.translate('freq__ml_th_position')}:
                    </th>
                    <td>
                        <CTFreqPosSelect
                                positionRangeLabels={this.state.positionRangeLabels}
                                dim={dim}
                                value={dim === 1 ? this.state.ctxIndex1 : this.state.ctxIndex2} />
                    </td>
                </tr>,
                <tr key="input">
                    <th>
                        {he.translate('freq__ml_th_node_start_at')}:
                    </th>
                    <td>
                        <CTFreqNodeStartSelect
                                dim={dim}
                                value={dim === 1 ? this.state.alignType1 : this.state.alignType2} />
                    </td>
                </tr>
            ];
        }

        _renderWarning() {
            if (this.state.usesAdHocSubcorpus) {
                return (
                    <p className="warning">
                        <img src={he.createStaticUrl('img/warning-icon.svg')}
                                alt={he.translate('global__warning')} />
                        {he.translate('freq__ct_uses_ad_hoc_subcorpus_future_warn')}
                    </p>
                );
            }
        }

        render() {
            return (
                <div className="CTFreqForm">
                    <div className="toolbar">
                            <CTFreqFormMinFreqInput value={this.state.minFreq} freqType={this.state.minFreqType}
                                    hint={this.state.minFreqHint} />
                    </div>
                    <table className="form">
                        <tbody className="dim1">
                            <tr>
                                <th className="main" rowSpan={3}>
                                    <strong>1.</strong>
                                    ({he.translate('freq__ct_dim1')})
                                </th>
                                <th>
                                    {he.translate('freq__ml_th_attribute')}:
                                </th>
                                <td>
                                    <select onChange={this._handleAttrSelChange.bind(this, 1)}
                                            value={this.state.attr1}>
                                        <optgroup label={he.translate('global__attrsel_group_pos_attrs')}>
                                            {this.state.posAttrs.map(item =>
                                                <option key={item.n} disabled={item.n === null} value={item.n}>{item.label}</option>)}
                                        </optgroup>
                                        <optgroup label={he.translate('global__attrsel_group_struct_attrs')}>
                                            {this.state.structAttrs.map(item =>
                                                <option key={item.n} disabled={item.n === null} value={item.n}>{item.label}</option>)}
                                        </optgroup>
                                    </select>
                                </td>
                            </tr>
                            {!this.state.attr1IsStruct ? this._renderPosAttrOpts(1) : <tr><td colSpan={2} rowSpan={2} /></tr>}
                        </tbody>
                        <tbody className="dim2">
                            <tr>
                                <th className="main" rowSpan={3}>
                                    <strong>2.</strong>
                                    ({he.translate('freq__ct_dim2')})
                                </th>
                                <th>
                                    {he.translate('freq__ml_th_attribute')}:
                                </th>
                                <td>
                                    <select onChange={this._handleAttrSelChange.bind(this, 2)}
                                            value={this.state.attr2}>
                                        <optgroup label={he.translate('global__attrsel_group_pos_attrs')}>
                                            {this.state.posAttrs.map(item =>
                                                <option key={item.n} disabled={item.n === null} value={item.n}>{item.label}</option>)}
                                        </optgroup>
                                        <optgroup label={he.translate('global__attrsel_group_struct_attrs')}>
                                            {this.state.structAttrs.map(item =>
                                                <option key={item.n} disabled={item.n === null} value={item.n}>{item.label}</option>)}
                                        </optgroup>
                                    </select>
                                </td>
                            </tr>
                            {!this.state.attr2IsStruct ? this._renderPosAttrOpts(2) : <tr><td colSpan={2} rowSpan={2} /></tr>}
                        </tbody>
                    </table>
                    {this._renderWarning()}
                </div>
            );
        }
    }

    return {
        CTFreqForm: CTFreqForm
    };

}