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
import { IActionDispatcher, BoundWithProps, Bound } from 'kombo';

import { init as inputInit } from './input';
import { init as alignedInit } from './aligned';
import { init as contextInit } from './context';
import { init as ttViewsInit } from '../textTypes';
import { Kontext } from '../../types/common';
import { PluginInterfaces } from '../../types/plugins';
import { FirstQueryFormModel, FirstQueryFormModelState } from '../../models/query/first';
import { UsageTipsModel } from '../../models/usageTips';
import { TextTypesModel, TextTypesModelState } from '../../models/textTypes/main';
import { WithinBuilderModel } from '../../models/query/withinBuilder';
import { VirtualKeyboardModel } from '../../models/query/virtualKeyboard';
import { QueryContextModel } from '../../models/query/context';
import { CQLEditorModel } from '../../models/query/cqleditor/model';
import { ActionName, Actions } from '../../models/query/actions';
import { Keyboard, List } from 'cnc-tskit';


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
    allowCorpusSelection:boolean;
    tagHelperViews:{[key:string]:PluginInterfaces.TagHelper.View};
    queryStorageView:PluginInterfaces.QueryStorage.WidgetView;
    liveAttrsView:PluginInterfaces.LiveAttributes.View;
    liveAttrsCustomTT:PluginInterfaces.LiveAttributes.CustomAttribute;
    attributes:any; // TODO type once text types JSX->TSX
}


export interface QueryFormLiteProps {
    corpname:string;
    operationIdx?:number;
    tagHelperView:PluginInterfaces.TagHelper.View;
    queryStorageView:PluginInterfaces.QueryStorage.WidgetView;
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

    interface AdvancedFormLegendProps {
        formVisible:boolean;
        title:string;
        handleClick:()=>void;
    }

    const AdvancedFormLegend:React.SFC<AdvancedFormLegendProps & TextTypesModelState> = (props) => {

        const htmlClasses = ['form-extension-switch'];
        htmlClasses.push(props.formVisible ? 'collapse' : 'expand');
        const hintWhenClosed = props.hasSelectedItems ? he.translate('query__contains_selected_text_types') : null;

        return (
            <legend>
                <a className={htmlClasses.join(' ')}
                        onClick={props.handleClick}>
                    {props.title}
                </a>
                {!props.formVisible && hintWhenClosed ? <span title={hintWhenClosed}>{'\u2713'}</span> : null}
            </legend>
        );
    };

    const BoundAdvancedFormLegend = BoundWithProps<AdvancedFormLegendProps, TextTypesModelState>(AdvancedFormLegend, textTypesModel);

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

