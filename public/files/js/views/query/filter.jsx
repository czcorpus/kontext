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


import React from 'vendor/react';
import {init as inputInit} from './input';


export function init(dispatcher, mixins, layoutViews, filterStore, queryHintStore, withinBuilderStore, virtualKeyboardStore) {

    const inputViews = inputInit(
        dispatcher, mixins, layoutViews, filterStore, queryHintStore, withinBuilderStore, virtualKeyboardStore);

    // -------- <FilterForm /> ---------------------------------------

    const FilterForm = React.createClass({

        mixins : mixins,

        _fetchState : function () {
            return {
                queryTypes: filterStore.getQueryTypes(),
                supportedWidgets: filterStore.getSupportedWidgets(),
                lposValues: filterStore.getLposValues(),
                matchCaseValues: filterStore.getMatchCaseValues(),
                forcedAttr: filterStore.getForcedAttr(),
                defaultAttrValues: filterStore.getDefaultAttrValues(),
                attrList: filterStore.getAttrList(),
                tagsetDocUrl: filterStore.getTagsetDocUrl(),
                lemmaWindowSizes: filterStore.getLemmaWindowSizes(),
                posWindowSizes: filterStore.getPosWindowSizes(),
                hasLemmaAttr: filterStore.getHasLemmaAttr(),
                wPoSList: filterStore.getwPoSList(),
                contextFormVisible: false,
                inputLanguage: filterStore.getInputLanguage(),
                pnFilterValue: filterStore.getPnFilterValues().get(this.props.filterId),
                filfposValue: filterStore.getFilfposValues().get(this.props.filterId),
                filtposValue: filterStore.getFiltposValues().get(this.props.filterId),
                filflValue: filterStore.getFilflValues().get(this.props.filterId),
                inclKwicValue: filterStore.getInclKwicValues().get(this.props.filterId),
                isLocked: filterStore.getOpLocks().get(this.props.filterId),
                withinArg: filterStore.getWithinArgs().get(this.props.filterId)
            };
        },

        _keyEventHandler : function (evt) {
            if (evt.keyCode === 13 && !evt.ctrlKey && !evt.shiftKey) {
                if (this.props.operationIdx !== undefined) {
                    dispatcher.dispatch({
                        actionType: 'BRANCH_QUERY',
                        props: {operationIdx: this.props.operationIdx}
                    });

                } else {
                    dispatcher.dispatch({
                        actionType: 'FILTER_QUERY_APPLY_FILTER',
                        props: {
                            filterId: this.props.filterId
                        }
                    });
                }
                evt.stopPropagation();
                evt.preventDefault();
            }
        },

        getInitialState : function () {
            return this._fetchState();
        },

        _storeChangeHandler : function () {
            const ans = this._fetchState();
            ans['contextFormVisible'] = this.state.contextFormVisible;
            this.setState(ans);
        },

        componentDidMount : function () {
            filterStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            filterStore.removeChangeListener(this._storeChangeHandler);
        },

        _handlePosNegSelect : function (evt) {
            dispatcher.dispatch({
                actionType: 'FILTER_QUERY_SET_POS_NEG',
                props: {
                    filterId: this.props.filterId,
                    value: evt.target.value
                }
            });
        },

        _handleSelTokenSelect : function (evt) {
            dispatcher.dispatch({
                actionType: 'FILTER_QUERY_SET_FILFL',
                props: {
                    filterId: this.props.filterId,
                    value: evt.target.value
                }
            });
        },

        _handleToFromRangeValChange : function (pos, evt) {
            dispatcher.dispatch({
                actionType: 'FILTER_QUERY_SET_RANGE',
                props: {
                    filterId: this.props.filterId,
                    rangeId: ({from: 'filfpos', to: 'filtpos'})[pos],
                    value: evt.target.value
                }
            });
        },

        _handleSubmit : function () {
            if (this.props.operationIdx !== undefined) {
                dispatcher.dispatch({
                    actionType: 'BRANCH_QUERY',
                    props: {operationIdx: this.props.operationIdx}
                });

            } else {
                dispatcher.dispatch({
                    actionType: 'FILTER_QUERY_APPLY_FILTER',
                    props: {
                        filterId: this.props.filterId
                    }
                });
            }
        },

        _handleInclKwicCheckbox : function (evt) {
            dispatcher.dispatch({
                actionType: 'FILTER_QUERY_SET_INCL_KWIC',
                props: {
                    filterId: this.props.filterId,
                    value: !this.state.inclKwicValue
                }
            });
        },

        _renderForm : function () {
            if (this.state.withinArg === 1) {
                return this._renderSwitchMaincorpForm();

            } else {
                return this._renderFullForm();
            }
        },

        _renderSwitchMaincorpForm : function () {
            return (
                <form className="query-form" onKeyDown={this._keyEventHandler}>
                    <table className="form">
                        <tbody>
                            <inputViews.TRQueryInputField
                                queryType={this.state.queryTypes.get(this.props.filterId)}
                                widgets={this.state.supportedWidgets.get(this.props.filterId)}
                                sourceId={this.props.filterId}
                                wPoSList={this.state.wPoSList}
                                lposValue={this.state.lposValues.get(this.props.filterId)}
                                matchCaseValue={this.state.matchCaseValues.get(this.props.filterId)}
                                forcedAttr={this.state.forcedAttr}
                                defaultAttr={this.state.defaultAttrValues.get(this.props.filterId)}
                                attrList={this.state.attrList}
                                tagsetDocUrl={this.state.tagsetDocUrl}
                                tagHelperView={this.props.tagHelperView}
                                queryStorageView={this.props.queryStorageView}
                                inputLanguage={this.state.inputLanguage}
                                actionPrefix={this.props.actionPrefix} />
                        </tbody>
                    </table>
                    <div className="buttons">
                        <button type="button" className="default-button" onClick={this._handleSubmit}>
                            {this.props.operationIdx !== undefined ?
                                this.translate('global__proceed')
                                : this.translate('query__search_btn')}
                        </button>
                    </div>
                </form>
            );
        },

        _renderFullForm : function () {
            return (
                <form className="query-form" onKeyDown={this._keyEventHandler}>
                    <table className="form">
                        <tbody>
                            <tr>
                                <th>{this.translate('query__filter_th')}:</th>
                                <td>
                                    <select value={this.state.pnFilterValue} onChange={this._handlePosNegSelect}>
                                        <option value="p">{this.translate('query__qfilter_pos')}</option>
                                        <option value="n">{this.translate('query__qfilter_neg')}</option>
                                    </select>
                                </td>
                            </tr>
                            {this.state.pnFilterValue === 'p' ?
                                (<tr>
                                    <th>{this.translate('query__qlfilter_sel_token')}:</th>
                                    <td>
                                        <select onChange={this._handleSelTokenSelect}
                                                value={this.state.filflValue}>
                                            <option value="f">{this.translate('query__token_first')}</option>
                                            <option value="l">{this.translate('query__token_last')}</option>
                                        </select>
                                        {'\u00a0'}
                                        <span className="hint">
                                            ({this.translate('query__qlfilter_sel_token_hint')})
                                        </span>
                                    </td>
                                </tr>) : null
                            }
                            <tr>
                                <th>{this.translate('query__qfilter_range_srch_th')}:</th>
                                <td>
                                    <label>
                                        {this.translate('query__qfilter_range_from')}:{'\u00a0'}
                                        <input type="text" style={{width: '3em'}}
                                            value={this.state.filfposValue}
                                            onChange={this._handleToFromRangeValChange.bind(this, 'from')} />
                                    </label>
                                    {'\u00a0'}
                                    <label>
                                        {this.translate('query__qfilter_range_to')}:{'\u00a0'}
                                        <input type="text" style={{width: '3em'}}
                                        value={this.state.filtposValue}
                                            onChange={this._handleToFromRangeValChange.bind(this, 'to')} />
                                    </label>
                                    {'\u00a0,\u00a0'}
                                    <label>
                                        {this.translate('query__qfilter_include_kwic')}
                                        <input type="checkbox" checked={this.state.inclKwicValue}
                                            onChange={this._handleInclKwicCheckbox} />
                                    </label>
                                </td>
                            </tr>
                        </tbody>
                        <tbody>
                            <inputViews.TRQueryTypeField
                                queryType={this.state.queryTypes.get(this.props.filterId)}
                                sourceId={this.props.filterId}
                                actionPrefix={this.props.actionPrefix}
                                hasLemmaAttr={this.state.hasLemmaAttr} />
                        </tbody>
                        <tbody>
                            <inputViews.TRQueryInputField
                                queryType={this.state.queryTypes.get(this.props.filterId)}
                                widgets={this.state.supportedWidgets.get(this.props.filterId)}
                                sourceId={this.props.filterId}
                                wPoSList={this.state.wPoSList}
                                lposValue={this.state.lposValues.get(this.props.filterId)}
                                matchCaseValue={this.state.matchCaseValues.get(this.props.filterId)}
                                forcedAttr={this.state.forcedAttr}
                                defaultAttr={this.state.defaultAttrValues.get(this.props.filterId)}
                                attrList={this.state.attrList}
                                tagsetDocUrl={this.state.tagsetDocUrl}
                                tagHelperView={this.props.tagHelperView}
                                queryStorageView={this.props.queryStorageView}
                                inputLanguage={this.state.inputLanguage}
                                actionPrefix={this.props.actionPrefix} />
                        </tbody>
                    </table>
                    <div className="buttons">
                        <button type="button" className="default-button" onClick={this._handleSubmit}>
                            {this.props.operationIdx !== undefined ?
                                this.translate('global__proceed')
                                : this.translate('query__search_btn')}
                        </button>
                    </div>
                </form>
            );
        },

        render : function () {
            if (this.state.isLocked) {
                return (
                    <div>
                        <img src={this.createStaticUrl('img/info-icon.svg')} alt={this.translate('global__info_icon')}
                                style={{verticalAlign: 'middle', marginLeft: '0.7em'}} />
                        {this.translate('query__operation_is_automatic_and_cannot_be_changed')}
                    </div>
                );

            } else {
                return this._renderForm();
            }
        }
    });

    return {
        FilterForm: FilterForm
    };
}