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
import { Keyboard, List, Dict, pipe, tuple } from 'cnc-tskit';

import { init as inputInit } from './input';
import { init as alignedInit } from './aligned';
import { init as contextInit } from './context';
import { init as ttViewsInit } from '../textTypes';
import { Kontext, TextTypes } from '../../types/common';
import { PluginInterfaces } from '../../types/plugins';
import { FirstQueryFormModel, FirstQueryFormModelState } from '../../models/query/first';
import { UsageTipsModel } from '../../models/usageTips';
import { TextTypesModel, TextTypesModelState } from '../../models/textTypes/main';
import { WithinBuilderModel } from '../../models/query/withinBuilder';
import { VirtualKeyboardModel } from '../../models/query/virtualKeyboard';
import { QueryContextModel } from '../../models/query/context';
import { ActionName, Actions } from '../../models/query/actions';
import { TTSelOps } from '../../models/textTypes/selectionOps';
import { HtmlHelpModel, HtmlHelpModelState } from '../../models/help/help';
import { Actions as HelpActions, ActionName as HelpActionName } from '../../models/help/actions';


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
    querySuggest:PluginInterfaces.QuerySuggest.IPlugin;
    queryHelpModel:HtmlHelpModel;
}


export interface QueryFormProps {
    formType:Kontext.ConcFormTypes.QUERY;
    allowCorpusSelection:boolean;
    tagHelperViews:{[key:string]:PluginInterfaces.TagHelper.View};
    queryStorageView:PluginInterfaces.QueryStorage.WidgetView;
    LiveAttrsView:PluginInterfaces.LiveAttributes.View;
    LiveAttrsCustomTT:PluginInterfaces.LiveAttributes.CustomAttribute;
}


export interface QueryFormLiteProps {
    corpname:string;
    operationIdx?:number;
    formType:Kontext.ConcFormTypes.QUERY;
    tagHelperView:PluginInterfaces.TagHelper.View;
    queryStorageView:PluginInterfaces.QueryStorage.WidgetView;
}


export interface QueryHelpProps {
    isLocalUiLang:boolean;
    tagsets:{[corpname:string]:Array<PluginInterfaces.TagHelper.TagsetInfo>};
}


export interface MainViews {
    QueryForm:React.ComponentClass<QueryFormProps>;
    QueryFormLite:React.ComponentClass<QueryFormLiteProps>;
    QueryHelp:React.ComponentClass<QueryHelpProps>;
}