    class QueryForm extends React.PureComponent<QueryFormProps & FirstQueryFormModelState> {

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
            if (evt.keyCode === Keyboard.Code.ENTER && !evt.shiftKey) {
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
            const primaryCorpname = this.props.corpora[0];
            return (
                <form className="query-form" onKeyDown={this._keyEventHandler}>
                    <table className="form primary-language">
                        <tbody>
                            {this.props.allowCorpusSelection ?
                                <TRCorpusField corparchWidget={CorparchWidget} />
                                : null}
                            <inputViews.TRQueryTypeField
                                    formType={this.props.formType}
                                    queryType={this.props.queryTypes[primaryCorpname]}
                                    sourceId={primaryCorpname}
                                    hasLemmaAttr={this.props.hasLemma[primaryCorpname]} />
                        </tbody>
                        <tbody>
                            <inputViews.TRQueryInputField
                                queryType={this.props.queryTypes[primaryCorpname]}
                                widgets={this.props.supportedWidgets[primaryCorpname]}
                                sourceId={primaryCorpname}
                                wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValues[primaryCorpname]}
                                matchCaseValue={this.props.matchCaseValues[primaryCorpname]}
                                forcedAttr={this.props.forcedAttr}
                                defaultAttr={this.props.defaultAttrValues[primaryCorpname]}
                                attrList={this.props.attrList}
                                tagsetDocUrl={this.props.tagsetDocs[primaryCorpname]}
                                tagHelperView={this.props.tagHelperViews[primaryCorpname]}
                                queryStorageView={this.props.queryStorageView}
                                inputLanguage={this.props.inputLanguages[primaryCorpname]}
                                onEnterKey={this._handleSubmit}
                                useCQLEditor={this.props.useCQLEditor}
                                takeFocus={true} />
                        </tbody>
                    </table>
                    {this.props.corpora.length > 1 || this.props.availableAlignedCorpora.length > 0 ?
                        <alignedViews.AlignedCorpora
                                availableCorpora={this.props.availableAlignedCorpora}
                                alignedCorpora={List.tail(this.props.corpora)}
                                queryTypes={this.props.queryTypes}
                                supportedWidgets={this.props.supportedWidgets}
                                wPoSList={this.props.wPoSList}
                                lposValues={this.props.lposValues}
                                matchCaseValues={this.props.matchCaseValues}
                                forcedAttr={this.props.forcedAttr}
                                defaultAttrValues={this.props.defaultAttrValues}
                                attrList={this.props.attrList}
                                tagsetDocUrls={this.props.tagsetDocs}
                                pcqPosNegValues={this.props.pcqPosNegValues}
                                includeEmptyValues={this.props.includeEmptyValues}
                                inputLanguages={this.props.inputLanguages}
                                queryStorageView={this.props.queryStorageView}
                                hasLemmaAttr={this.props.hasLemma}
                                useCQLEditor={this.props.useCQLEditor}
                                tagHelperViews={this.props.tagHelperViews}
                                onEnterKey={this._handleSubmit} />
                        : null
                    }
                    <fieldset id="specify-context">
                        <BoundAdvancedFormLegend
                                formVisible={this.props.contextFormVisible}
                                handleClick={this._handleContextFormVisibility}
                                title={he.translate('query__specify_context')} />
                        {this.props.contextFormVisible ?
                            <contextViews.SpecifyContextForm
                                    lemmaWindowSizes={this.props.lemmaWindowSizes}
                                    posWindowSizes={this.props.posWindowSizes}
                                    hasLemmaAttr={this.props.hasLemma[primaryCorpname]}
                                    wPoSList={this.props.wPoSList} />
                            : null}
                    </fieldset>
                    <fieldset className="specify-query-metainformation">
                        <BoundAdvancedFormLegend
                                formVisible={this.props.textTypesFormVisible}
                                handleClick={this._handleTextTypesFormVisibility}
                                title={he.translate('query__specify_tt')} />
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

    const SelectedTextTypesLite:React.SFC<TextTypesModelState> = (props) => {
        if (props.hasSelectedItems) {
            return (
                <fieldset className="SelectedTextTypesLite specify-query-metainformation">
                    <legend>{he.translate('query__chosen_texts')}</legend>
                    <ul>
                        {Object.keys(props.attributes).map(v => (
                            <li key={v}>
                                <strong>{v}</strong>
                                {' \u2208 {' + props.attributes[v].map(v => `"${v}"`).join(', ') + '}'}
                            </li>
                        ))}
                    </ul>
                    <p className="hint">
                        ({he.translate('query__chosen_texts_cannot_be_changed')})
                    </p>
                </fieldset>
            );

        } else {
            return <fieldset className="SelectedTextTypesLite" />;
        }
    }

    const BoundSelectedTextTypesLite = Bound(SelectedTextTypesLite, textTypesModel);

    // -------- <QueryFormLite /> ------------------------------------

    class QueryFormLite extends React.PureComponent<QueryFormLiteProps & FirstQueryFormModelState> {

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
                                    formType={this.props.formType}
                                    queryType={this.props.queryTypes[this.props.corpname]}
                                    sourceId={this.props.corpname}
                                    hasLemmaAttr={this.props.hasLemma[this.props.corpname]} />
                            <inputViews.TRQueryInputField
                                queryType={this.props.queryTypes[this.props.corpname]}
                                widgets={this.props.supportedWidgets[this.props.corpname]}
                                sourceId={this.props.corpname}
                                wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValues[this.props.corpname]}
                                matchCaseValue={this.props.matchCaseValues[this.props.corpname]}
                                forcedAttr={this.props.forcedAttr}
                                defaultAttr={this.props.defaultAttrValues[this.props.corpname]}
                                attrList={this.props.attrList}
                                tagsetDocUrl={this.props.tagsetDocs[this.props.corpname]}
                                tagHelperView={this.props.tagHelperView}
                                queryStorageView={this.props.queryStorageView}
                                inputLanguage={this.props.inputLanguages[this.props.corpname]}
                                onEnterKey={this._handleSubmit}
                                useCQLEditor={this.props.useCQLEditor} />
                        </tbody>
                    </table>
                    <fieldset id="specify-context">
                        <BoundAdvancedFormLegend
                                formVisible={this.props.contextFormVisible}
                                handleClick={this._handleContextFormVisibility}
                                title={he.translate('query__specify_context')} />
                        {this.props.contextFormVisible ?
                            <contextViews.SpecifyContextForm
                                    lemmaWindowSizes={this.props.lemmaWindowSizes}
                                    posWindowSizes={this.props.posWindowSizes}
                                    hasLemmaAttr={this.props.hasLemma[this.props.corpname]}
                                    wPoSList={this.props.wPoSList} />
                            : null}
                    </fieldset>
                    <BoundSelectedTextTypesLite />

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
        QueryForm: BoundWithProps<QueryFormProps, FirstQueryFormModelState>(QueryForm, queryModel),
        QueryFormLite: BoundWithProps<QueryFormLiteProps, FirstQueryFormModelState>(QueryFormLite, queryModel)
    };
}