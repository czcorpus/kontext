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
import {init as alignedInit} from './aligned';
import {init as contextInit} from './context';
import {init as ttViewsInit} from '../textTypes';


export function init(
        dispatcher, mixins, layoutViews, queryStore, textTypesStore, queryHintStore,
        withinBuilderStore, virtualKeyboardStore, queryContextStore) {

    const inputViews = inputInit(
        dispatcher, mixins, layoutViews, queryStore, queryHintStore, withinBuilderStore, virtualKeyboardStore);
    const alignedViews = alignedInit(dispatcher, mixins, layoutViews, queryStore, queryHintStore, withinBuilderStore, virtualKeyboardStore);
    const contextViews = contextInit(dispatcher, mixins, queryContextStore);
    const ttViews = ttViewsInit(dispatcher, mixins, textTypesStore);

    // ------------------- <TRCorpusField /> -----------------------------

    const TRCorpusField = React.createClass({

        mixins : mixins,

        _handleSubcorpChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SELECT_SUBCORP',
                props: {
                    subcorp: evt.target.value
                }
            });
        },

        render : function () {
            return (
                <tr>
                    <th>{this.translate('global__corpus')}:</th>
                    <td>
                        <div id="corparch-mount" />
                        {this.props.subcorpList.size > 0 ?
                            (<span id="subcorp-selector-wrapper">
                                <strong>{'\u00a0'}:{'\u00a0'}</strong>
                                <select id="subcorp-selector" name="usesubcorp" value={this.props.currentSubcorp}
                                        onChange={this._handleSubcorpChange}>
                                    {this.props.subcorpList.map(item => {
                                        return <option key={item.v} value={item.v}>{item.n}</option>;
                                    })}
                                </select>
                            </span>)
                            : null}
                        <div className="starred" />
                    </td>
                </tr>
            );
        }
    });

    // ------------------- <AdvancedFormLegend /> -----------------------------

    const AdvancedFormLegend = React.createClass({

        mixins : mixins,

        render : function () {
            const htmlClasses = ['form-extension-switch'];
            htmlClasses.push(this.props.formVisible ? 'collapse' : 'expand');
            return (
                <legend>
                    <a className={htmlClasses.join(' ')}
                            onClick={this.props.handleClick}>
                        {this.props.title}
                    </a>
                </legend>
            );
        }
    });

    // ------------------- <QueryForm /> -----------------------------

    const QueryForm = React.createClass({

        mixins : mixins,

        _fetchStoreState : function () {
            return {
                corpora: queryStore.getCorpora(),
                availableAlignedCorpora: queryStore.getAvailableAlignedCorpora(),
                supportsParallelCorpora: queryStore.supportsParallelCorpora(),
                queryTypes: queryStore.getQueryTypes(),
                subcorpList: queryStore.getSubcorpList(),
                currentSubcorp: queryStore.getCurrentSubcorp(),
                supportedWidgets: queryStore.getSupportedWidgets(),
                shuffleConcByDefault: queryStore.isShuffleConcByDefault(),
                lposlist: queryStore.getLposlist(),
                lposValues: queryStore.getLposValues(),
                matchCaseValues: queryStore.getMatchCaseValues(),
                forcedAttr: queryStore.getForcedAttr(),
                defaultAttrValues: queryStore.getDefaultAttrValues(),
                attrList: queryStore.getAttrList(),
                tagsetDocUrl: queryStore.getTagsetDocUrl(),
                pcqPosNegValues: queryStore.getPcqPosNegValues(),
                lemmaWindowSizes: queryStore.getLemmaWindowSizes(),
                posWindowSizes: queryStore.getPosWindowSizes(),
                hasLemmaAttr: queryStore.getHasLemmaAttr(),
                wPoSList: queryStore.getwPoSList(),
                contextFormVisible: false, // TODO use data from session?
                textTypesFormVisible: false, // dtto,
                inputLanguages: queryStore.getInputLanguages()
            };
        },

        getInitialState : function () {
            return this._fetchStoreState();
        },

        _storeChangeHandler : function (store, action) {
            const state = this._fetchStoreState();
            state['contextFormVisible'] = this.state.contextFormVisible;
            state['textTypesFormVisible'] = this.state.textTypesFormVisible;
        },

        _handleSubmit : function () {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SUBMIT',
                props: {}
            });
        },

        _handleContextFormVisibility : function () {
            this.setState(React.addons.update(this.state,
                {
                    contextFormVisible: {$set: !this.state.contextFormVisible}
                }
            ));
        },

        _handleTextTypesFormVisibility : function () {
            this.setState(React.addons.update(this.state,
                {
                    textTypesFormVisible: {$set: !this.state.textTypesFormVisible}
                }
            ));
        },

        _keyEventHandler : function (evt) {
            if (evt.keyCode === 13 && !evt.ctrlKey && !evt.shiftKey) {
                dispatcher.dispatch({
                    actionType: 'QUERY_INPUT_SUBMIT',
                    props: {}
                });
                evt.stopPropagation();
                evt.preventDefault();
            }
        },

        componentDidMount : function () {
            queryStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            queryStore.removeChangeListener(this._storeChangeHandler);
        },

        render : function () {
            const primaryCorpname = this.state.corpora.get(0);
            return (
                <form id="mainform"  onKeyDown={this._keyEventHandler}>
                    {this.state.shuffleConcByDefault ? <input type="hidden" name="shuffle" value="1" /> : null}
                    <table className="form primary-language">
                        <tbody>
                            {this.props.allowCorpusSelection ?
                                <TRCorpusField corpname={primaryCorpname} subcorpList={this.state.subcorpList}
                                        currentSubcorp={this.state.currentSubcorp} />
                                : null}
                            <inputViews.TRQueryTypeField queryType={this.state.queryTypes.get(primaryCorpname)}
                                    sourceId={primaryCorpname} actionPrefix={this.props.actionPrefix} />
                        </tbody>
                        <tbody>
                            <inputViews.TRQueryInputField
                                queryType={this.state.queryTypes.get(primaryCorpname)}
                                widgets={this.state.supportedWidgets.get(primaryCorpname)}
                                sourceId={primaryCorpname}
                                lposlist={this.state.lposlist}
                                lposValue={this.state.lposValues.get(primaryCorpname)}
                                matchCaseValue={this.state.matchCaseValues.get(primaryCorpname)}
                                forcedAttr={this.state.forcedAttr}
                                defaultAttr={this.state.defaultAttrValues.get(primaryCorpname)}
                                attrList={this.state.attrList}
                                tagsetDocUrl={this.state.tagsetDocUrl}
                                tagHelperViews={this.props.tagHelperViews}
                                queryStorageViews={this.props.queryStorageViews}
                                inputLanguage={this.state.inputLanguages.get(primaryCorpname)}
                                actionPrefix={this.props.actionPrefix} />
                        </tbody>
                    </table>
                    {this.state.supportsParallelCorpora ?
                        <alignedViews.AlignedCorpora
                                availableCorpora={this.state.availableAlignedCorpora}
                                alignedCorpora={this.state.corpora.rest()}
                                queryTypes={this.state.queryTypes}
                                supportedWidgets={this.state.supportedWidgets}
                                lposlist={this.state.lposlist}
                                lposValues={this.state.lposValues}
                                matchCaseValues={this.state.matchCaseValues}
                                forcedAttr={this.state.forcedAttr}
                                defaultAttrValues={this.state.defaultAttrValues}
                                attrList={this.state.attrList}
                                tagsetDocUrl={this.state.tagsetDocUrl}
                                pcqPosNegValues={this.state.pcqPosNegValues}
                                inputLanguages={this.state.inputLanguages}
                                queryStorageViews={this.props.queryStorageViews}
                                actionPrefix={this.props.actionPrefix} />
                        : null
                    }
                    <fieldset id="specify-context">
                        <AdvancedFormLegend
                                formVisible={this.state.contextFormVisible}
                                handleClick={this._handleContextFormVisibility}
                                title={this.translate('query__specify_context')} />
                        {this.state.contextFormVisible ?
                            <contextViews.SpecifyContextForm
                                    lemmaWindowSizes={this.state.lemmaWindowSizes}
                                    posWindowSizes={this.state.posWindowSizes}
                                    hasLemmaAttr={this.state.hasLemmaAttr}
                                    wPoSList={this.state.wPoSList} />
                            : null}
                    </fieldset>
                    <fieldset id="specify-query-metainformation">
                        <AdvancedFormLegend
                                formVisible={this.state.textTypesFormVisible}
                                handleClick={this._handleTextTypesFormVisibility}
                                title={this.translate('query__specify_tt')} />
                        {this.state.textTypesFormVisible ?
                                <ttViews.TextTypesPanel
                                        liveAttrsView={this.props.liveAttrsView}
                                        liveAttrsCustomTT={this.props.liveAttrsCustomTT}
                                        attributes={this.props.attributes} />
                                : null}
                    </fieldset>
                    <div className="buttons">
                        <button type="button" className="default-button" onClick={this._handleSubmit}>
                            {this.translate('query__search_btn')}
                        </button>
                    </div>
                </form>
            );
        }
    });

    // -------- <QueryFormLite /> ------------------------------------

    const QueryFormLite = React.createClass({

        mixins : mixins,

        _fetchStoreState : function () {
            return {
                corpora: queryStore.getCorpora(),
                queryTypes: queryStore.getQueryTypes(),
                subcorpList: queryStore.getSubcorpList(),
                currentSubcorp: queryStore.getCurrentSubcorp(),
                supportedWidgets: queryStore.getSupportedWidgets(),
                lposlist: queryStore.getLposlist(),
                lposValues: queryStore.getLposValues(),
                matchCaseValues: queryStore.getMatchCaseValues(),
                forcedAttr: queryStore.getForcedAttr(),
                defaultAttrValues: queryStore.getDefaultAttrValues(),
                attrList: queryStore.getAttrList(),
                tagsetDocUrl: queryStore.getTagsetDocUrl(),
                pcqPosNegValues: queryStore.getPcqPosNegValues(),
                lemmaWindowSizes: queryStore.getLemmaWindowSizes(),
                posWindowSizes: queryStore.getPosWindowSizes(),
                hasLemmaAttr: queryStore.getHasLemmaAttr(),
                wPoSList: queryStore.getwPoSList(),
                contextFormVisible: false, // TODO use data from session?
                inputLanguages: queryStore.getInputLanguages()
            };
        },

        _keyEventHandler : function (evt) {
            if (evt.keyCode === 13 && !evt.ctrlKey && !evt.shiftKey) {
                dispatcher.dispatch({
                    actionType: 'QUERY_INPUT_SUBMIT',
                    props: {}
                });
                evt.stopPropagation();
                evt.preventDefault();
            }
        },

        getInitialState : function () {
            return this._fetchStoreState()
        },

        _handleSubmit : function () {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SUBMIT',
                props: {}
            });
        },

        _storeChangeHandler : function (store, action) {
            this.setState(this._fetchStoreState());
        },

        componentDidMount : function () {
            queryStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            queryStore.removeChangeListener(this._storeChangeHandler);
        },

        render : function () {
            return (
                <layoutViews.ModalOverlay onCloseKey={this.props.onCloseClick}>
                    <layoutViews.PopupBox customClass="query-form-lite"
                            onCloseClick={this.props.onCloseClick}>
                        <h3>{this.translate('query__edit_current_hd')}</h3>
                        <form id="query-form-lite"  onKeyDown={this._keyEventHandler}>
                            <table className="form primary-language">
                                <tbody>
                                    <inputViews.TRQueryTypeField queryType={this.state.queryTypes.get(this.props.corpname)}
                                            sourceId={this.props.corpname} actionPrefix={this.props.actionPrefix} />
                                    <inputViews.TRQueryInputField
                                        queryType={this.state.queryTypes.get(this.props.corpname)}
                                        widgets={this.state.supportedWidgets.get(this.props.corpname)}
                                        sourceId={this.props.corpname}
                                        lposlist={this.state.lposlist}
                                        lposValue={this.state.lposValues.get(this.props.corpname)}
                                        matchCaseValue={this.state.matchCaseValues.get(this.props.corpname)}
                                        forcedAttr={this.state.forcedAttr}
                                        defaultAttr={this.state.defaultAttrValues.get(this.props.corpname)}
                                        attrList={this.state.attrList}
                                        tagsetDocUrl={this.state.tagsetDocUrl}
                                        tagHelperViews={this.props.tagHelperViews}
                                        queryStorageViews={this.props.queryStorageViews}
                                        inputLanguage={this.state.inputLanguages.get(this.props.corpname)}
                                        actionPrefix={this.props.actionPrefix} />
                                </tbody>
                            </table>
                            <div className="buttons">
                                <button type="button" className="default-button" onClick={this._handleSubmit}>
                                    {this.translate('query__search_btn')}
                                </button>
                            </div>
                        </form>
                    </layoutViews.PopupBox>
                </layoutViews.ModalOverlay>
            );
        }
    });

    // -------- <FilterForm /> ---------------------------------------

    const FilterForm = React.createClass({

        mixins : mixins,

        _fetchState : function () {
            return {
                queryTypes: queryStore.getQueryTypes(),
                supportedWidgets: queryStore.getSupportedWidgets(),
                lposlist: queryStore.getLposlist(),
                lposValues: queryStore.getLposValues(),
                matchCaseValues: queryStore.getMatchCaseValues(),
                forcedAttr: queryStore.getForcedAttr(),
                defaultAttrValues: queryStore.getDefaultAttrValues(),
                attrList: queryStore.getAttrList(),
                tagsetDocUrl: queryStore.getTagsetDocUrl(),
                lemmaWindowSizes: queryStore.getLemmaWindowSizes(),
                posWindowSizes: queryStore.getPosWindowSizes(),
                hasLemmaAttr: queryStore.getHasLemmaAttr(),
                wPoSList: queryStore.getwPoSList(),
                contextFormVisible: false,
                inputLanguage: queryStore.getInputLanguage(),
                pnFilterValue: queryStore.getPnFilterValues().get(this.props.filterId),
                filfposValue: queryStore.getFilfposValues().get(this.props.filterId),
                filflValue: queryStore.getFilflValues().get(this.props.filterId),
                inclKwicValue: queryStore.getInclKwicValues().get(this.props.filterId)
            };
        },

        _keyEventHandler : function (evt) {
            if (evt.keyCode === 13 && !evt.ctrlKey && !evt.shiftKey) {
                dispatcher.dispatch({
                    actionType: 'FILTER_QUERY_APPLY_FILTER',
                    props: {
                        filterId: this.props.filterId
                    }
                });
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
            queryStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            queryStore.removeChangeListener(this._storeChangeHandler);
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
                    idx: ({from: 0, to: 1})[pos],
                    value: evt.target.value
                }
            });
        },

        _handleSubmit : function () {
            dispatcher.dispatch({
                actionType: 'FILTER_QUERY_APPLY_FILTER',
                props: {
                    filterId: this.props.filterId
                }
            });
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

        render : function () {
            return (
                <form id="mainform" onKeyDown={this._keyEventHandler}>
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
                            <tr>
                                <th>{this.translate('query__qlfilter_sel_token')}:</th>
                                <td>
                                    <select onChange={this._handleSelTokenSelect}
                                            value={this.state.filflValue}>
                                        <option value="f">{this.translate('query__token_first')}</option>
                                        <option value="l">{this.translate('query__token_last')}</option>
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <th>{this.translate('query__qfilter_range_srch_th')}:</th>
                                <td>
                                    <label>
                                        {this.translate('query__qfilter_range_from')}:{'\u00a0'}
                                        <input type="text" style={{width: '3em'}}
                                            value={this.state.filfposValue[0]}
                                            onChange={this._handleToFromRangeValChange.bind(this, 'from')} />
                                    </label>
                                    {'\u00a0'}
                                    <label>
                                        {this.translate('query__qfilter_range_to')}:{'\u00a0'}
                                        <input type="text" style={{width: '3em'}}
                                        value={this.state.filfposValue[1]}
                                            onChange={this._handleToFromRangeValChange.bind(this, 'to')} />
                                    </label>
                                    {'\u00a0'}
                                    <label>
                                        {this.translate('query_qfilter_include_kwic')}
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
                                actionPrefix={this.props.actionPrefix} />
                        </tbody>
                        <tbody>
                            <inputViews.TRQueryInputField
                                queryType={this.state.queryTypes.get(this.props.filterId)}
                                widgets={this.state.supportedWidgets.get(this.props.filterId)}
                                sourceId={this.props.filterId}
                                lposlist={this.state.lposlist}
                                lposValue={this.state.lposValues.get(this.props.filterId)}
                                matchCaseValue={this.state.matchCaseValues.get(this.props.filterId)}
                                forcedAttr={this.state.forcedAttr}
                                defaultAttr={this.state.defaultAttrValues.get(this.props.filterId)}
                                attrList={this.state.attrList}
                                tagsetDocUrl={this.state.tagsetDocUrl}
                                tagHelperViews={this.props.tagHelperViews}
                                queryStorageViews={this.props.queryStorageViews}
                                inputLanguage={this.state.inputLanguage}
                                actionPrefix={this.props.actionPrefix} />
                        </tbody>
                    </table>
                    <div className="buttons">
                        <button type="button" className="default-button" onClick={this._handleSubmit}>
                            {this.translate('query__search_btn')}
                        </button>
                    </div>
                </form>
            );
        }
    });

    return {
        QueryForm: QueryForm,
        QueryFormLite: QueryFormLite,
        FilterForm: FilterForm
    };
}