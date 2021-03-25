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
import { IActionDispatcher, BoundWithProps } from 'kombo';

import { Kontext } from '../../../types/common';
import { init as inputInit } from '../input';
import { FilterFormModel, FilterFormModelState } from '../../../models/query/filter';
import { FirstHitsModelState } from '../../../models/query/firstHits';
import { WithinBuilderModel } from '../../../models/query/withinBuilder';
import { VirtualKeyboardModel } from '../../../models/query/virtualKeyboard';
import { FirstHitsModel } from '../../../models/query/firstHits';
import { PluginInterfaces } from '../../../types/plugins';
import { UsageTipsModel } from '../../../models/usageTips';
import { ActionName, Actions } from '../../../models/query/actions';
import { Keyboard } from 'cnc-tskit';
import * as QS from '../first/style';
import * as S from './style';
import { SearchHistoryModel } from '../../../models/searchHistory';



export interface FilterFormViews {
    FilterForm:React.ComponentClass<FilterFormProps>;
    SubHitsForm:React.ComponentClass<SubHitsFormProps>;
    FirstHitsForm:React.ComponentClass<FirstHitsFormProps>;
}

// ---------

export interface FilterFormProps {
    formType:Kontext.ConcFormTypes.FILTER;
    filterId:string;
    corpname:string;
    operationIdx?:number;
    tagHelperView:PluginInterfaces.TagHelper.View;
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

// ---------

interface ViewInitArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    filterModel:FilterFormModel;
    queryHintModel:UsageTipsModel;
    withinBuilderModel:WithinBuilderModel;
    virtualKeyboardModel:VirtualKeyboardModel;
    firstHitsModel:FirstHitsModel;
    searchHistoryModel:SearchHistoryModel;
    querySuggest:PluginInterfaces.QuerySuggest.IPlugin;
}

