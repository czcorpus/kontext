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


import * as React from 'vendor/react';
import {init as inputInit} from './input';
import {init as alignedInit} from './aligned';
import {init as contextInit} from './context';
import {init as ttViewsInit} from '../textTypes';


export function init(dispatcher, he, CorparchWidget, queryStore, textTypesStore, queryHintStore,
        withinBuilderStore, virtualKeyboardStore, queryContextStore) {

    const inputViews = inputInit(
        dispatcher, he, queryStore, queryHintStore, withinBuilderStore, virtualKeyboardStore);
    const alignedViews = alignedInit(dispatcher, he, queryStore, queryHintStore, withinBuilderStore, virtualKeyboardStore);
    const contextViews = contextInit(dispatcher, he, queryContextStore);
    const ttViews = ttViewsInit(dispatcher, he, textTypesStore);
    const layoutViews = he.getLayoutViews();


    // ------------------- <AdvancedFormLegend /> -----------------------------

    const AdvancedFormLegend = (props) => {

        const htmlClasses = ['form-extension-switch'];
        htmlClasses.push(props.formVisible ? 'collapse' : 'expand');
        return (
            <legend>
                <a className={htmlClasses.join(' ')}
                        onClick={props.handleClick}>
                    {props.title}
                </a>
            </legend>
        );
    };

    // ------------------- <TextTypesNote /> -----------------------------

    const TextTypesNotes = (props) => {

        if (props.description) {
            return (
                <div style={{paddingLeft: '1em', paddingRight: '25%'}}>
                    <img src={he.createStaticUrl('img/info-icon.svg')}
                            style={{width: '1em', verticalAlign: 'middle', marginRight: '0.7em'}} />
                    <div dangerouslySetInnerHTML={{__html: props.description}} />
                </div>
            );

        } else {
            return <span />;
        }
    };

    // ------------------- <TRCorpusField /> -----------------------------

    const TRCorpusField = (props) => {

        return (
            <tr>
                <th>{he.translate('global__corpus')}:</th>
                <td>
                    <props.corparchWidget />
                </td>
            </tr>
        );
    };


    // ------------------- <QueryForm /> -----------------------------

    class QueryForm extends React.Component {

        constructor(props) {
            super(props);
            this._storeChangeHandler = this._storeChangeHandler.bind(this);
            this._handleSubmit = this._handleSubmit.bind(this);
            this._handleContextFormVisibility = this._handleContextFormVisibility.bind(this);
            this._handleTextTypesFormVisibility = this._handleTextTypesFormVisibility.bind(this);
            this._keyEventHandler = this._keyEventHandler.bind(this);
            this.state = this._fetchStoreState();
        }

        _fetchStoreState() {
            return {
                corpora: queryStore.getCorpora(),
                availableAlignedCorpora: queryStore.getAvailableAlignedCorpora(),
                supportsParallelCorpora: queryStore.supportsParallelCorpora(),
                queryTypes: queryStore.getQueryTypes(),
                supportedWidgets: queryStore.getSupportedWidgets(),
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
                textTypesFormVisible: textTypesStore.hasSelectedItems(),
                inputLanguages: queryStore.getInputLanguages(),
                textTypesNotes: queryStore.getTextTypesNotes()
            };
        }

        _storeChangeHandler() {
            const state = this._fetchStoreState();
            state['contextFormVisible'] = this.state.contextFormVisible;
            state['textTypesFormVisible'] = this.state.textTypesFormVisible;
            this.setState(state);
        }

        _handleSubmit() {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SUBMIT',
                props: {}
            });
        }

        _handleContextFormVisibility() {
            const newState = he.cloneState(this.state);
            newState.contextFormVisible = !this.state.contextFormVisible;
            this.setState(newState);
        }

        _handleTextTypesFormVisibility() {
            const newState = he.cloneState(this.state);
            newState.textTypesFormVisible = !this.state.textTypesFormVisible;
            this.setState(newState);
        }

        _keyEventHandler(evt) {
            if (evt.keyCode === 13 && !evt.shiftKey) {
                if (!evt.ctrlKey && !evt.shiftKey) {
                    dispatcher.dispatch({
                        actionType: 'QUERY_INPUT_SUBMIT',
                        props: {}
                    });
                }
                evt.stopPropagation();
                evt.preventDefault();
            }
        }

        componentDidMount() {
            queryStore.addChangeListener(this._storeChangeHandler);
            textTypesStore.addChangeListener(this._storeChangeHandler);
        }

        componentWillUnmount() {
            queryStore.removeChangeListener(this._storeChangeHandler);
            textTypesStore.removeChangeListener(this._storeChangeHandler);
        }

        render() {
            const primaryCorpname = this.state.corpora.get(0);
            return (
                <form className="query-form" onKeyDown={this._keyEventHandler}>
                    <table className="form primary-language">
                        <tbody>
                            {this.props.allowCorpusSelection ?
                                <TRCorpusField corpname={primaryCorpname} corparchWidget={CorparchWidget} />
                                : null}
                            <inputViews.TRQueryTypeField
                                    queryType={this.state.queryTypes.get(primaryCorpname)}
                                    sourceId={primaryCorpname}
                                    actionPrefix={this.props.actionPrefix}
                                    hasLemmaAttr={this.state.hasLemmaAttr} />
                        </tbody>
                        <tbody>
                            <inputViews.TRQueryInputField
                                queryType={this.state.queryTypes.get(primaryCorpname)}
                                widgets={this.state.supportedWidgets.get(primaryCorpname)}
                                sourceId={primaryCorpname}
                                wPoSList={this.state.wPoSList}
                                lposValue={this.state.lposValues.get(primaryCorpname)}
                                matchCaseValue={this.state.matchCaseValues.get(primaryCorpname)}
                                forcedAttr={this.state.forcedAttr}
                                defaultAttr={this.state.defaultAttrValues.get(primaryCorpname)}
                                attrList={this.state.attrList}
                                tagsetDocUrl={this.state.tagsetDocUrl}
                                tagHelperView={this.props.tagHelperView}
                                queryStorageView={this.props.queryStorageView}
                                inputLanguage={this.state.inputLanguages.get(primaryCorpname)}
                                actionPrefix={this.props.actionPrefix}
                                onEnterKey={this._handleSubmit} />
                        </tbody>
                    </table>
                    {this.state.supportsParallelCorpora ?
                        <alignedViews.AlignedCorpora
                                availableCorpora={this.state.availableAlignedCorpora}
                                alignedCorpora={this.state.corpora.rest()}
                                queryTypes={this.state.queryTypes}
                                supportedWidgets={this.state.supportedWidgets}
                                wPoSList={this.state.wPoSList}
                                lposValues={this.state.lposValues}
                                matchCaseValues={this.state.matchCaseValues}
                                forcedAttr={this.state.forcedAttr}
                                defaultAttrValues={this.state.defaultAttrValues}
                                attrList={this.state.attrList}
                                tagsetDocUrl={this.state.tagsetDocUrl}
                                pcqPosNegValues={this.state.pcqPosNegValues}
                                inputLanguages={this.state.inputLanguages}
                                queryStorageView={this.props.queryStorageView}
                                actionPrefix={this.props.actionPrefix}
                                hasLemmaAttr={this.state.hasLemmaAttr} />
                        : null
                    }
                    <fieldset id="specify-context">
                        <AdvancedFormLegend
                                formVisible={this.state.contextFormVisible}
                                handleClick={this._handleContextFormVisibility}
                                title={he.translate('query__specify_context')} />
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
                                title={he.translate('query__specify_tt')} />
                        {this.state.textTypesFormVisible ?
                                <ttViews.TextTypesPanel
                                        liveAttrsView={this.props.liveAttrsView}
                                        liveAttrsCustomTT={this.props.liveAttrsCustomTT}
                                        attributes={this.props.attributes} />
                                : <TextTypesNotes description={this.state.textTypesNotes} />
                        }
                    </fieldset>
                    <div className="buttons">
                        <button type="button" className="default-button" onClick={this._handleSubmit}>
                            {he.translate('query__search_btn')}
                        </button>
                    </div>
                </form>
            );
        }
    }

    // -------- <SelectedTextTypesLite /> ---------------------------

    const SelectedTextTypesLite = (props) => {
        return (
            <fieldset id="specify-query-metainformation">
                <legend>{he.translate('query__chosen_texts')}</legend>
                <ul>
                    {Object.keys(props.data).map(v => (
                        <li key={v}>
                            <strong>{v}</strong>
                            {' \u2208 {' + props.data[v].map(v => `"${v}"`).join(', ') + '}'}
                        </li>
                    ))}
                </ul>
                <p className="hint">
                    ({he.translate('query__chosen_texts_cannot_be_changed')})
                </p>
            </fieldset>
        );
    }

    // -------- <QueryFormLite /> ------------------------------------

    class QueryFormLite extends React.Component {

        constructor(props) {
            super(props);
            this._keyEventHandler = this._keyEventHandler.bind(this);
            this._handleContextFormVisibility = this._handleContextFormVisibility.bind(this);
            this._storeChangeHandler = this._storeChangeHandler.bind(this);
            this._handleSubmit = this._handleSubmit.bind(this);
            this.state = this._fetchStoreState();
        }

        _fetchStoreState() {
            return {
                corpora: queryStore.getCorpora(),
                queryTypes: queryStore.getQueryTypes(),
                supportedWidgets: queryStore.getSupportedWidgets(),
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
                contextFormVisible: false,
                inputLanguages: queryStore.getInputLanguages(),
                hasSelectedTextTypes: textTypesStore.hasSelectedItems(),
                textTypeSelections: textTypesStore.exportSelections()
            };
        }

        _keyEventHandler(evt) {
            if (evt.keyCode === 13 && !evt.shiftKey) {
                if (!evt.ctrlKey) {
                    if (this.props.operationIdx !== undefined) {
                        dispatcher.dispatch({
                            actionType: 'BRANCH_QUERY',
                            props: {operationIdx: this.props.operationIdx}
                        });

                    } else {
                        dispatcher.dispatch({
                            actionType: 'QUERY_INPUT_SUBMIT',
                            props: {}
                        });
                    }
                }
                evt.stopPropagation();
                evt.preventDefault();
            }
        }

        _handleContextFormVisibility() {
            const newState = he.cloneState(this.state);
            newState.contextFormVisible = !this.state.contextFormVisible;
            this.setState(newState);
        }

        _handleSubmit() {
            if (this.props.operationIdx !== undefined) {
                dispatcher.dispatch({
                    actionType: 'BRANCH_QUERY',
                    props: {operationIdx: this.props.operationIdx}
                });

            } else {
                dispatcher.dispatch({
                    actionType: 'QUERY_INPUT_SUBMIT',
                    props: {}
                });
            }
        }

        _storeChangeHandler(store, action) {
            const state = this._fetchStoreState();
            state['contextFormVisible'] = this.state.contextFormVisible;
            this.setState(state);
        }

        componentDidMount() {
            queryStore.addChangeListener(this._storeChangeHandler);
        }

        componentWillUnmount() {
            queryStore.removeChangeListener(this._storeChangeHandler);
        }

        render() {
            return (
                <form className="query-form" onKeyDown={this._keyEventHandler}>
                    <table className="form primary-language">
                        <tbody>
                            <inputViews.TRQueryTypeField
                                    queryType={this.state.queryTypes.get(this.props.corpname)}
                                    sourceId={this.props.corpname}
                                    actionPrefix={this.props.actionPrefix}
                                    hasLemmaAttr={this.props.hasLemmaAttr} />
                            <inputViews.TRQueryInputField
                                queryType={this.state.queryTypes.get(this.props.corpname)}
                                widgets={this.state.supportedWidgets.get(this.props.corpname)}
                                sourceId={this.props.corpname}
                                wPoSList={this.state.wPoSList}
                                lposValue={this.state.lposValues.get(this.props.corpname)}
                                matchCaseValue={this.state.matchCaseValues.get(this.props.corpname)}
                                forcedAttr={this.state.forcedAttr}
                                defaultAttr={this.state.defaultAttrValues.get(this.props.corpname)}
                                attrList={this.state.attrList}
                                tagsetDocUrl={this.state.tagsetDocUrl}
                                tagHelperView={this.props.tagHelperView}
                                queryStorageView={this.props.queryStorageView}
                                inputLanguage={this.state.inputLanguages.get(this.props.corpname)}
                                actionPrefix={this.props.actionPrefix}
                                onEnterKey={this._handleSubmit} />
                        </tbody>
                    </table>
                    <fieldset id="specify-context">
                        <AdvancedFormLegend
                                formVisible={this.state.contextFormVisible}
                                handleClick={this._handleContextFormVisibility}
                                title={he.translate('query__specify_context')} />
                        {this.state.contextFormVisible ?
                            <contextViews.SpecifyContextForm
                                    lemmaWindowSizes={this.state.lemmaWindowSizes}
                                    posWindowSizes={this.state.posWindowSizes}
                                    hasLemmaAttr={this.state.hasLemmaAttr}
                                    wPoSList={this.state.wPoSList} />
                            : null}
                    </fieldset>
                    {this.state.hasSelectedTextTypes ?
                        <SelectedTextTypesLite data={this.state.textTypeSelections} /> : null}

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
    }

    return {
        QueryForm: QueryForm,
        QueryFormLite: QueryFormLite
    };
}