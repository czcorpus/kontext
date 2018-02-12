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
/// <reference path="../../vendor.d.ts/react.d.ts" />
/// <reference path="../../vendor.d.ts/immutable.d.ts" />

import * as React from 'vendor/react';
import {init as inputInit} from './input';
import {FilterStore} from '../../stores/query/filter';
import {QueryHintStore} from '../../stores/query/main';
import {WithinBuilderStore} from '../../stores/query/withinBuilder';
import {VirtualKeyboardStore} from '../../stores/query/virtualKeyboard';
import {FirstHitsStore} from '../../stores/query/firstHits';



export interface FilterFormViews {
    FilterForm:React.ComponentClass;
    SubHitsForm:React.ComponentClass;
    FirstHitsForm:React.ComponentClass;
}

// ---------

export interface FilterFormProps {
    filterId:string;
    operationIdx:number;
    tagHelperView:React.Component<{}, {}>; // TODO types
    queryStorageView:React.Component<{}, {}>; // TODO types
    actionPrefix:string;
}

export interface FilterFormState {
    contextFormVisible:boolean;
    inclKwicValue:boolean;
    withinArg:number;
    queryTypes:Immutable.Map<string, string>;
    supportedWidgets:Immutable.Map<string, Immutable.List<string>>;
    lposValues:Immutable.Map<string, string>;
    matchCaseValues:Immutable.Map<string, boolean>;
    forcedAttr:string;
    defaultAttrValues:Immutable.Map<string, string>;
    attrList:Immutable.List<Kontext.AttrItem>;
    tagsetDocUrl:string;
    lemmaWindowSizes:Immutable.List<number>;
    posWindowSizes:Immutable.List<number>;
    hasLemmaAttr:boolean;
    wPoSList:Immutable.List<{v:string; n:string}>;
    inputLanguage:string;
    pnFilterValue:string;
    filfposValue:string;
    filtposValue:string;
    filflValue:string;
    isLocked:boolean;
    tagAttr:string;
    useCQLEditor:boolean;
}

// ---------

export interface SubHitsFormProps {
    operationIdx:number;
    opKey:string;
    submitFn:()=>void;
}

export interface SubHitsFormState {
    isAutoSubmit:boolean;
}

// ---------

export interface FirstHitsFormProps {
    operationIdx:number;
    opKey:string;
}

export interface FirstHitsFormState {
    isAutoSubmit:boolean;
    docStructs:Immutable.Map<string, string>;
}

// ---------