export function init({dispatcher, he, CorparchWidget, queryModel,
                      textTypesModel, queryHintModel, withinBuilderModel, virtualKeyboardModel,
                      queryContextModel, querySuggest, queryHelpModel}:MainModuleArgs):MainViews {

    const inputViews = inputInit({
        dispatcher,
        he,
        queryModel,
        queryHintModel,
        withinBuilderModel,
        virtualKeyboardModel,
        querySuggest
    });
    const alignedViews = alignedInit({
            dispatcher: dispatcher,
            he: he,
            inputViews: inputViews
    });
    const contextViews = contextInit(dispatcher, he, queryContextModel);
    const ttViews = ttViewsInit(dispatcher, he, textTypesModel);
    const layoutViews = he.getLayoutViews();


    // ------------------- <TRCorpusField /> -----------------------------

    const TRCorpusField:React.FC<{
        corparchWidget:PluginInterfaces.Corparch.WidgetView;

    }> = (props) => {

        return (
            <div>
                <props.corparchWidget  />
            </div>
        );
    };

    // ------------------ <TextTypesFieldsetHint /> -----------------------

    const TextTypesFieldsetHint:React.FC<TextTypesModelState> = (props) => (
        props.hasSelectedItems ?
            <span title={he.translate('query__contains_selected_text_types')}>{'\u2713'}</span> :
            null
    );

    const BoundTextTypesFieldsetHint = Bound<TextTypesModelState>(TextTypesFieldsetHint, textTypesModel);


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
            dispatcher.dispatch<Actions.QuerySubmit>({
                name: ActionName.QuerySubmit
            });
        }

        _keyEventHandler(evt) {
            if (evt.keyCode === Keyboard.Code.ENTER && !evt.shiftKey) {
                if (!evt.ctrlKey && !evt.shiftKey) {
                    dispatcher.dispatch<Actions.QuerySubmit>({
                        name: ActionName.QuerySubmit
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
            const primaryCorpname = List.head(this.props.corpora);
            return (
                <form className="query-form" onKeyDown={this._keyEventHandler}>
                    <div className="form primary-language">
                        {this.props.allowCorpusSelection ?
                            <TRCorpusField corparchWidget={CorparchWidget} />
                            : null}
                        <div className="query">
                            <inputViews.TRQueryInputField
                                widgets={this.props.supportedWidgets[primaryCorpname]}
                                sourceId={primaryCorpname}
                                wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValues[primaryCorpname]}
                                forcedAttr={this.props.forcedAttr}
                                attrList={this.props.attrList}
                                tagHelperView={this.props.tagHelperViews[primaryCorpname]}
                                tagsets={this.props.tagsets[primaryCorpname]}
                                queryStorageView={this.props.queryStorageView}
                                inputLanguage={this.props.inputLanguages[primaryCorpname]}
                                onEnterKey={this._handleSubmit}
                                useRichQueryEditor={this.props.useRichQueryEditor}
                                takeFocus={true}
                                qsuggPlugin={querySuggest} />
                        </div>
                    </div>
                    {this.props.corpora.length > 1 || this.props.availableAlignedCorpora.length > 0 ?
                        <alignedViews.AlignedCorpora
                                availableCorpora={this.props.availableAlignedCorpora}
                                primaryCorpus={primaryCorpname}
                                alignedCorpora={List.tail(this.props.corpora)}
                                sectionVisible={this.props.alignedCorporaVisible}
                                supportedWidgets={this.props.supportedWidgets}
                                wPoSList={this.props.wPoSList}
                                queries={this.props.queries}
                                lposValues={this.props.lposValues}
                                forcedAttr={this.props.forcedAttr}
                                attrList={this.props.attrList}
                                inputLanguages={this.props.inputLanguages}
                                queryStorageView={this.props.queryStorageView}
                                hasLemmaAttr={this.props.hasLemma}
                                useRichQueryEditor={this.props.useRichQueryEditor}
                                tagHelperViews={this.props.tagHelperViews}
                                tagsets={this.props.tagsets}
                                onEnterKey={this._handleSubmit} />
                        : null
                    }
                    <inputViews.AdvancedFormFieldset
                            uniqId="section-specify-context"
                            formVisible={this.props.contextFormVisible}
                            handleClick={this._handleContextFormVisibility}
                            htmlClass="specify-context"
                            title={he.translate('query__specify_context')}>
                        <contextViews.SpecifyContextForm
                                hasLemmaAttr={this.props.hasLemma[primaryCorpname]}
                                wPoSList={this.props.wPoSList} />
                    </inputViews.AdvancedFormFieldset>
                    <inputViews.AdvancedFormFieldset
                        uniqId="section-specify-text-types"
                                formVisible={this.props.textTypesFormVisible}
                                handleClick={this._handleTextTypesFormVisibility}
                                title={he.translate('query__specify_tt')}
                                htmlClass="specify-text-types"
                                closedStateHint={<BoundTextTypesFieldsetHint />}
                                closedStateDesc={this.props.textTypesNotes}>
                            <ttViews.TextTypesPanel
                                    LiveAttrsView={this.props.LiveAttrsView}
                                    LiveAttrsCustomTT={this.props.LiveAttrsCustomTT} />
                    </inputViews.AdvancedFormFieldset>
                    <div className="buttons">
                        {this.props.isBusy ?
                            <layoutViews.AjaxLoaderBarImage /> :
                            <button type="button" className="default-button" onClick={this._handleSubmit}>
                                {he.translate('query__search_btn')}
                            </button>
                        }
                    </div>
                </form>
            );
        }
    }

    // -------- <SelectedTextTypesLite /> ---------------------------


    const shortenValues = (values:Array<React.ReactElement>) => {

        if (typeof(values) === 'string') {
            return values;
        }

        let ans:Array<React.ReactElement>;
        if (values.length > 5) {
            ans = values.slice(0, 2);
            ans.push(<span>{'\u2026'}</span>);
            ans = ans.concat(values.slice(values.length - 2, values.length));

        } else {
            ans = values;
        }
        return ans;
    };

    const SelectedTextTypesLite:React.FC<TextTypesModelState> = (props) => {

        function renderValues(position:number, name:string, values:Array<TextTypes.AttributeValue>) {
            const selValues = pipe(
                values,
                List.filter(v => v.selected),
                List.map(v => <span key={v.value} className="attr-val">{v.value}</span>)
            );
            return <span>
                {position > 0 ? ', ' : ''}
                <strong>{name}</strong>
                {'\u00a0\u2208\u00a0{'}
                {List.join(i => <span key={`j${i}`}>, </span>, shortenValues(selValues))}
                {'}'}
                <br />
            </span>;
        }

        function renderSelections(sel:TextTypes.AnyTTSelection, i:number) {
            switch (sel.type) {
                case 'full':
                    return renderValues(i, sel.name, sel.values);
                case 'regexp':
                    return <span>
                        {i > 0 ? ', ' : ''}
                        <strong>{sel.name}</strong>
                        {'\u00a0\u2208\u00a0'}
                        {'{' + sel.textFieldDecoded + '}'}
                        <br />
                    </span>;
                case 'text':
                    if (!List.empty(sel.values)) {
                        return renderValues(i, sel.name, sel.values);
                    }
                    return <span>{sel.textFieldValue}</span>;
            }
        }

        if (props.hasSelectedItems) {
            return (
                <section className="SelectedTextTypesLite specify-text-types">
                    <h2>
                        <layoutViews.ExpandButton isExpanded={props.hasSelectedItems} />
                        <span>{he.translate('query__chosen_texts')}</span>
                    </h2>
                    <div className="contents">
                        <ul>
                            {pipe(
                                props.attributes,
                                List.filter(attr => TTSelOps.hasUserChanges(attr)),
                                List.map(
                                    (attr, i) => (
                                        <li key={`${attr.name}:${i}`}>
                                            {renderSelections(attr, i)}
                                        </li>
                                    )
                                ))
                            }
                        </ul>
                        <p className="hint note">
                            ({he.translate('query__chosen_texts_cannot_be_changed')})
                        </p>
                    </div>
                </section>
            );

        } else {
            return <section className="SelectedTextTypesLite" />;
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
                        dispatcher.dispatch<Actions.QuerySubmit>({
                            name: ActionName.QuerySubmit
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
                dispatcher.dispatch<Actions.QuerySubmit>({
                    name: ActionName.QuerySubmit
                });
            }
        }

        render() {
            return (
                <form className="query-form" onKeyDown={this._keyEventHandler}>
                    <div className="form primary-language">
                        <inputViews.TRQueryInputField
                            widgets={this.props.supportedWidgets[this.props.corpname]}
                            sourceId={this.props.corpname}
                            wPoSList={this.props.wPoSList}
                            lposValue={this.props.lposValues[this.props.corpname]}
                            forcedAttr={this.props.forcedAttr}
                            attrList={this.props.attrList}
                            tagHelperView={this.props.tagHelperView}
                            queryStorageView={this.props.queryStorageView}
                            inputLanguage={this.props.inputLanguages[this.props.corpname]}
                            onEnterKey={this._handleSubmit}
                            useRichQueryEditor={this.props.useRichQueryEditor}
                            qsuggPlugin={querySuggest}
                            tagsets={this.props.tagsets[this.props.corpname]} />
                    </div>
                    <inputViews.AdvancedFormFieldset
                            uniqId="section-specify-context"
                            formVisible={this.props.contextFormVisible}
                            handleClick={this._handleContextFormVisibility}
                            htmlClass="specify-context"
                            title={he.translate('query__specify_context')}>
                        <contextViews.SpecifyContextForm
                                hasLemmaAttr={this.props.hasLemma[this.props.corpname]}
                                wPoSList={this.props.wPoSList} />
                    </inputViews.AdvancedFormFieldset>
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

    // ------------------- <QueryHelp /> -----------------------------

    const QueryHelp:React.FC<QueryHelpProps & HtmlHelpModelState> = (props) => {

        const [visible, changeState] = React.useState(false);

        const toggleHelp = () => {
            if (!visible) {
                dispatcher.dispatch<HelpActions.HelpRequested>({
                    name: HelpActionName.HelpRequested,
                    payload: {
                        section: 'query'
                    }
                });
            };
            changeState(!visible);
        };

        return (
            <div className="QueryHelp topbar-help-icon">
                <a className="icon" onClick={toggleHelp}>
                    <layoutViews.ImgWithMouseover
                        htmlClass="over-img"
                        src={he.createStaticUrl('img/question-mark.svg')}
                        alt={he.translate('global__click_to_see_help')} />
                </a>
                {visible ?
                    <layoutViews.ModalOverlay onCloseKey={toggleHelp}>
                        <layoutViews.CloseableFrame onCloseClick={toggleHelp} customClass="block-help" label={he.translate('query__help')}>
                            <div>
                                <div dangerouslySetInnerHTML={{__html: props.rawHtml}}/>
                                <p><a target="_blank" href={he.getHelpLink('term_cql')}>{he.getHelpLink('term_cql')}</a></p>
                                <h2>{he.translate('query__tagset_summary')}</h2>
                                {Dict.empty(props.tagsets) ?
                                    null :
                                    <ul className="tagset-links">{pipe(
                                        props.tagsets,
                                        Dict.toEntries(),
                                        List.map(
                                            ([corpus, tagsets]) => (
                                                <li key={`item:${corpus}`}>
                                                    <h3>{corpus}</h3>
                                                    <dl>{pipe(
                                                        tagsets,
                                                        List.map(tagset => tuple(
                                                            tagset,
                                                            props.isLocalUiLang ? tagset.docUrlLocal : tagset.docUrlEn
                                                        )),
                                                        List.forEach(v => console.log('tagset: ', v)),
                                                        List.filter(([,url]) => !!url),
                                                        List.map(
                                                            ([tagset, url]) => (
                                                                <React.Fragment key={`item:${tagset.ident}`}>
                                                                    <dt>
                                                                        {he.translate('global__attribute').toLocaleLowerCase()}{'\u00a0'}
                                                                        <span className="attr">{tagset.featAttr}</span>:
                                                                    </dt>
                                                                    <dd>
                                                                        <a className="external" target="_blank" href={url}>{url}</a>
                                                                    </dd>
                                                                </React.Fragment>
                                                            )
                                                        )
                                                    )}</dl>
                                                </li>
                                            ))
                                    )}</ul>
                                }
                            </div>
                        </layoutViews.CloseableFrame>
                    </layoutViews.ModalOverlay> :
                    null
                }
            </div>
        );
    };

    return {
        QueryForm: BoundWithProps<QueryFormProps, FirstQueryFormModelState>(QueryForm, queryModel),
        QueryFormLite: BoundWithProps<QueryFormLiteProps, FirstQueryFormModelState>(QueryFormLite, queryModel),
        QueryHelp: BoundWithProps<QueryHelpProps, HtmlHelpModelState>(QueryHelp, queryHelpModel)
    };
}