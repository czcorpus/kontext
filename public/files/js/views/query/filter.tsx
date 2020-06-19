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

import * as React from 'react';
import * as Immutable from 'immutable';
import { IActionDispatcher } from 'kombo';

import { Kontext } from '../../types/common';
import { init as inputInit } from './input';
import { FilterFormModel } from '../../models/query/filter';
import { WidgetsMap } from '../../models/query/common';
import { WithinBuilderModel } from '../../models/query/withinBuilder';
import { VirtualKeyboardModel } from '../../models/query/virtualKeyboard';
import { FirstHitsModel } from '../../models/query/firstHits';
import { CQLEditorModel } from '../../models/query/cqleditor/model';
import { PluginInterfaces } from '../../types/plugins';
import { UsageTipsModel } from '../../models/usageTips';
import { ActionName, Actions } from '../../models/query/actions';
import { Keyboard } from 'cnc-tskit';



export interface FilterFormViews {
    FilterForm:React.ComponentClass<FilterFormProps>;
    SubHitsForm:React.ComponentClass<SubHitsFormProps>;
    FirstHitsForm:React.ComponentClass<FirstHitsFormProps>;
}

// ---------

export interface FilterFormProps {
    formType:Kontext.ConcFormTypes.FILTER;
    filterId:string;
    operationIdx?:number;
    tagHelperView:PluginInterfaces.TagHelper.View;
    queryStorageView:PluginInterfaces.QueryStorage.WidgetView;
    actionPrefix:string;
}

export interface FilterFormState {
    contextFormVisible:boolean;
    inclKwicValue:boolean;
    withinArg:number;
    queryTypes:Immutable.Map<string, string>;
    supportedWidgets:WidgetsMap;
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
    filfposValue:Kontext.FormValue<string>;
    filtposValue:Kontext.FormValue<string>;
    filflValue:string;
    isLocked:boolean;
    tagAttr:string;
    useCQLEditor:boolean;
}

// ---------

export interface SubHitsFormProps {
    formType:Kontext.ConcFormTypes.SUBHITS;
    operationIdx?:number;
    opKey:string;
    submitFn:()=>void;
}

export interface SubHitsFormState {
    isAutoSubmit:boolean;
}

// ---------

export interface FirstHitsFormProps {
    formType:Kontext.ConcFormTypes.FIRSTHITS;
    operationIdx?:number;
    opKey:string;
}

export interface FirstHitsFormState {
    isAutoSubmit:boolean;
    docStructs:Immutable.Map<string, string>;
}

// ---------