export function init(
        dispatcher:Kontext.FluxDispatcher,
        he:Kontext.ComponentHelpers,
        filterStore:FilterStore,
        queryHintStore:QueryHintStore,
        withinBuilderStore:WithinBuilderStore,
        virtualKeyboardStore:VirtualKeyboardStore,
        firstHitsStore:FirstHitsStore):FilterFormViews {

    const inputViews = inputInit(dispatcher, he, filterStore, queryHintStore, withinBuilderStore,
                virtualKeyboardStore);

    const layoutViews = he.getLayoutViews();

    // -------- <FilterForm /> ---------------------------------------

    class FilterForm extends React.Component<FilterFormProps, FilterFormState> {

        constructor(props) {
            super(props);
            this._keyEventHandler = this._keyEventHandler.bind(this);
            this._storeChangeHandler = this._storeChangeHandler.bind(this);
            this._handlePosNegSelect = this._handlePosNegSelect.bind(this);
            this._handleSelTokenSelect = this._handleSelTokenSelect.bind(this);
            this._handleToFromRangeValChange = this._handleToFromRangeValChange.bind(this);
            this._handleSubmit = this._handleSubmit.bind(this);
            this._handleInclKwicCheckbox = this._handleInclKwicCheckbox.bind(this);
            this.state = this._fetchState();
        }

        _fetchState() {
            return {
                queryTypes: filterStore.getQueryTypes(),
                supportedWidgets: filterStore.getSupportedWidgets(),
                lposValues: filterStore.getLposValues(),
                matchCaseValues: filterStore.getMatchCaseValues(),
                forcedAttr: filterStore.getForcedAttr(),
                defaultAttrValues: filterStore.getDefaultAttrValues(),
                attrList: filterStore.getAttrList(),
                tagsetDocUrl: filterStore.getTagsetDocUrls().get(this.props.filterId),
                lemmaWindowSizes: filterStore.getLemmaWindowSizes(),
                posWindowSizes: filterStore.getPosWindowSizes(),
                hasLemmaAttr: filterStore.getHasLemmaAttr().get(this.props.filterId),
                wPoSList: filterStore.getwPoSList(),
                contextFormVisible: false,
                inputLanguage: filterStore.getInputLanguage(),
                pnFilterValue: filterStore.getPnFilterValues().get(this.props.filterId),
                filfposValue: filterStore.getFilfposValues().get(this.props.filterId),
                filtposValue: filterStore.getFiltposValues().get(this.props.filterId),
                filflValue: filterStore.getFilflValues().get(this.props.filterId),
                inclKwicValue: filterStore.getInclKwicValues().get(this.props.filterId),
                isLocked: filterStore.getOpLocks().get(this.props.filterId),
                withinArg: filterStore.getWithinArgs().get(this.props.filterId),
                useCQLEditor: filterStore.getUseCQLEditor(),
                tagAttr: filterStore.getTagAttr()
            };
        }

        _keyEventHandler(evt) {
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
        }

        _storeChangeHandler() {
            const ans = this._fetchState();
            ans['contextFormVisible'] = this.state.contextFormVisible;
            this.setState(ans);
        }

        componentDidMount() {
            filterStore.addChangeListener(this._storeChangeHandler);
        }

        componentWillUnmount() {
            filterStore.removeChangeListener(this._storeChangeHandler);
        }

        _handlePosNegSelect(evt) {
            dispatcher.dispatch({
                actionType: 'FILTER_QUERY_SET_POS_NEG',
                props: {
                    filterId: this.props.filterId,
                    value: evt.target.value
                }
            });
        }

        _handleSelTokenSelect(evt) {
            dispatcher.dispatch({
                actionType: 'FILTER_QUERY_SET_FILFL',
                props: {
                    filterId: this.props.filterId,
                    value: evt.target.value
                }
            });
        }

        _handleToFromRangeValChange(pos, evt) {
            dispatcher.dispatch({
                actionType: 'FILTER_QUERY_SET_RANGE',
                props: {
                    filterId: this.props.filterId,
                    rangeId: ({from: 'filfpos', to: 'filtpos'})[pos],
                    value: evt.target.value
                }
            });
        }

        _handleSubmit() {
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
        }

        _handleInclKwicCheckbox(evt) {
            dispatcher.dispatch({
                actionType: 'FILTER_QUERY_SET_INCL_KWIC',
                props: {
                    filterId: this.props.filterId,
                    value: !this.state.inclKwicValue
                }
            });
        }

        _renderForm() {
            if (this.state.withinArg === 1) {
                return this._renderSwitchMaincorpForm();

            } else {
                return this._renderFullForm();
            }
        }

        _renderSwitchMaincorpForm() {
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
                                actionPrefix={this.props.actionPrefix}
                                tagAttr={this.state.tagAttr} />
                        </tbody>
                    </table>
                    <div className="buttons">
                        <button type="button" className="default-button" onClick={this._handleSubmit}>
                            {this.props.operationIdx !== undefined ?
                                he.translate('global__proceed')
                                : he.translate('query__search_btn')}
                        </button>
                    </div>
                </form>
            );
        }

        _renderFullForm() {
            return (
                <form className="query-form" onKeyDown={this._keyEventHandler}>
                    <table className="form">
                        <tbody>
                            <tr>
                                <th>{he.translate('query__filter_th')}:</th>
                                <td>
                                    <select value={this.state.pnFilterValue} onChange={this._handlePosNegSelect}>
                                        <option value="p">{he.translate('query__qfilter_pos')}</option>
                                        <option value="n">{he.translate('query__qfilter_neg')}</option>
                                    </select>
                                </td>
                            </tr>
                            {this.state.pnFilterValue === 'p' ?
                                (<tr>
                                    <th>{he.translate('query__qlfilter_sel_token')}:</th>
                                    <td>
                                        <select onChange={this._handleSelTokenSelect}
                                                value={this.state.filflValue}>
                                            <option value="f">{he.translate('query__token_first')}</option>
                                            <option value="l">{he.translate('query__token_last')}</option>
                                        </select>
                                        {'\u00a0'}
                                        <span className="hint">
                                            ({he.translate('query__qlfilter_sel_token_hint')})
                                        </span>
                                    </td>
                                </tr>) : null
                            }
                            <tr>
                                <th>{he.translate('query__qfilter_range_srch_th')}:</th>
                                <td>
                                    <label>
                                        {he.translate('query__qfilter_range_from')}:{'\u00a0'}
                                        <input type="text" style={{width: '3em'}}
                                            value={this.state.filfposValue}
                                            onChange={this._handleToFromRangeValChange.bind(this, 'from')} />
                                    </label>
                                    {'\u00a0'}
                                    <label>
                                        {he.translate('query__qfilter_range_to')}:{'\u00a0'}
                                        <input type="text" style={{width: '3em'}}
                                        value={this.state.filtposValue}
                                            onChange={this._handleToFromRangeValChange.bind(this, 'to')} />
                                    </label>
                                    {'\u00a0,\u00a0'}
                                    <label>
                                        {he.translate('query__qfilter_include_kwic')}
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
                                he.translate('global__proceed')
                                : he.translate('query__search_btn')}
                        </button>
                    </div>
                </form>
            );
        }

        render() {
            if (this.state.isLocked) {
                return (
                    <div>
                        <img src={he.createStaticUrl('img/info-icon.svg')} alt={he.translate('global__info_icon')}
                                style={{verticalAlign: 'middle', marginLeft: '0.7em'}} />
                        {he.translate('query__operation_is_automatic_and_cannot_be_changed')}
                    </div>
                );

            } else {
                return this._renderForm();
            }
        }
    }


    /**
     *
     */
    class SubHitsForm extends React.Component<SubHitsFormProps, SubHitsFormState> {

        constructor(props) {
            super(props);
            this.state = {
                isAutoSubmit: this.props.operationIdx === undefined
            }
        }

        render() {
            return (
                <form>
                    {this._renderContents()}
                </form>
            );
        }

        componentDidMount() {
            if (this.state.isAutoSubmit) {
                window.setTimeout(() => {
                    this.props.submitFn();
                }, 0);
            }
        }

        _renderContents() {
            if (this.state.isAutoSubmit) {
                return this._renderAutoSubmitState();

            } else {
                return this._renderDefaultState();
            }
        }

        _renderAutoSubmitState() {
            return <div><layoutViews.AjaxLoaderBarImage /></div>;
        }

        _renderDefaultState() {
            return (
                <div>
                    <p>{he.translate('query__the_form_no_params_to_change')}.</p>
                    <p>
                        <button type="button" className="default-button"
                                    onClick={()=>this.props.submitFn()}>
                            {he.translate('global__proceed')}
                        </button>
                    </p>
                </div>
            );
        }
    }

    /**
     *
     */
    class FirstHitsForm extends React.Component<FirstHitsFormProps, FirstHitsFormState> {

        constructor(props) {
            super(props);
            this.state = {
                isAutoSubmit: this.props.operationIdx === undefined,
                docStructs: firstHitsStore.getDocStructValues()
            }
            this._handleSubmit = this._handleSubmit.bind(this);
        }

        render() {
            return (
                <form>
                    {this._renderContents()}
                </form>
            );
        }

        componentDidMount() {
            if (this.state.isAutoSubmit) {
                window.setTimeout(this._handleSubmit, 0);
            }
        }

        _handleSubmit() {
            if (this.props.operationIdx !== undefined) {
                dispatcher.dispatch({
                    actionType: 'BRANCH_QUERY',
                    props: {operationIdx: this.props.operationIdx}
                });

            } else {
                dispatcher.dispatch({
                    actionType: 'FILTER_FIRST_HITS_SUBMIT',
                    props: {
                        opKey: this.props.opKey
                    }
                });
            }
        }

        _renderContents() {
            if (this.state.isAutoSubmit) {
                return this._renderAutoSubmitState();

            } else {
                return this._renderDefaultState();
            }
        }

        _renderAutoSubmitState() {
            return <div><layoutViews.AjaxLoaderBarImage /></div>;
        }

        _renderDefaultState() {
            return (
                <div>
                    <label>
                        {he.translate('query__used_first_hits_struct')}:{'\u00a0'}
                        <select disabled>
                            <option>{this.state.docStructs.get(this.props.opKey)}</option>
                        </select>
                    </label>
                    <p>{he.translate('query__the_form_no_params_to_change')}.</p>
                    <p>
                        <button type="button" className="default-button"
                                    onClick={this._handleSubmit}>
                            {he.translate('global__proceed')}
                        </button>
                    </p>
                </div>
            );
        }
    }

    return {
        FilterForm: FilterForm,
        SubHitsForm: SubHitsForm,
        FirstHitsForm: FirstHitsForm
    };
}