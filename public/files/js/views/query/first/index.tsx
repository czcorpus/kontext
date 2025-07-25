/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import { init as inputInit } from '../input/index.js';
import { init as alignedInit } from '../aligned/index.js';
import { init as contextInit } from '../context.js';
import { init as ttViewsInit } from '../../textTypes/index.js';
import { init as quickSubcorpViewsInit } from '../../subcorp/quickSubcorp.js';
import * as Kontext from '../../../types/kontext.js';
import * as TextTypes from '../../../types/textTypes.js';
import * as PluginInterfaces from '../../../types/plugins/index.js';
import { FirstQueryFormModel, FirstQueryFormModelState } from '../../../models/query/first.js';
import { UsageTipsModel } from '../../../models/usageTips/index.js';
import { TextTypesModel, TextTypesModelState } from '../../../models/textTypes/main.js';
import { WithinBuilderModel } from '../../../models/query/withinBuilder.js';
import { VirtualKeyboardModel } from '../../../models/query/virtualKeyboard.js';
import { QueryContextModel } from '../../../models/query/context.js';
import { Actions } from '../../../models/query/actions.js';
import { TTSelOps } from '../../../models/textTypes/selectionOps.js';
import { Actions as HelpActions } from '../../../models/help/actions.js';
import * as S from './style.js';
import * as SC from '../input/style.js';
import * as theme from '../../theme/default/index.js';
import { QueryHelpModel, QueryHelpModelState } from '../../../models/help/queryHelp.js';
import { SearchHistoryModel } from '../../../models/searchHistory/index.js';
import { QuickSubcorpModel } from '../../../models/subcorp/quickSubcorp.js';


export interface MainModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    CorparchWidget:PluginInterfaces.Corparch.WidgetView;
    corparchWidgetId:string;
    queryModel:FirstQueryFormModel;
    textTypesModel: TextTypesModel;
    quickSubcorpModel:QuickSubcorpModel;
    queryHintModel:UsageTipsModel;
    withinBuilderModel:WithinBuilderModel;
    virtualKeyboardModel:VirtualKeyboardModel;
    queryContextModel:QueryContextModel;
    querySuggest:PluginInterfaces.QuerySuggest.IPlugin;
    queryHelpModel:QueryHelpModel;
    searchHistoryModel:SearchHistoryModel;
}


export interface QueryFormProps {
    formType:Kontext.ConcFormTypes.QUERY;
    allowCorpusSelection:boolean;
    tagHelperViews:{[key:string]:PluginInterfaces.TagHelper.View};
    LiveAttrsView:PluginInterfaces.LiveAttributes.View;
    LiveAttrsCustomTT:PluginInterfaces.LiveAttributes.CustomAttribute;
}


export interface QueryFormLiteProps {
    corpname:string;
    operationIdx?:number;
    formType:Kontext.ConcFormTypes.QUERY;
    tagHelperView:PluginInterfaces.TagHelper.View;
}


export interface QueryHelpProps {
    isLocalUiLang:boolean;
}


export interface MissingALQProps {
    maincorp:string;
    tagHelperViews:{[key:string]:PluginInterfaces.TagHelper.View};
}


export interface MainViews {
    QueryForm:React.ComponentClass<QueryFormProps>;
    QueryFormLite:React.ComponentClass<QueryFormLiteProps>;
    QueryHelp:React.ComponentClass<QueryHelpProps>;
    MissingAlignedQueryForm:React.ComponentClass<MissingALQProps>;
}