export function init(
        dispatcher:IActionDispatcher,
        he:Kontext.ComponentHelpers,
        filterModel:FilterFormModel,
        queryHintModel:UsageTipsModel,
        withinBuilderModel:WithinBuilderModel,
        virtualKeyboardModel:VirtualKeyboardModel,
        firstHitsModel:FirstHitsModel,
        cqlEditorModel:CQLEditorModel):FilterFormViews {

    const inputViews = inputInit({
        dispatcher: dispatcher,
        he: he,
        queryModel: filterModel,
        queryHintModel: queryHintModel,
        withinBuilderModel: withinBuilderModel,
        virtualKeyboardModel: virtualKeyboardModel,
        cqlEditorModel: cqlEditorModel
    });

    const layoutViews = he.getLayoutViews();

    // -------- <FilterForm /> ---------------------------------------

    class FilterForm extends React.PureComponent<FilterFormProps & FilterFormState> {

        constructor(props) {
            super(props);
            this._keyEventHandler = this._keyEventHandler.bind(this);
            this._handlePosNegSelect = this._handlePosNegSelect.bind(this);
            this._handleSelTokenSelect = this._handleSelTokenSelect.bind(this);
            this._handleToFromRangeValChange = this._handleToFromRangeValChange.bind(this);
            this._handleSubmit = this._handleSubmit.bind(this);
            this._handleInclKwicCheckbox = this._handleInclKwicCheckbox.bind(this);
        }

        _handlePosNegSelect(evt) {
            dispatcher.dispatch({
                name: 'FILTER_QUERY_SET_POS_NEG',
                payload: {
                    filterId: this.props.filterId,
                    value: evt.target.value
                }
            });
        }

        _handleSelTokenSelect(evt) {
            dispatcher.dispatch({
                name: 'FILTER_QUERY_SET_FILFL',
                payload: {
                    filterId: this.props.filterId,
                    value: evt.target.value
                }
            });
        }

        _handleToFromRangeValChange(pos, evt) {
            dispatcher.dispatch({
                name: 'FILTER_QUERY_SET_RANGE',
                payload: {
                    filterId: this.props.filterId,
                    rangeId: ({from: 'filfpos', to: 'filtpos'})[pos],
                    value: evt.target.value
                }
            });
        }

        _keyEventHandler(evt) {
            if (evt.keyCode === Keyboard.Code.ENTER && !evt.ctrlKey && !evt.shiftKey) {
                if (this.props.operationIdx !== undefined) {
                    dispatcher.dispatch<Actions.BranchQuery>({
                        name: ActionName.BranchQuery,
                        payload: {operationIdx: this.props.operationIdx}
                    });

                } else {
                    dispatcher.dispatch({
                        name: 'FILTER_QUERY_APPLY_FILTER',
                        payload: {
                            filterId: this.props.filterId
                        }
                    });
                }
                evt.stopPropagation();
                evt.preventDefault();
            }
        }

        _handleSubmit() {
            if (this.props.operationIdx !== undefined) {
                dispatcher.dispatch<Actions.BranchQuery>({
                    name: ActionName.BranchQuery,
                    payload: {operationIdx: this.props.operationIdx}
                });

            } else {
                dispatcher.dispatch({
                    name: 'FILTER_QUERY_APPLY_FILTER',
                    payload: {
                        filterId: this.props.filterId
                    }
                });
            }
        }

        _handleInclKwicCheckbox(evt) {
            dispatcher.dispatch({
                name: 'FILTER_QUERY_SET_INCL_KWIC',
                payload: {
                    filterId: this.props.filterId,
                    value: !this.props.inclKwicValue
                }
            });
        }

        _renderForm() {
            if (this.props.withinArg === 1) {
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
                            <inputViews.TRQueryTypeField
                                queryType={this.props.queryTypes.get(this.props.filterId)}
                                sourceId={this.props.filterId}
                                actionPrefix={this.props.actionPrefix}
                                hasLemmaAttr={this.props.hasLemmaAttr} />
                        </tbody>
                        <tbody>
                            <inputViews.TRQueryInputField
                                queryType={this.props.queryTypes.get(this.props.filterId)}
                                widgets={this.props.supportedWidgets.get(this.props.filterId)}
                                sourceId={this.props.filterId}
                                wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValues.get(this.props.filterId)}
                                matchCaseValue={this.props.matchCaseValues.get(this.props.filterId)}
                                forcedAttr={this.props.forcedAttr}
                                defaultAttr={this.props.defaultAttrValues.get(this.props.filterId)}
                                attrList={this.props.attrList}
                                tagsetDocUrl={this.props.tagsetDocUrl}
                                tagHelperView={this.props.tagHelperView}
                                queryStorageView={this.props.queryStorageView}
                                inputLanguage={this.props.inputLanguage}
                                actionPrefix={this.props.actionPrefix}
                                useCQLEditor={this.props.useCQLEditor}
                                onEnterKey={this._handleSubmit} />
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
                                    <select value={this.props.pnFilterValue} onChange={this._handlePosNegSelect}>
                                        <option value="p">{he.translate('query__qfilter_pos')}</option>
                                        <option value="n">{he.translate('query__qfilter_neg')}</option>
                                    </select>
                                </td>
                            </tr>
                            {this.props.pnFilterValue === 'p' ?
                                (<tr>
                                    <th>{he.translate('query__qlfilter_sel_token')}:</th>
                                    <td>
                                        <select onChange={this._handleSelTokenSelect}
                                                value={this.props.filflValue}>
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
                                        <layoutViews.ValidatedItem invalid={this.props.filfposValue.isInvalid}>
                                            <input type="text" style={{width: '3em'}}
                                                value={this.props.filfposValue.value}
                                                onChange={this._handleToFromRangeValChange.bind(this, 'from')} />
                                        </layoutViews.ValidatedItem>
                                    </label>
                                    {'\u00a0'}
                                    <label>
                                        {he.translate('query__qfilter_range_to')}:{'\u00a0'}
                                        <layoutViews.ValidatedItem invalid={this.props.filtposValue.isInvalid}>
                                            <input type="text" style={{width: '3em'}}
                                                value={this.props.filtposValue.value}
                                                onChange={this._handleToFromRangeValChange.bind(this, 'to')} />
                                        </layoutViews.ValidatedItem>
                                    </label>
                                    {'\u00a0,\u00a0'}
                                    <label>
                                        {he.translate('query__qfilter_include_kwic')}
                                        <input type="checkbox" checked={this.props.inclKwicValue}
                                            onChange={this._handleInclKwicCheckbox} />
                                    </label>
                                </td>
                            </tr>
                        </tbody>
                        <tbody>
                            <inputViews.TRQueryTypeField
                                queryType={this.props.queryTypes.get(this.props.filterId)}
                                sourceId={this.props.filterId}
                                actionPrefix={this.props.actionPrefix}
                                hasLemmaAttr={this.props.hasLemmaAttr} />
                        </tbody>
                        <tbody>
                            <inputViews.TRQueryInputField
                                queryType={this.props.queryTypes.get(this.props.filterId)}
                                widgets={this.props.supportedWidgets.get(this.props.filterId)}
                                sourceId={this.props.filterId}
                                wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValues.get(this.props.filterId)}
                                matchCaseValue={this.props.matchCaseValues.get(this.props.filterId)}
                                forcedAttr={this.props.forcedAttr}
                                defaultAttr={this.props.defaultAttrValues.get(this.props.filterId)}
                                attrList={this.props.attrList}
                                tagsetDocUrl={this.props.tagsetDocUrl}
                                tagHelperView={this.props.tagHelperView}
                                queryStorageView={this.props.queryStorageView}
                                inputLanguage={this.props.inputLanguage}
                                actionPrefix={this.props.actionPrefix}
                                useCQLEditor={this.props.useCQLEditor}
                                onEnterKey={this._handleSubmit}
                                takeFocus={false} />
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
            if (this.props.isLocked) {
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
                docStructs: firstHitsModel.getDocStructValues()
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
                dispatcher.dispatch<Actions.BranchQuery>({
                    name: ActionName.BranchQuery,
                    payload: {operationIdx: this.props.operationIdx}
                });

            } else {
                dispatcher.dispatch({
                    name: 'FILTER_FIRST_HITS_SUBMIT',
                    payload: {
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