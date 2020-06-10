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
import { Subscription } from 'rxjs';
import { IActionDispatcher } from 'kombo';

import { init as inputInit } from './input';
import { init as alignedInit } from './aligned';
import { init as contextInit } from './context';
import { init as ttViewsInit } from '../textTypes';
import { Kontext, KeyCodes } from '../../types/common';
import { PluginInterfaces } from '../../types/plugins';
import { FirstQueryFormModel } from '../../models/query/first';
import { WidgetsMap } from '../../models/query/common';
import { UsageTipsModel } from '../../models/usageTips';
import { TextTypesModel } from '../../models/textTypes/main';
import { WithinBuilderModel } from '../../models/query/withinBuilder';
import { VirtualKeyboardModel } from '../../models/query/virtualKeyboard';
import { QueryContextModel } from '../../models/query/context';
import { CQLEditorModel } from '../../models/query/cqleditor/model';
import { ActionName, Actions } from '../../models/query/actions';


export interface MainModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    CorparchWidget:PluginInterfaces.Corparch.WidgetView;
    queryModel:FirstQueryFormModel;
    textTypesModel:TextTypesModel;
    queryHintModel:UsageTipsModel;
    withinBuilderModel:WithinBuilderModel;
    virtualKeyboardModel:VirtualKeyboardModel;
    queryContextModel:QueryContextModel;
    cqlEditorModel:CQLEditorModel;
}


export interface QueryFormProps {
    formType:Kontext.ConcFormTypes.QUERY;
    actionPrefix:string;
    allowCorpusSelection:boolean;
    tagHelperViews:Immutable.Map<string, PluginInterfaces.TagHelper.View>;
    queryStorageView:PluginInterfaces.QueryStorage.WidgetView;
    liveAttrsView:PluginInterfaces.LiveAttributes.View;
    liveAttrsCustomTT:PluginInterfaces.LiveAttributes.CustomAttribute;
    attributes:any; // TODO type once text types JSX->TSX
}


export interface QueryFormLiteProps {
    formType:Kontext.ConcFormTypes.QUERY;
    corpname:string;
    operationIdx?:number;
    actionPrefix:string;
    tagHelperView:PluginInterfaces.TagHelper.View;
    queryStorageView:PluginInterfaces.QueryStorage.WidgetView;
}


interface FirstQueryFormState {
    corpora:Immutable.List<string>;
    queryTypes:Immutable.Map<string, string>;
    supportedWidgets:WidgetsMap;
    lposValues:Immutable.Map<string, string>;
    matchCaseValues:Immutable.Map<string, boolean>;
    forcedAttr:string;
    defaultAttrValues:Immutable.Map<string, string>;
    attrList:Immutable.List<Kontext.AttrItem>;
    tagsetDocUrls:Immutable.Map<string, string>;
    pcqPosNegValues:Immutable.Map<string, string>;
    includeEmptyValues:Immutable.Map<string, boolean>;
    lemmaWindowSizes:Immutable.List<number>;
    posWindowSizes:Immutable.List<number>;
    hasLemmaAttr:Immutable.Map<string, boolean>;
    wPoSList:Immutable.List<{v:string; n:string}>;
    contextFormVisible:boolean;
    inputLanguages:Immutable.Map<string, string>;
    useCQLEditor:boolean;
}


interface QueryFormLiteState extends FirstQueryFormState {
    hasSelectedTextTypes:boolean;
    textTypeSelections:{[attr:string]:Array<string>};
}


interface QueryFormState extends FirstQueryFormState {
    tagAttr:string;
    textTypesFormVisible:boolean;
    hasSelectedTextTypes:boolean;
    textTypesNotes:string;
    structAttrList:Immutable.List<Kontext.AttrItem>;
    availableAlignedCorpora:Immutable.List<Kontext.AttrItem>;
    supportsParallelCorpora:boolean;
}


export interface MainViews {
    QueryForm:React.ComponentClass<QueryFormProps>;
    QueryFormLite:React.ComponentClass<QueryFormLiteProps>;
}