export function init({
        dispatcher,
        he,
        filterModel,
        queryHintModel,
        withinBuilderModel,
        virtualKeyboardModel,
        firstHitsModel,
        querySuggest,
        searchHistoryModel
}:ViewInitArgs):FilterFormViews {

    const inputViews = inputInit({
        dispatcher: dispatcher,
        he: he,
        queryModel: filterModel,
        queryHintModel,
        withinBuilderModel,
        virtualKeyboardModel,
        querySuggest,
        searchHistoryModel
    });

    const layoutViews = he.getLayoutViews();


    // -------- <HighlightTokenSelector /> -----------------

    const HighlightTokenSelector:React.FC<{
        filterId:string;
        value:'f'|'l';

    }> = (props) => {
        const handleSelTokenSelect = (evt) => {
            dispatcher.dispatch<Actions.FilterInputSetFilfl>({
                name: ActionName.FilterInputSetFilfl,
                payload: {
                    filterId: props.filterId,
                    value: evt.target.value
                }
            });
        }
        return (
            <div>
                <label>{he.translate('query__highlight_token_hd')}</label>:{'\u00a0'}
                <select onChange={handleSelTokenSelect}
                        value={props.value}>
                    <option value="f">{he.translate('query__highlight_token_first')}</option>
                    <option value="l">{he.translate('query__highlight_token_last')}</option>
                </select>
                <layoutViews.InlineHelp noSuperscript={true}>
                    {he.translate('query__qlfilter_sel_token_hint')}
                </layoutViews.InlineHelp>
            </div>
        );
    };

    // ---------------------- <InclKwicCheckbox /> ------------------------

    const InclKWicCheckbox:React.FC<{
        filterId:string;
        value:boolean;

    }> = (props) => {

        const handleCheckbox = (evt) => {
            dispatcher.dispatch<Actions.FilterInputSetInclKwic>({
                name: ActionName.FilterInputSetInclKwic,
                payload: {
                    filterId: props.filterId,
                    value: !props.value
                }
            });
        }

        return (
            <div>
                <label>
                    {he.translate('query__qfilter_include_kwic')}
                    <input type="checkbox" checked={props.value}
                        onChange={handleCheckbox} />
                </label>
            </div>
        );
    };

    // ---------------------- <RangeSelector /> ---------------------------

    const RangeSelector:React.FC<{
        filterId:string;
        filfposValue:Kontext.FormValue<string>;
        filtposValue:Kontext.FormValue<string>;

    }> = (props) => {

        const handleToFromRangeValChange = (pos) => (evt) => {
            dispatcher.dispatch<Actions.FilterInputSetRange>({
                name: ActionName.FilterInputSetRange,
                payload: {
                    filterId: props.filterId,
                    rangeId: ({from: 'filfpos', to: 'filtpos'})[pos],
                    value: evt.target.value
                }
            });
        };

        return (
            <div>
                <label>{he.translate('query__qfilter_range_srch_th')} </label>
                <label>
                    {he.translate('query__qfilter_range_from')}:{'\u00a0'}
                    <layoutViews.ValidatedItem invalid={props.filfposValue.isInvalid}>
                        <input type="text" style={{width: '3em'}}
                            value={props.filfposValue.value}
                            onChange={handleToFromRangeValChange('from')} />
                    </layoutViews.ValidatedItem>
                </label>
                {'\u00a0'}
                <label>
                    {he.translate('query__qfilter_range_to')}:{'\u00a0'}
                    <layoutViews.ValidatedItem invalid={props.filtposValue.isInvalid}>
                        <input type="text" style={{width: '3em'}}
                            value={props.filtposValue.value}
                            onChange={handleToFromRangeValChange('to')} />
                    </layoutViews.ValidatedItem>
                </label>
            </div>
        );
    };

    // --------- <FilterTypeSelector /> ----------------------------------

    const FilterTypeSelector:React.FC<{
        value:'p'|'n';
        sourceId:string;

    }> = (props) => {

        const handleChange = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch<Actions.FilterInputSetFilterType>({
                name: ActionName.FilterInputSetFilterType,
                payload: {
                    filterId: props.sourceId,
                    value: evt.target.value as 'p'|'n'
                }
            });
        };

        return (
            <S.FilterTypeSelector>
                <select  value={props.value} onChange={handleChange}>
                    <option value="p">{he.translate('query__qfilter_pos')}</option>
                    <option value="n">{he.translate('query__qfilter_neg')}</option>
                </select>
            </S.FilterTypeSelector>
        );
    };

    // -------- <FilterForm /> ---------------------------------------

    class FilterForm extends React.PureComponent<FilterFormProps & FilterFormModelState> {

        constructor(props) {
            super(props);
            this._keyEventHandler = this._keyEventHandler.bind(this);
            this._handleSubmit = this._handleSubmit.bind(this);
        }

        _keyEventHandler(evt) {
            if (evt.key === Keyboard.Value.ENTER && !evt.ctrlKey && !evt.shiftKey) {
                if (this.props.operationIdx !== undefined) {
                    dispatcher.dispatch<Actions.BranchQuery>({
                        name: ActionName.BranchQuery,
                        payload: {operationIdx: this.props.operationIdx}
                    });

                } else {
                    dispatcher.dispatch<Actions.ApplyFilter>({
                        name: ActionName.ApplyFilter,
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
                dispatcher.dispatch<Actions.ApplyFilter>({
                    name: ActionName.ApplyFilter,
                    payload: {
                        filterId: this.props.filterId
                    }
                });
            }
        }

        _renderForm() {
            if (this.props.withinArgs[this.props.filterId]) {
                return this._renderSwitchMaincorpForm();

            } else {
                return this._renderFullForm();
            }
        }

        _renderSwitchMaincorpForm() {

            return (
                <QS.QueryForm>
                    <div onKeyDown={this._keyEventHandler}>
                        <div className="form">
                            <div className="query">
                                <inputViews.TRQueryInputField
                                    widgets={this.props.supportedWidgets[this.props.filterId]}
                                    sourceId={this.props.filterId}
                                    corpname={this.props.corpname}
                                    wPoSList={this.props.wPoSList}
                                    lposValue={this.props.lposValues[this.props.filterId]}
                                    forcedAttr={this.props.forcedAttr}
                                    attrList={this.props.attrList}
                                    tagHelperView={this.props.tagHelperView}
                                    tagsets={this.props.tagsets}
                                    inputLanguage={this.props.inputLanguage}
                                    useRichQueryEditor={this.props.useRichQueryEditor}
                                    onEnterKey={this._handleSubmit}
                                    qsuggPlugin={querySuggest} />
                            </div>
                        </div>
                        <div className="buttons">
                            {this.props.isBusy ?
                                <layoutViews.AjaxLoaderBarImage /> :
                                <button type="button" className="default-button" onClick={this._handleSubmit}>
                                    {this.props.operationIdx !== undefined ?
                                        he.translate('global__proceed')
                                        : he.translate('query__search_btn')}
                                </button>
                            }
                        </div>
                    </div>
                </QS.QueryForm>
            );
        }

        _renderFullForm() {
            const opts = [
                <RangeSelector
                    filterId={this.props.filterId}
                    filfposValue={this.props.filfposValues[this.props.filterId]}
                    filtposValue={this.props.filtposValues[this.props.filterId]} />,
                <InclKWicCheckbox
                    value={this.props.inclkwicValues[this.props.filterId]}
                    filterId={this.props.filterId} />
            ];
            if (this.props.pnFilterValues[this.props.filterId] === 'p') {
                opts.push(<HighlightTokenSelector
                            filterId={this.props.filterId}
                            value={this.props.filflValues[this.props.filterId]} />);
            }

            return (
                <QS.QueryForm>
                    <div onKeyDown={this._keyEventHandler}>
                        <div className="form primary-language">
                            {this.props.filterId === '__new__' ?
                                null :
                                <FilterTypeSelector value={this.props.pnFilterValues[this.props.filterId]}
                                        sourceId={this.props.filterId} />
                            }
                            <div>
                                <inputViews.TRQueryInputField
                                    widgets={this.props.supportedWidgets[this.props.filterId]}
                                    sourceId={this.props.filterId}
                                    corpname={this.props.corpname}
                                    wPoSList={this.props.wPoSList}
                                    lposValue={this.props.lposValues[this.props.filterId]}
                                    forcedAttr={this.props.forcedAttr}
                                    attrList={this.props.attrList}
                                    tagHelperView={this.props.tagHelperView}
                                    tagsets={this.props.tagsets}
                                    inputLanguage={this.props.inputLanguage}
                                    useRichQueryEditor={this.props.useRichQueryEditor}
                                    onEnterKey={this._handleSubmit}
                                    takeFocus={true}
                                    qsuggPlugin={querySuggest}
                                    customOptions={opts} />
                            </div>
                        </div>
                        <div className="buttons">
                            {this.props.isBusy ?
                                <layoutViews.AjaxLoaderBarImage /> :
                                <button type="button" className="default-button" onClick={this._handleSubmit}>
                                    {this.props.operationIdx !== undefined ?
                                        he.translate('global__proceed')
                                        : he.translate('query__search_btn')}
                                </button>
                            }
                        </div>
                    </div>
                </QS.QueryForm>
            );
        }

        render() {
            if (this.props.opLocks[this.props.filterId]) {
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
    class FirstHitsForm extends React.PureComponent<FirstHitsFormProps & FirstHitsModelState> {

        constructor(props) {
            super(props);
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
            if (this.props.operationIdx === undefined) {
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
                dispatcher.dispatch<Actions.FilterFirstHitsSubmit>({
                    name: ActionName.FilterFirstHitsSubmit,
                    payload: {
                        opKey: this.props.opKey
                    }
                });
            }
        }

        _renderContents() {
            if (this.props.operationIdx === undefined) {
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
                            <option>{this.props.docStructValues[this.props.opKey]}</option>
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
        FilterForm: BoundWithProps<FilterFormProps, FilterFormModelState>(FilterForm, filterModel),
        SubHitsForm: SubHitsForm,
        FirstHitsForm: BoundWithProps<FirstHitsFormProps, FirstHitsModelState>(FirstHitsForm, firstHitsModel)
    };
}