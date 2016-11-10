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
    dispatcher, mixins, layoutViews, queryStore, textTypesStore, queryHintStore, withinBuilderStore, virtualKeyboardStore) {

    const inputViews = inputInit(
        dispatcher, mixins, layoutViews, queryStore, queryHintStore, withinBuilderStore, virtualKeyboardStore);
    const alignedViews = alignedInit(dispatcher, mixins, layoutViews, queryStore, queryHintStore, withinBuilderStore, virtualKeyboardStore);
    const contextViews = contextInit(dispatcher, mixins);
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
                        <select id="corparch-mount" name="corpname">SYN2015</select>
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

    // ------------------- <SearchSpan /> ----------------------------

    const TRSearchSpan = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <tr>
                    <th>{this.translate('Search Span')}:</th>
                    <td>
                        {this.translate('query__span_from')}
                        <input type="text" name="filfpos" size="4" value="$filfpos" data-ignore-reset="1" />
                        {this.translate('query__span_to')}
                        <input type="text" name="filtpos" size="4" value="$filtpos" data-ignore-reset="1" />
                        <input type="checkbox" name="inclkwic" value="True" checked="checked" />
                        {this.translate('query__include_kwic')}
                    </td>
                </tr>
            );
        }
    });

    // ------------------- <QueryForm /> -----------------------------

    const QueryForm = React.createClass({

        mixins : mixins,

        getInitialState : function () {
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
                defaultAttr: queryStore.getDefaultAttr(),
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

        _storeChangeHandler : function (store, action) {
            this.setState({
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
                defaultAttr: queryStore.getDefaultAttr(),
                attrList: queryStore.getAttrList(),
                tagsetDocUrl: queryStore.getTagsetDocUrl(),
                pcqPosNegValues: queryStore.getPcqPosNegValues(),
                lemmaWindowSizes: queryStore.getLemmaWindowSizes(),
                posWindowSizes: queryStore.getPosWindowSizes(),
                hasLemmaAttr: queryStore.getHasLemmaAttr(),
                wPoSList: queryStore.getwPoSList(),
                contextFormVisible: this.state.contextFormVisible,
                textTypesFormVisible: this.state.textTypesFormVisible,
                inputLanguages: queryStore.getInputLanguages()
            });
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
            this.addGlobalKeyEventHandler(this._keyEventHandler);
        },

        componentWillUnmount : function () {
            queryStore.removeChangeListener(this._storeChangeHandler);
            this.removeGlobalKeyEventHandler(this._keyEventHandler);
        },

        render : function () {
            const primaryCorpname = this.state.corpora.get(0);
            return (
                <form id="mainform">
                    {this.state.shuffleConcByDefault ? <input type="hidden" name="shuffle" value="1" /> : null}
                    <table className="form primary-language">
                        <tbody>
                            {this.props.allowCorpusSelection ?
                                <TRCorpusField corpname={primaryCorpname} subcorpList={this.state.subcorpList}
                                        currentSubcorp={this.state.currentSubcorp} />
                                : null}
                            <inputViews.TRQueryTypeField queryType={this.state.queryTypes.get(primaryCorpname)}
                                    corpname={primaryCorpname} />
                        </tbody>
                        <tbody>
                            <inputViews.TRQueryInputField
                                queryType={this.state.queryTypes.get(primaryCorpname)}
                                widgets={this.state.supportedWidgets.get(primaryCorpname)}
                                corpname={primaryCorpname}
                                lposlist={this.state.lposlist}
                                lposValue={this.state.lposValues.get(primaryCorpname)}
                                matchCaseValue={this.state.matchCaseValues.get(primaryCorpname)}
                                forcedAttr={this.state.forcedAttr}
                                defaultAttr={this.state.defaultAttr}
                                attrList={this.state.attrList}
                                tagsetDocUrl={this.state.tagsetDocUrl}
                                tagHelperViews={this.props.tagHelperViews}
                                queryStorageViews={this.props.queryStorageViews}
                                inputLanguage={this.state.inputLanguages.get(primaryCorpname)} />
                        </tbody>
                    </table>
                    {this.state.supportsParallelCorpora ?
                        <alignedViews.AlignedCorpora
                                availableCorpora={this.state.availableAlignedCorpora}
                                alignedCorpora={this.state.corpora.rest()}
                                queryTypes={this.state.queryTypes}
                                supportedWidgets={this.state.supportedWidgets}
                                corpname={primaryCorpname}
                                lposlist={this.state.lposlist}
                                lposValues={this.state.lposValues}
                                matchCaseValues={this.state.matchCaseValues}
                                forcedAttr={this.state.forcedAttr}
                                defaultAttr={this.state.defaultAttr}
                                attrList={this.state.attrList}
                                tagsetDocUrl={this.state.tagsetDocUrl}
                                pcqPosNegValues={this.state.pcqPosNegValues}
                                inputLanguages={this.state.inputLanguages} />
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


    return {
        QueryForm: QueryForm
    };
}