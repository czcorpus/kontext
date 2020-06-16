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
import { Keyboard } from 'cnc-tskit';


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

    class QueryForm extends React.PureComponent<QueryFormProps & QueryFormState> {

        constructor(props) {
            super(props);
            this._handleSubmit = this._handleSubmit.bind(this);
            this._handleContextFormVisibility = this._handleContextFormVisibility.bind(this);
            this._handleTextTypesFormVisibility = this._handleTextTypesFormVisibility.bind(this);
            this._keyEventHandler = this._keyEventHandler.bind(this);
        }

        _handleSubmit() {
            dispatcher.dispatch({
                name: 'QUERY_INPUT_SUBMIT',
                payload: {}
            });
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

        _handleTextTypesFormVisibility() {
            dispatcher.dispatch<Actions.QueryTextTypesToggleForm>({
                name: ActionName.QueryTextTypesToggleForm
            });
        }

        _handleContextFormVisibility() {
            dispatcher.dispatch<Actions.QueryContextToggleForm>({
                name: ActionName.QueryContextToggleForm
            });
        }

        render() {
            const primaryCorpname = this.props.corpora.get(0);
            return (
                <form className="query-form" onKeyDown={this._keyEventHandler}>
                    <table className="form primary-language">
                        <tbody>
                            {this.props.allowCorpusSelection ?
                                <TRCorpusField corparchWidget={CorparchWidget} />
                                : null}
                            <inputViews.TRQueryTypeField
                                    queryType={this.props.queryTypes.get(primaryCorpname)}
                                    sourceId={primaryCorpname}
                                    actionPrefix={this.props.actionPrefix}
                                    hasLemmaAttr={this.props.hasLemmaAttr.get(primaryCorpname)} />
                        </tbody>
                        <tbody>
                            <inputViews.TRQueryInputField
                                queryType={this.props.queryTypes.get(primaryCorpname)}
                                widgets={this.props.supportedWidgets.get(primaryCorpname)}
                                sourceId={primaryCorpname}
                                wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValues.get(primaryCorpname)}
                                matchCaseValue={this.props.matchCaseValues.get(primaryCorpname)}
                                forcedAttr={this.props.forcedAttr}
                                defaultAttr={this.props.defaultAttrValues.get(primaryCorpname)}
                                attrList={this.props.attrList}
                                tagsetDocUrl={this.props.tagsetDocUrls.get(primaryCorpname)}
                                tagHelperView={this.props.tagHelperViews.get(primaryCorpname)}
                                queryStorageView={this.props.queryStorageView}
                                inputLanguage={this.props.inputLanguages.get(primaryCorpname)}
                                actionPrefix={this.props.actionPrefix}
                                onEnterKey={this._handleSubmit}
                                useCQLEditor={this.props.useCQLEditor}
                                takeFocus={true} />
                        </tbody>
                    </table>
                    {this.props.supportsParallelCorpora ?
                        <alignedViews.AlignedCorpora
                                availableCorpora={this.props.availableAlignedCorpora}
                                alignedCorpora={this.props.corpora.rest().toList()}
                                queryTypes={this.props.queryTypes}
                                supportedWidgets={this.props.supportedWidgets}
                                wPoSList={this.props.wPoSList}
                                lposValues={this.props.lposValues}
                                matchCaseValues={this.props.matchCaseValues}
                                forcedAttr={this.props.forcedAttr}
                                defaultAttrValues={this.props.defaultAttrValues}
                                attrList={this.props.attrList}
                                tagsetDocUrls={this.props.tagsetDocUrls}
                                pcqPosNegValues={this.props.pcqPosNegValues}
                                includeEmptyValues={this.props.includeEmptyValues}
                                inputLanguages={this.props.inputLanguages}
                                queryStorageView={this.props.queryStorageView}
                                hasLemmaAttr={this.props.hasLemmaAttr}
                                useCQLEditor={this.props.useCQLEditor}
                                tagHelperViews={this.props.tagHelperViews}
                                onEnterKey={this._handleSubmit} />
                        : null
                    }
                    <fieldset id="specify-context">
                        <AdvancedFormLegend
                                formVisible={this.props.contextFormVisible}
                                handleClick={this._handleContextFormVisibility}
                                title={he.translate('query__specify_context')}
                                hintWhenClosed={null} />
                        {this.props.contextFormVisible ?
                            <contextViews.SpecifyContextForm
                                    lemmaWindowSizes={this.props.lemmaWindowSizes}
                                    posWindowSizes={this.props.posWindowSizes}
                                    hasLemmaAttr={this.props.hasLemmaAttr.get(primaryCorpname)}
                                    wPoSList={this.props.wPoSList} />
                            : null}
                    </fieldset>
                    <fieldset className="specify-query-metainformation">
                        <AdvancedFormLegend
                                formVisible={this.props.textTypesFormVisible}
                                handleClick={this._handleTextTypesFormVisibility}
                                title={he.translate('query__specify_tt')}
                                hintWhenClosed={this.props.hasSelectedTextTypes ? he.translate('query__contains_selected_text_types') : null} />
                        {this.props.textTypesFormVisible ?
                                <ttViews.TextTypesPanel
                                        liveAttrsView={this.props.liveAttrsView}
                                        liveAttrsCustomTT={this.props.liveAttrsCustomTT}
                                        onReady={()=>undefined} />
                                : <TextTypesNotes description={this.props.textTypesNotes} />
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

    class QueryFormLite extends React.PureComponent<QueryFormLiteProps & QueryFormLiteState> {

        constructor(props) {
            super(props);
            this._keyEventHandler = this._keyEventHandler.bind(this);
            this._handleContextFormVisibility = this._handleContextFormVisibility.bind(this);
            this._handleSubmit = this._handleSubmit.bind(this);
        }

        _keyEventHandler(evt) {
            if (evt.keyCode === Keyboard.Code.ENTER && !evt.shiftKey) {
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
            dispatcher.dispatch<Actions.QueryContextToggleForm>({
                name: ActionName.QueryContextToggleForm
            });
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

        render() {
            return (
                <form className="query-form" onKeyDown={this._keyEventHandler}>
                    <table className="form primary-language">
                        <tbody>
                            <inputViews.TRQueryTypeField
                                    queryType={this.props.queryTypes.get(this.props.corpname)}
                                    sourceId={this.props.corpname}
                                    actionPrefix={this.props.actionPrefix}
                                    hasLemmaAttr={this.props.hasLemmaAttr.get(this.props.corpname)} />
                            <inputViews.TRQueryInputField
                                queryType={this.props.queryTypes.get(this.props.corpname)}
                                widgets={this.props.supportedWidgets.get(this.props.corpname)}
                                sourceId={this.props.corpname}
                                wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValues.get(this.props.corpname)}
                                matchCaseValue={this.props.matchCaseValues.get(this.props.corpname)}
                                forcedAttr={this.props.forcedAttr}
                                defaultAttr={this.props.defaultAttrValues.get(this.props.corpname)}
                                attrList={this.props.attrList}
                                tagsetDocUrl={this.props.tagsetDocUrls.get(this.props.corpname)}
                                tagHelperView={this.props.tagHelperView}
                                queryStorageView={this.props.queryStorageView}
                                inputLanguage={this.props.inputLanguages.get(this.props.corpname)}
                                actionPrefix={this.props.actionPrefix}
                                onEnterKey={this._handleSubmit}
                                useCQLEditor={this.props.useCQLEditor} />
                        </tbody>
                    </table>
                    <fieldset id="specify-context">
                        <AdvancedFormLegend
                                formVisible={this.props.contextFormVisible}
                                handleClick={this._handleContextFormVisibility}
                                title={he.translate('query__specify_context')}
                                hintWhenClosed={null} />
                        {this.props.contextFormVisible ?
                            <contextViews.SpecifyContextForm
                                    lemmaWindowSizes={this.props.lemmaWindowSizes}
                                    posWindowSizes={this.props.posWindowSizes}
                                    hasLemmaAttr={this.props.hasLemmaAttr.get(this.props.corpname)}
                                    wPoSList={this.props.wPoSList} />
                            : null}
                    </fieldset>
                    {this.props.hasSelectedTextTypes ?
                        <SelectedTextTypesLite data={this.props.textTypeSelections} /> : null}

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