export function init({
    dispatcher, he, CorparchWidget, queryModel,
    textTypesModel, quickSubcorpModel, queryHintModel, withinBuilderModel, virtualKeyboardModel,
    queryContextModel, querySuggest, queryHelpModel, searchHistoryModel, corparchWidgetId}:MainModuleArgs):MainViews {

    const inputViews = inputInit({
        dispatcher,
        he,
        queryModel,
        queryHintModel,
        withinBuilderModel,
        virtualKeyboardModel,
        querySuggest,
        searchHistoryModel
    });
    const {AlignedCorpora, AlignedCorporaLite} = alignedInit({
            dispatcher: dispatcher,
            he: he,
            inputViews: inputViews
    });
    const contextViews = contextInit(dispatcher, he, queryContextModel);
    const ttViews = ttViewsInit(dispatcher, he, textTypesModel);
    const quickSubcorpViews = quickSubcorpModel ? quickSubcorpViewsInit({ dispatcher, he, quickSubcorpModel }) : null;
    const layoutViews = he.getLayoutViews();


    // ------------------- <TRCorpusField /> -----------------------------

    const TRCorpusField:React.FC<{
        corparchWidget:PluginInterfaces.Corparch.WidgetView;

    }> = (props) => {

        return (
            <div>
                <props.corparchWidget widgetId={corparchWidgetId} />
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

    const QueryForm:React.FC<QueryFormProps & FirstQueryFormModelState> = (props) => {

        const handleSubmit = () => {
            dispatcher.dispatch<typeof Actions.QuerySubmit>({
                name: Actions.QuerySubmit.name
            });
        };

        const keyEventHandler = (evt) => {
            if (evt.key === Keyboard.Value.ENTER && !evt.shiftKey) {
                if (!evt.ctrlKey && !evt.shiftKey) {
                    dispatcher.dispatch<typeof Actions.QuerySubmit>({
                        name: Actions.QuerySubmit.name
                    });
                }
                evt.stopPropagation();
                evt.preventDefault();
            }
        };

        const handleTextTypesFormVisibility = () => {
            dispatcher.dispatch(
                Actions.QueryTextTypesToggleForm,
                {visible: !props.textTypesFormVisible}
            );
        };

        const handleContextFormVisibility = () => {
            dispatcher.dispatch<typeof Actions.QueryContextToggleForm>({
                name: Actions.QueryContextToggleForm.name
            });
        };

        const handleShowQuickSubcorpWidget = () => {
            if (props.quickSubcorpActive) {
                if (props.LiveAttrsView) {
                    dispatcher.dispatch(
                        PluginInterfaces.LiveAttributes.Actions.RefineClicked,
                        {onlyUnlockedSelections: true}
                    );
                }
                dispatcher.dispatch(
                    Actions.QueryShowQuickSubcorpWidget
                );
            }
        };

        const handleShowDownloadDocumentsWidget = () => {
            dispatcher.dispatch(
                PluginInterfaces.LiveAttributes.Actions.ToggleDocumentListWidget
            );
        };

        const handleHideQuickSubcorpWidget = () => {
            dispatcher.dispatch<typeof Actions.QueryHideQuickSubcorpWidget>({
                name: Actions.QueryHideQuickSubcorpWidget.name
            });
        };

        const primaryCorpname = List.head(props.corpora);
        const textTypesControls = [
            <a onClick={handleShowQuickSubcorpWidget}
                className={"util-button" + (props.quickSubcorpActive ? "" : " disabled")}>
                {he.translate('subc__quick_subcorpus')}
            </a>
        ];
        if (props.LiveAttrsView) {
            textTypesControls.push(
                <a onClick={handleShowDownloadDocumentsWidget}
                    className={"util-button" + (props.bibIdAttr ? "" : " disabled")}>
                    {he.translate('subc__save_list_of_documents')}
                </a>
            );
        }

        const onShuffleToggle = (value:boolean) => {
            dispatcher.dispatch(
                Actions.SetShuffle,
                {value}
            );
        };

        return (
            <S.QueryForm>
                <div onKeyDown={keyEventHandler}>
                    <div className="form primary-language">
                        {props.allowCorpusSelection ?
                            <TRCorpusField corparchWidget={CorparchWidget} />
                            : null}
                        <div className="query">
                            <inputViews.TRQueryInputField
                                widgets={props.supportedWidgets[primaryCorpname]}
                                sourceId={primaryCorpname}
                                corpname={primaryCorpname}
                                wPoSList={props.wPoSList}
                                lposValue={props.lposValues[primaryCorpname]}
                                forcedAttr={props.forcedAttr}
                                attrList={props.attrList}
                                tagHelperView={props.tagHelperViews[primaryCorpname]}
                                tagsets={props.tagsets[primaryCorpname]}
                                inputLanguage={props.inputLanguages[primaryCorpname]}
                                onEnterKey={handleSubmit}
                                useRichQueryEditor={props.useRichQueryEditor}
                                hasFocus={primaryCorpname === props.activeCorpus}
                                isSingleInstance={false}
                                qsuggPlugin={querySuggest} />
                        </div>
                    </div>
                    {props.corpora.length > 1 || props.availableAlignedCorpora.length > 0 ?
                        <AlignedCorpora
                                availableCorpora={props.availableAlignedCorpora}
                                primaryCorpus={primaryCorpname}
                                subcorpus={props.subcorpusId}
                                subcAligned={props.subcAligned}
                                alignedCorpora={List.tail(props.corpora)}
                                sectionVisible={props.alignedCorporaVisible}
                                supportedWidgets={props.supportedWidgets}
                                wPoSList={props.wPoSList}
                                queries={props.queries}
                                lposValues={props.lposValues}
                                forcedAttr={props.forcedAttr}
                                attrList={props.attrList}
                                inputLanguages={props.inputLanguages}
                                hasLemmaAttr={props.hasLemma}
                                useRichQueryEditor={props.useRichQueryEditor}
                                tagHelperViews={props.tagHelperViews}
                                tagsets={props.tagsets}
                                activeCorpus={props.activeCorpus}
                                onEnterKey={handleSubmit} />
                        : null
                    }
                    <inputViews.AdvancedFormFieldset
                            uniqId="section-specify-context"
                            formVisible={props.contextFormVisible}
                            handleClick={handleContextFormVisibility}
                            htmlClass="specify-context"
                            title={he.translate('query__specify_context')}>
                        <contextViews.SpecifyContextForm
                                hasLemmaAttr={props.hasLemma[primaryCorpname]}
                                wPoSList={props.wPoSList} />
                    </inputViews.AdvancedFormFieldset>
                    <inputViews.AdvancedFormFieldset
                                uniqId="section-specify-text-types"
                                formVisible={props.textTypesFormVisible}
                                formDisabled={queryModel.disableRestrictSearch(props)}
                                handleClick={handleTextTypesFormVisibility}
                                title={he.translate('query__specify_tt')}
                                htmlClass="specify-text-types"
                                closedStateHint={<BoundTextTypesFieldsetHint />}
                        closedStateDesc={props.textTypesNotes}>
                    <ttViews.TextTypesPanel
                            LiveAttrsView={props.LiveAttrsView}
                            LiveAttrsCustomTT={props.LiveAttrsCustomTT}
                            controls={textTypesControls} />
                    </inputViews.AdvancedFormFieldset>
                    <div className="submit-block">
                        <div className="buttons">
                            {props.isBusy ?
                                <layoutViews.AjaxLoaderBarImage /> :
                                <>
                                    <button type="button" className="default-button" onClick={handleSubmit}>
                                        {he.translate('query__search_btn')}
                                    </button>
                                    <S.ShuffleResultWrapper>
                                        <label htmlFor="shuffle-result-switch">
                                            {he.translate('query__shuffle_result')}
                                            <layoutViews.InlineHelp
                                                htmlClass="shuffle-help"
                                                customStyle={{maxWidth: '30em', lineHeight: '1.2em'}}>
                                            {he.translate('query__shuffle_result_help')}
                                            </layoutViews.InlineHelp>
                                        </label>
                                        <layoutViews.ToggleSwitch
                                            id="shuffle-result-switch"
                                            onChange={onShuffleToggle}
                                            checked={props.shuffleConcByDefault }/>
                                    </S.ShuffleResultWrapper>
                                </>
                            }
                        </div>
                    </div>
                </div>
                {quickSubcorpViews && props.quickSubcorpVisible ?
                    <quickSubcorpViews.Widget onClose={handleHideQuickSubcorpWidget} /> :
                    null}
            </S.QueryForm>
        );
    };

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

        function renderValues(position:number, name:string, values:Array<TextTypes.AttributeValue>, exclude:boolean) {
            const selValues = pipe(
                values,
                List.filter(v => v.selected),
                List.map(v => <span key={v.value} className="attr-val">{v.value}</span>)
            );
            return <span>
                {position > 0 ? ', ' : ''}
                <strong>{name}</strong>
                {exclude ? '\u00a0\u2209\u00a0{' : '\u00a0\u2208\u00a0{'}
                {List.join(i => <span key={`j${i}`}>, </span>, shortenValues(selValues))}
                {'}'}
                <br />
            </span>;
        }

        function renderSelections(sel:TextTypes.AnyTTSelection, i:number) {
            switch (sel.type) {
                case 'full':
                    return renderValues(i, sel.name, sel.values, sel.excludeSelection);
                case 'regexp':
                    return <span>
                        {i > 0 ? ', ' : ''}
                        <strong>{sel.name}</strong>
                        {sel.excludeSelection ? '\u00a0\u2209\u00a0' : '\u00a0\u2208\u00a0'}
                        {'{' + sel.textFieldDecoded + '}'}
                        <br />
                    </span>;
                case 'text':
                    if (!List.empty(sel.values)) {
                        return renderValues(i, sel.name, sel.values, sel.excludeSelection);
                    }
                    return <span>{sel.textFieldValue}</span>;
            }
        }

        if (props.hasSelectedItems) {
            return (
                <SC.SelectedTextTypesLite className="specify-text-types">
                    <theme.ExpandableSectionLabel>
                        <layoutViews.ExpandButton isExpanded={props.hasSelectedItems} />
                        <span>{he.translate('query__chosen_texts')}</span>
                    </theme.ExpandableSectionLabel>
                    <div className="contents">
                        <ul>
                            {pipe(
                                props.attributes,
                                List.filter(attr => TTSelOps.hasUserChanges(attr, true)),
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
                </SC.SelectedTextTypesLite>
            );

        } else {
            return <SC.SelectedTextTypesLite />;
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
            if (evt.key === Keyboard.Value.ENTER && !evt.shiftKey) {
                if (!evt.ctrlKey) {
                    if (this.props.operationIdx !== undefined) {
                        dispatcher.dispatch<typeof Actions.BranchQuery>({
                            name: Actions.BranchQuery.name,
                            payload: {operationIdx: this.props.operationIdx}
                        });

                    } else {
                        dispatcher.dispatch<typeof Actions.QuerySubmit>({
                            name: Actions.QuerySubmit.name
                        });
                    }
                }
                evt.stopPropagation();
                evt.preventDefault();
            }
        }

        _handleContextFormVisibility() {
            dispatcher.dispatch<typeof Actions.QueryContextToggleForm>({
                name: Actions.QueryContextToggleForm.name
            });
        }

        _handleSubmit() {
            if (this.props.operationIdx !== undefined) {
                dispatcher.dispatch<typeof Actions.BranchQuery>({
                    name: Actions.BranchQuery.name,
                    payload: {operationIdx: this.props.operationIdx}
                });

            } else {
                dispatcher.dispatch<typeof Actions.QuerySubmit>({
                    name: Actions.QuerySubmit.name
                });
            }
        }

        render() {
            return (
                <S.QueryForm>
                    <div onKeyDown={this._keyEventHandler}>
                        <div className="form primary-language">
                            <inputViews.TRQueryInputField
                                widgets={this.props.supportedWidgets[this.props.corpname]}
                                sourceId={this.props.corpname}
                                corpname={this.props.corpname}
                                wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValues[this.props.corpname]}
                                forcedAttr={this.props.forcedAttr}
                                attrList={this.props.attrList}
                                tagHelperView={this.props.tagHelperView}
                                inputLanguage={this.props.inputLanguages[this.props.corpname]}
                                onEnterKey={this._handleSubmit}
                                hasFocus={this.props.corpname === this.props.activeCorpus}
                                isSingleInstance={false}
                                useRichQueryEditor={this.props.useRichQueryEditor}
                                qsuggPlugin={querySuggest}
                                tagsets={this.props.tagsets[this.props.corpname]} />
                        </div>
                        {this.props.corpora.length > 1 || this.props.availableAlignedCorpora.length > 0 ?
                            <AlignedCorporaLite
                                availableCorpora={this.props.availableAlignedCorpora}
                                alignedCorpora={List.tail(this.props.corpora)}
                                queries={this.props.queries} />
                            : null
                        }
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
                    </div>
                </S.QueryForm>
            );
        }
    }

    // ------------------- <QueryHelp /> -----------------------------

    const QueryHelp:React.FC<QueryHelpProps & QueryHelpModelState> = (props) => {

        const [visible, changeState] = React.useState(false);

        const toggleHelp = () => {
            if (!visible) {
                dispatcher.dispatch<typeof HelpActions.HelpRequested>({
                    name: HelpActions.HelpRequested.name,
                    payload: {
                        section: 'query'
                    }
                });
            };
            changeState(!visible);
        };

        return (
            <S.QueryHelp className="topbar-help-icon">
                <a className="icon" onClick={toggleHelp}>
                    <layoutViews.ImgWithMouseover
                        htmlClass="over-img"
                        src={he.createStaticUrl('img/question-mark.svg')}
                        alt={he.translate('global__click_to_see_help')} />
                </a>
                {visible ?
                    <layoutViews.ModalOverlay onCloseKey={toggleHelp}>
                        <layoutViews.CloseableFrame onCloseClick={toggleHelp} label={he.translate('query__help')} scrollable={true}>
                            <div>
                                <div dangerouslySetInnerHTML={{__html: props.rawHtml}}/>
                                <p><a target="_blank" href={he.getHelpLink('term_cql')}>{he.getHelpLink('term_cql')}</a></p>
                                <h2>{he.translate('query__tagset_summary')}</h2>
                                {Dict.empty(props.tagsets) ?
                                    null :
                                    <ul className="tagset-links">{pipe(
                                        props.activeCorpora,
                                        List.map(corp => tuple(corp, props.tagsets[corp])),
                                        List.map(
                                            ([corpus, tagsets]) => (
                                                <li key={`item:${corpus}`}>
                                                    <h3>{corpus}:</h3>
                                                    <ul className="tagsets">{pipe(
                                                        tagsets,
                                                        List.map(tagset => tuple(
                                                            tagset,
                                                            props.isLocalUiLang ? tagset.docUrlLocal : tagset.docUrlEn
                                                        )),
                                                        List.map(
                                                            ([tagset, url]) => (
                                                                <li key={`item:${tagset.ident}`}>
                                                                    {he.translate('global__tagset').toLocaleLowerCase()}{'\u00a0'}
                                                                    <span className="tagset">{tagset.ident}</span>{'\u00a0'}
                                                                    <span className="tagset">({tagset.type})</span>{'\u00a0'}
                                                                    {he.translate('global__on_attr').toLocaleLowerCase()}{'\u00a0'}
                                                                    <span className="attr">"{tagset.featAttr}"</span>{'\u00a0'}
                                                                    {url ? <span> - <a className="external" target="_blank" href={url}>{url}</a></span> : null}
                                                                </li>
                                                            )
                                                        )
                                                    )}</ul>
                                                </li>
                                            ))
                                    )}</ul>
                                }
                            </div>
                        </layoutViews.CloseableFrame>
                    </layoutViews.ModalOverlay> :
                    null
                }
            </S.QueryHelp>
        );
    };

    // --------------------------

    const MissingAlignedQueryForm:React.FC<FirstQueryFormModelState & MissingALQProps> = (props) => {

        const handleSubmit = () => {
            dispatcher.dispatch<typeof Actions.BranchQuery>({
                name: Actions.BranchQuery.name,
                payload: {
                    operationIdx: 0,
                    setMainCorp: props.maincorp
                }
            });
        };

        return (
            <S.QueryForm>
                <div>
                    <div className="form">
                        <div className="query">
                        <inputViews.TRQueryInputField
                                widgets={props.supportedWidgets[props.maincorp]}
                                sourceId={props.maincorp}
                                corpname={props.maincorp}
                                wPoSList={props.wPoSList}
                                lposValue={props.lposValues[props.maincorp]}
                                forcedAttr={props.forcedAttr}
                                attrList={props.attrList}
                                tagHelperView={props.tagHelperViews[props.maincorp]}
                                tagsets={props.tagsets[props.maincorp]}
                                inputLanguage={props.inputLanguages[props.maincorp]}
                                onEnterKey={handleSubmit}
                                useRichQueryEditor={props.useRichQueryEditor}
                                isSingleInstance={true}
                                hasFocus={true}
                                qsuggPlugin={querySuggest} />
                        </div>
                    </div>
                    <div className="buttons">
                        {props.isBusy ?
                            <layoutViews.AjaxLoaderBarImage /> :
                            <button type="button" className="default-button" onClick={handleSubmit}>
                                {he.translate('global__proceed')}
                            </button>
                        }
                    </div>
                </div>
            </S.QueryForm>
        )
    }

    return {
        QueryForm: BoundWithProps<QueryFormProps, FirstQueryFormModelState>(QueryForm, queryModel),
        QueryFormLite: BoundWithProps<QueryFormLiteProps, FirstQueryFormModelState>(QueryFormLite, queryModel),
        QueryHelp: BoundWithProps<QueryHelpProps, QueryHelpModelState>(QueryHelp, queryHelpModel),
        MissingAlignedQueryForm: BoundWithProps<MissingALQProps, FirstQueryFormModelState>(MissingAlignedQueryForm, queryModel)
    };
}