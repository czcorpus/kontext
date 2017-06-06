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

/// <reference path="../../../ts/declarations/react.d.ts" />

import React from 'vendor/react';
import {calcTextColorFromBg, importColor, color2str} from '../../util';


export function init(dispatcher, mixins, layoutViews, ctFreqDataRowsStore) {

    /**
     *
     */
    const QuantitySelect = (props) => {

        const handleSelectChange = (evt) => {
            props.changeQuantity(evt.target.value);
        };

        return (
            <label>
                {mixins.translate('freq__ct_quantity_label')}:{'\u00a0'}
                <select value={props.currValue} onChange={handleSelectChange}>
                    <option value="ipm">i.p.m.</option>
                    <option value="abs">absolute freq.</option>
                </select>
            </label>
        );
    };

    /**
     *
     */
    const MinFreqInput = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SET_MIN_ABS_FREQ',
                props: {value: evt.target.value}
            });
        };

        return (
            <label>
                {mixins.translate('freq__ct_min_freq_label')}:{'\u00a0'}
                <input type="text" style={{width: '3em'}} value={props.currVal}
                        onChange={handleInputChange} />
            </label>
        );
    };

    /**
     *
     */
    const EmptyVectorVisibilitySwitch = (props) => {

        const handleCheckboxChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SET_EMPTY_VEC_VISIBILITY',
                props: {value: evt.target.checked}
            });
        };

        return (
            <label>
                {mixins.translate('freq__ct_hide_zero_vectors')}:{'\u00a0'}
                <input type="checkbox" onChange={handleCheckboxChange}
                        checked={props.hideEmptyVectors} />
            </label>
        );
    };

    /**
     *
     * @param {*} props
     */
    const TransposeTableCheckbox = (props) => {
        const handleClickTranspose = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_TRANSPOSE_TABLE',
                props: {}
            });
        };

        return (
            <label>
                {mixins.translate('freq__ct_transpose_table')}:{'\u00a0'}
                <input type="checkbox" checked={props.isChecked} onChange={handleClickTranspose} />
            </label>
        );
    };

    /**
     *
     */
    const CTTableModForm = (props) => {

        return (
            <form>
                <fieldset>
                    <legend>{mixins.translate('freq__ct_parameters_legend')}</legend>
                    <ul className="items">
                        <li>
                            <QuantitySelect currVal={props.viewQuantity} changeQuantity={props.changeQuantity} />
                        </li>
                        <li>
                            <MinFreqInput currVal={props.minAbsFreq} />
                        </li>
                        <li>
                            <EmptyVectorVisibilitySwitch hideEmptyVectors={props.hideEmptyVectors} />
                        </li>
                        <li>
                            <TransposeTableCheckbox isChecked={props.transposeIsChecked} />
                        </li>
                    </ul>
                </fieldset>
            </form>
        );
    };

    /**
     *
     */
    const CTCellMenu = (props) => {

        const handlePosClick = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_QUICK_FILTER_CONCORDANCE',
                props: {
                    args: props.pfilter
                }
            });
        };

        const handleCloseClick = () => {
            props.onClose();
        };

        return (
            <layoutViews.PopupBox onCloseClick={handleCloseClick} customClass="menu">
                <fieldset className="detail">
                    <legend>{mixins.translate('freq__ct_detail_legend')}</legend>
                    {mixins.translate('freq__ct_ipm_freq_label')}:
                    {'\u00a0'}{mixins.formatNumber(props.data.ipm, 1)}
                    <br />
                    {mixins.translate('freq__ct_abs_freq_label')}:
                    {'\u00a0'}{mixins.formatNumber(props.data.abs, 0)}
                </fieldset>
                <form>
                    <fieldset>
                        <legend>{mixins.translate('freq__ct_pfilter_legend')}</legend>
                        <table>
                            <tbody>
                                <tr>
                                    <th>
                                        {props.attr1}:
                                    </th>
                                    <td>
                                        <input type="text" readonly value={props.label1} />
                                    </td>
                                </tr>
                                <tr>
                                    <th>
                                        {props.attr2}:
                                    </th>
                                    <td>
                                        <input type="text" readonly value={props.label2} />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <button type="button" className="default-button"
                                onClick={handlePosClick}>
                            {mixins.translate('freq__ct_pfilter_btn_label')}
                        </button>
                    </fieldset>
                </form>
            </layoutViews.PopupBox>
        );
    };

    /**
     *
     */
    const CTCell = (props) => {

        const getValue = () => {
            if (isNonEmpty()) {
                switch (props.quantity) {
                    case 'ipm':
                        return mixins.formatNumber(props.data.ipm, 1);
                    case 'abs':
                        return mixins.formatNumber(props.data.abs, 0);
                    default:
                        return NaN;
                }

            } else {
                return '';
            }
        };

        const isNonEmpty = () => {
            const v = (() => {
                switch (props.quantity) {
                    case 'ipm':
                        return props.data ? props.data.ipm : 0;
                    case 'abs':
                        return props.data ? props.data.abs : 0;
                    default:
                        return NaN;
                }
            })();
            return v > 0;
        };

        const handleItemClick = () => {
            props.onClick();
        };

        if (isNonEmpty()) {
            const bgStyle = {};
            const linkStyle = {color: color2str(calcTextColorFromBg(importColor(props.data.bgColor, 1)))}
            const tdClasses = ['data-cell'];
            if (props.isHighlighted) {
                tdClasses.push('highlighted');

            } else {
                bgStyle['backgroundColor'] = props.data.bgColor;
            }
            return (
                <td className={tdClasses.join(' ')} style={bgStyle}>
                    <a onClick={handleItemClick} style={linkStyle}
                            title={mixins.translate('freq__ct_click_for_details')}>
                        {getValue()}
                    </a>
                    {props.isHighlighted ? <CTCellMenu onClose={props.onClose}
                                                        data={props.data}
                                                        attr1={props.attr1}
                                                        label1={props.label1}
                                                        attr2={props.attr2}
                                                        label2={props.label2} /> : null}
                </td>
            );

        } else {
            return <td className="empty-cell" />;
        }
    };

    /**
     *
     */
    class CTFreqResultView extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchState();
            this._changeQuantity = this._changeQuantity.bind(this);
            this._handleStoreChange = this._handleStoreChange.bind(this);
            this._highlightItem = this._highlightItem.bind(this);
            this._resetHighlight = this._resetHighlight.bind(this);
        }

        _fetchState() {
            return {
                d1Labels: ctFreqDataRowsStore.getD1Labels(),
                d2Labels: ctFreqDataRowsStore.getD2Labels(),
                data: ctFreqDataRowsStore.getData(),
                attr1: ctFreqDataRowsStore.getAttr1(),
                attr2: ctFreqDataRowsStore.getAttr2(),
                adHocSubcWarning: ctFreqDataRowsStore.getQueryContainsWithin(),
                minAbsFreq: ctFreqDataRowsStore.getMinAbsFreq(),
                viewQuantity: 'ipm',
                highlightedCoord: null,
                transposeIsChecked: ctFreqDataRowsStore.getIsTransposed(),
                hideEmptyVectors: ctFreqDataRowsStore.getFilterZeroVectors()
            };
        }

        _changeQuantity(q) {
            const state = this._fetchState();
            state.viewQuantity = q;
            this.setState(state);
        }

        _handleStoreChange() {
            const newState = this._fetchState();
            newState.viewQuantity = this.state.viewQuantity;
            newState.highlightedCoord = this.state.highlightedCoord;
            this.setState(newState);
        }

        componentDidMount() {
            ctFreqDataRowsStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            ctFreqDataRowsStore.removeChangeListener(this._handleStoreChange);
        }

        _renderWarning() {
            if (this.state.adHocSpfilterVisibleubcWarning) {
                return (
                    <p className="warning">
                        <img src={mixins.createStaticUrl('img/warning-icon.svg')}
                                alt={mixins.translate('global__warning')} />
                        {mixins.translate('freq__ct_uses_ad_hoc_subcorpus_warn')}
                    </p>
                );
            }
        }

        _labels1() {
            return this.state.d1Labels.filter(x => x[1]).map(x => x[0]);
        }

        _labels2() {
            return this.state.d2Labels.filter(x => x[1]).map(x => x[0]);
        }

        _resetHighlight() {
            const newState = this._fetchState();
            newState.viewQuantity = this.state.viewQuantity;
            newState.highlightedCoord = null;
            this.setState(newState);
        }

        _highlightItem(i, j) {
            this._resetHighlight();
            const newState = this._fetchState();
            newState.viewQuantity = this.state.viewQuantity;
            newState.highlightedCoord = [i, j];
            this.setState(newState);
        }

        _isHighlighted(i, j) {
            return this.state.highlightedCoord !== null &&
                    this.state.highlightedCoord[0] === i &&
                    this.state.highlightedCoord[1] === j;
        }

        _isHighlightedRow(i) {
            return this.state.highlightedCoord !== null && this.state.highlightedCoord[0] === i;
        }

        _isHighlightedCol(j) {
            return this.state.highlightedCoord !== null && this.state.highlightedCoord[1] === j;
        }

        render() {
            return (
                <div className="CTFreqResultView">
                    {this._renderWarning()}
                    <div className="toolbar">
                        <CTTableModForm
                                minAbsFreq={this.state.minAbsFreq}
                                viewQuantity={this.state.viewQuantity}
                                changeQuantity={this._changeQuantity}
                                hideEmptyVectors={this.state.hideEmptyVectors}
                                transposeIsChecked={this.state.transposeIsChecked} />
                    </div>
                    <table className="ct-data">
                        <tbody>
                            <tr>
                                <th className="attr-label">
                                    {this.state.attr1} {'\u005C'} {this.state.attr2}
                                </th>
                                {this._labels2().map((label2, i) =>
                                    <th key={`lab-${i}`} className={this._is}
                                        className={this._isHighlightedCol(i) ? 'highlighted' : null}>{label2}</th>)}
                            </tr>
                            {this._labels1().map((label1, i) => {
                                const htmlClass = ['vert'];
                                if (this._isHighlightedRow(i)) {
                                    htmlClass.push('highlighted');
                                }
                                return (
                                    <tr key={`row-${i}`}>
                                        <th className={htmlClass.join(' ')}><span>{label1}</span></th>
                                        {this._labels2().map((label2, j) => {
                                            return <CTCell data={this.state.data[label1][label2]} key={`c-${i}:${j}`}
                                                            quantity={this.state.viewQuantity}
                                                            onClick={()=>this._highlightItem(i, j)}
                                                            onClose={this._resetHighlight}
                                                            attr1={this.state.attr1}
                                                            label1={label1}
                                                            attr2={this.state.attr2}
                                                            label2={label2}
                                                            isHighlighted={this._isHighlighted(i, j)} />;
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            );
        }
    }

    return {
        CTFreqResultView: CTFreqResultView
    };

}