export function init({dispatcher, he, CorparchWidget, queryModel,
                      textTypesModel, queryHintModel, withinBuilderModel, virtualKeyboardModel,
                      queryContextModel, cqlEditorModel}:MainModuleArgs):MainViews {

    const inputViews = inputInit({
        dispatcher: dispatcher,
        he: he,
        queryModel: queryModel,
        queryHintModel: queryHintModel,
        withinBuilderModel: withinBuilderModel,
        virtualKeyboardModel: virtualKeyboardModel,
        cqlEditorModel: cqlEditorModel
    });
    const alignedViews = alignedInit({
            dispatcher: dispatcher,
            he: he,
            inputViews: inputViews
    });
    const contextViews = contextInit(dispatcher, he, queryContextModel);
    const ttViews = ttViewsInit(dispatcher, he, textTypesModel);


    // ------------------- <AdvancedFormLegend /> -----------------------------

    const AdvancedFormLegend:React.SFC<{
        formVisible:boolean;
        title:string;
        hintWhenClosed:string;
        handleClick:()=>void;

    }> = (props) => {

        const htmlClasses = ['form-extension-switch'];
        htmlClasses.push(props.formVisible ? 'collapse' : 'expand');
        return (
            <legend>
                <a className={htmlClasses.join(' ')}
                        onClick={props.handleClick}>
                    {props.title}
                </a>
                {!props.formVisible && props.hintWhenClosed ?
                    <span title={props.hintWhenClosed}>{'\u2713'}</span> : null}
            </legend>
        );
    };

    // ------------------- <TextTypesNote /> -----------------------------

    const TextTypesNotes:React.SFC<{
        description:string; // raw HTML code

    }> = (props) => {

        if (props.description) {
            return (
                <div className="TextTypesNotes">
                    <div dangerouslySetInnerHTML={{__html: props.description}} />
                </div>
            );

        } else {
            return <span />;
        }
    };

    // ------------------- <TRCorpusField /> -----------------------------

    const TRCorpusField:React.SFC<{
        corparchWidget:PluginInterfaces.Corparch.WidgetView;

    }> = (props) => {

        return (
            <tr>
                <th>{he.translate('global__corpus')}:</th>
                <td>
                    <props.corparchWidget  />
                </td>
            </tr>
        );
    };


    // ------------------- <QueryForm /> -----------------------------

    class QueryForm extends React.Component<QueryFormProps, QueryFormState> {

        private modelSubscriptions:Array<Subscription>;

        constructor(props) {
            super(props);
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
            this._handleSubmit = this._handleSubmit.bind(this);
            this._handleContextFormVisibility = this._handleContextFormVisibility.bind(this);
            this._handleTextTypesFormVisibility = this._handleTextTypesFormVisibility.bind(this);
            this._keyEventHandler = this._keyEventHandler.bind(this);
            this.state = this._fetchModelState();
            this.modelSubscriptions = [];
        }

        _fetchModelState() {
            return {
                corpora: queryModel.getCorpora(),
                availableAlignedCorpora: queryModel.getAvailableAlignedCorpora(),
                supportsParallelCorpora: queryModel.supportsParallelCorpora(),
                queryTypes: queryModel.getQueryTypes(),
                supportedWidgets: queryModel.getSupportedWidgets(),
                lposValues: queryModel.getLposValues(),
                matchCaseValues: queryModel.getMatchCaseValues(),
                forcedAttr: queryModel.getForcedAttr(),
                defaultAttrValues: queryModel.getDefaultAttrValues(),
                attrList: queryModel.getAttrList(),
                structAttrList: queryModel.getStructAttrList(),
                tagsetDocUrls: queryModel.getTagsetDocUrls(),
                pcqPosNegValues: queryModel.getPcqPosNegValues(),
                includeEmptyValues: queryModel.getIncludeEmptyValues(),
                lemmaWindowSizes: queryModel.getLemmaWindowSizes(),
                posWindowSizes: queryModel.getPosWindowSizes(),
                hasLemmaAttr: queryModel.getHasLemmaAttr(),
                wPoSList: queryModel.getwPoSList(),
                contextFormVisible: false, // TODO use data from session?
                textTypesFormVisible: textTypesModel.hasSelectedItems(),
                hasSelectedTextTypes: textTypesModel.hasSelectedItems(),
                inputLanguages: queryModel.getInputLanguages(),
                textTypesNotes: queryModel.getTextTypesNotes(),
                useCQLEditor: queryModel.getUseCQLEditor(),
                tagAttr: queryModel.getTagAttr()
            };
        }

        _modelChangeHandler() {
            const state = this._fetchModelState();
            state['contextFormVisible'] = this.state.contextFormVisible;
            state['textTypesFormVisible'] = this.state.textTypesFormVisible;
            this.setState(state);
        }

        _handleSubmit() {
            dispatcher.dispatch({
                name: 'QUERY_INPUT_SUBMIT',
                payload: {}
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
            if (evt.keyCode === KeyCodes.ENTER && !evt.shiftKey) {
                if (!evt.ctrlKey && !evt.shiftKey) {
                    dispatcher.dispatch({
                        name: 'QUERY_INPUT_SUBMIT',
                        payload: {}
                    });
                }
                evt.stopPropagation();
                evt.preventDefault();
            }
        }

        componentDidMount() {
            this.modelSubscriptions = [
                queryModel.addListener(this._modelChangeHandler),
                textTypesModel.addListener(this._modelChangeHandler)
            ];
        }

        componentWillUnmount() {
            this.modelSubscriptions.forEach(s => s.unsubscribe());
            this._handleSubmit = undefined;
            this._handleContextFormVisibility = undefined;
            this._handleTextTypesFormVisibility = undefined;
            this._keyEventHandler = undefined;
        }

        render() {
            const primaryCorpname = this.state.corpora.get(0);
            return (
                <form className="query-form" onKeyDown={this._keyEventHandler}>
                    <table className="form primary-language">
                        <tbody>
                            {this.props.allowCorpusSelection ?
                                <TRCorpusField corparchWidget={CorparchWidget} />
                                : null}
                            <inputViews.TRQueryTypeField
                                    queryType={this.state.queryTypes.get(primaryCorpname)}
                                    sourceId={primaryCorpname}
                                    actionPrefix={this.props.actionPrefix}
                                    hasLemmaAttr={this.state.hasLemmaAttr.get(primaryCorpname)} />
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
                                tagsetDocUrl={this.state.tagsetDocUrls.get(primaryCorpname)}
                                tagHelperView={this.props.tagHelperViews.get(primaryCorpname)}
                                queryStorageView={this.props.queryStorageView}
                                inputLanguage={this.state.inputLanguages.get(primaryCorpname)}
                                actionPrefix={this.props.actionPrefix}
                                onEnterKey={this._handleSubmit}
                                useCQLEditor={this.state.useCQLEditor}
                                takeFocus={true} />
                        </tbody>
                    </table>
                    {this.state.supportsParallelCorpora ?
                        <alignedViews.AlignedCorpora
                                availableCorpora={this.state.availableAlignedCorpora}
                                alignedCorpora={this.state.corpora.rest().toList()}
                                queryTypes={this.state.queryTypes}
                                supportedWidgets={this.state.supportedWidgets}
                                wPoSList={this.state.wPoSList}
                                lposValues={this.state.lposValues}
                                matchCaseValues={this.state.matchCaseValues}
                                forcedAttr={this.state.forcedAttr}
                                defaultAttrValues={this.state.defaultAttrValues}
                                attrList={this.state.attrList}
                                tagsetDocUrls={this.state.tagsetDocUrls}
                                pcqPosNegValues={this.state.pcqPosNegValues}
                                includeEmptyValues={this.state.includeEmptyValues}
                                inputLanguages={this.state.inputLanguages}
                                queryStorageView={this.props.queryStorageView}
                                hasLemmaAttr={this.state.hasLemmaAttr}
                                useCQLEditor={this.state.useCQLEditor}
                                tagHelperViews={this.props.tagHelperViews}
                                onEnterKey={this._handleSubmit} />
                        : null
                    }
                    <fieldset id="specify-context">
                        <AdvancedFormLegend
                                formVisible={this.state.contextFormVisible}
                                handleClick={this._handleContextFormVisibility}
                                title={he.translate('query__specify_context')}
                                hintWhenClosed={null} />
                        {this.state.contextFormVisible ?
                            <contextViews.SpecifyContextForm
                                    lemmaWindowSizes={this.state.lemmaWindowSizes}
                                    posWindowSizes={this.state.posWindowSizes}
                                    hasLemmaAttr={this.state.hasLemmaAttr.get(primaryCorpname)}
                                    wPoSList={this.state.wPoSList} />
                            : null}
                    </fieldset>
                    <fieldset className="specify-query-metainformation">
                        <AdvancedFormLegend
                                formVisible={this.state.textTypesFormVisible}
                                handleClick={this._handleTextTypesFormVisibility}
                                title={he.translate('query__specify_tt')}
                                hintWhenClosed={this.state.hasSelectedTextTypes ? he.translate('query__contains_selected_text_types') : null} />
                        {this.state.textTypesFormVisible ?
                                <ttViews.TextTypesPanel
                                        liveAttrsView={this.props.liveAttrsView}
                                        liveAttrsCustomTT={this.props.liveAttrsCustomTT}
                                        onReady={()=>undefined} />
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
            <fieldset className="SelectedTextTypesLite specify-query-metainformation">
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

    class QueryFormLite extends React.Component<QueryFormLiteProps, QueryFormLiteState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this._keyEventHandler = this._keyEventHandler.bind(this);
            this._handleContextFormVisibility = this._handleContextFormVisibility.bind(this);
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
            this._handleSubmit = this._handleSubmit.bind(this);
            this.state = this._fetchModelState();
        }

        _fetchModelState() {
            return {
                corpora: queryModel.getCorpora(),
                queryTypes: queryModel.getQueryTypes(),
                supportedWidgets: queryModel.getSupportedWidgets(),
                lposValues: queryModel.getLposValues(),
                matchCaseValues: queryModel.getMatchCaseValues(),
                forcedAttr: queryModel.getForcedAttr(),
                defaultAttrValues: queryModel.getDefaultAttrValues(),
                attrList: queryModel.getAttrList(),
                tagsetDocUrls: queryModel.getTagsetDocUrls(),
                pcqPosNegValues: queryModel.getPcqPosNegValues(),
                includeEmptyValues: queryModel.getIncludeEmptyValues(),
                lemmaWindowSizes: queryModel.getLemmaWindowSizes(),
                posWindowSizes: queryModel.getPosWindowSizes(),
                hasLemmaAttr: queryModel.getHasLemmaAttr(),
                wPoSList: queryModel.getwPoSList(),
                contextFormVisible: false,
                inputLanguages: queryModel.getInputLanguages(),
                hasSelectedTextTypes: textTypesModel.hasSelectedItems(),
                textTypeSelections: textTypesModel.exportSelections(false),
                useCQLEditor: queryModel.getUseCQLEditor()
            };
        }

        _keyEventHandler(evt) {
            if (evt.keyCode === KeyCodes.ENTER && !evt.shiftKey) {
                if (!evt.ctrlKey) {
                    if (this.props.operationIdx !== undefined) {
                        dispatcher.dispatch<Actions.BranchQuery>({
                            name: ActionName.BranchQuery,
                            payload: {operationIdx: this.props.operationIdx}
                        });

                    } else {
                        dispatcher.dispatch({
                            name: 'QUERY_INPUT_SUBMIT',
                            payload: {}
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
                dispatcher.dispatch<Actions.BranchQuery>({
                    name: ActionName.BranchQuery,
                    payload: {operationIdx: this.props.operationIdx}
                });

            } else {
                dispatcher.dispatch({
                    name: 'QUERY_INPUT_SUBMIT',
                    payload: {}
                });
            }
        }

        _modelChangeHandler() {
            const state = this._fetchModelState();
            state['contextFormVisible'] = this.state.contextFormVisible;
            this.setState(state);
        }

        componentDidMount() {
            this.modelSubscription = queryModel.addListener(this._modelChangeHandler);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
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
                                    hasLemmaAttr={this.state.hasLemmaAttr.get(this.props.corpname)} />
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
                                tagsetDocUrl={this.state.tagsetDocUrls.get(this.props.corpname)}
                                tagHelperView={this.props.tagHelperView}
                                queryStorageView={this.props.queryStorageView}
                                inputLanguage={this.state.inputLanguages.get(this.props.corpname)}
                                actionPrefix={this.props.actionPrefix}
                                onEnterKey={this._handleSubmit}
                                useCQLEditor={this.state.useCQLEditor} />
                        </tbody>
                    </table>
                    <fieldset id="specify-context">
                        <AdvancedFormLegend
                                formVisible={this.state.contextFormVisible}
                                handleClick={this._handleContextFormVisibility}
                                title={he.translate('query__specify_context')}
                                hintWhenClosed={null} />
                        {this.state.contextFormVisible ?
                            <contextViews.SpecifyContextForm
                                    lemmaWindowSizes={this.state.lemmaWindowSizes}
                                    posWindowSizes={this.state.posWindowSizes}
                                    hasLemmaAttr={this.state.hasLemmaAttr.get(this.props.corpname)}
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