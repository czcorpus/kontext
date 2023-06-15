/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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
import { Dict, Keyboard, List, pipe, tuple } from 'cnc-tskit';

import { init as keyboardInit } from '../virtualKeyboard';
import { init as cqlEditoInit } from '../../cqlEditor';
import { init as richInputInit } from '../richInput';
import { WithinBuilderModel, WithinBuilderModelState } from '../../../models/query/withinBuilder';
import * as PluginInterfaces from '../../../types/plugins';
import * as Kontext from '../../../types/kontext';
import { formEncodeDefaultAttr, QueryFormModel, QueryFormModelState } from '../../../models/query/common';
import { UsageTipsModel, UsageTipsState, UsageTipCategory } from '../../../models/usageTips';
import { VirtualKeyboardModel } from '../../../models/query/virtualKeyboard';
import { Actions, QueryFormType } from '../../../models/query/actions';
import { Actions as HintActions } from '../../../models/usageTips/actions';
import { Actions as HistoryActions } from '../../../models/searchHistory/actions';
import { QueryType, TokenSuggestions } from '../../../models/query/query';
import { init as queryStructureInit } from '../structure';
import { init as shViewInit } from '../../searchHistory/simple';
import * as S from './style';
import * as SC from '../style';
import { SearchHistoryModel } from '../../../models/searchHistory';


export interface InputModuleViews {
    TRQueryInputField:React.ComponentClass<TRQueryInputFieldProps>;
    TRPcqPosNegField:React.FC<TRPcqPosNegFieldProps>;
    TRIncludeEmptySelector:React.FC<TRIncludeEmptySelectorProps>;
    AdvancedFormFieldset:React.FC<AdvancedFormFieldsetProps>;
}


export interface TRQueryInputFieldProps {
    sourceId:string;
    corpname:string;
    lposValue:string;
    wPoSList:Array<{n:string; v:string}>;
    tagHelperView:PluginInterfaces.TagHelper.View;
    widgets:Array<string>;
    inputLanguage:string;
    useRichQueryEditor:boolean;
    forcedAttr:string;
    attrList:Array<Kontext.AttrItem>;
    onEnterKey:()=>void;
    takeFocus?:boolean;
    qsuggPlugin:PluginInterfaces.QuerySuggest.IPlugin;
    isNested?:boolean;
    customOptions?:Array<React.ReactElement<{span:number}>>;
    tagsets:Array<PluginInterfaces.TagHelper.TagsetInfo>;
}


export interface TRQueryTypeFieldProps {
    formType:QueryFormType;
    sourceId:string;
    queryType:QueryType;
}


export interface TRPcqPosNegFieldProps {
    span:number;
    formType:QueryFormType;
    sourceId:string;
    value:'pos'|'neg';
}

export interface TRIncludeEmptySelectorProps {
    span:number;
    value:boolean;
    corpname:string;
}

export interface AdvancedFormFieldsetProps {
    uniqId:string;
    formVisible:boolean;
    title:string;
    closedStateHint?:React.ReactElement;
    closedStateDesc?:string; // raw HTML
    isNested?:boolean;
    htmlClass?:string;
    formDisabled?:boolean;
    handleClick:()=>void;
    children?:React.ReactNode;
}

interface QueryToolboxProps {
    sourceId:string;
    corpname:string;
    widgets:Array<string>;
    inputLanguage:string;
    suggestionsLoading:boolean;
    tagHelperView:PluginInterfaces.TagHelper.View;
    toggleHistoryWidget:()=>void;
    toggleStructureWidget:()=>void;
}

export interface InputModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    queryModel:QueryFormModel<QueryFormModelState>;
    queryHintModel:UsageTipsModel;
    withinBuilderModel:WithinBuilderModel;
    virtualKeyboardModel:VirtualKeyboardModel;
    querySuggest:PluginInterfaces.QuerySuggest.IPlugin;
    searchHistoryModel:SearchHistoryModel;
}

export function init({
    dispatcher, he, queryModel, queryHintModel, withinBuilderModel,
    virtualKeyboardModel, querySuggest, searchHistoryModel}:InputModuleArgs):InputModuleViews {

    const keyboardViews = keyboardInit({
        dispatcher: dispatcher,
        he: he,
        queryModel: queryModel,
        virtualKeyboardModel: virtualKeyboardModel
    });
    const cqlEditorViews = cqlEditoInit(dispatcher, he, queryModel);
    const richInputViews = richInputInit(dispatcher, he, queryModel);
    const QueryStructure = queryStructureInit({dispatcher, he, queryModel});
    const SearchHistoryWidget = shViewInit(dispatcher, he, searchHistoryModel);
    const layoutViews = he.getLayoutViews();


    // ------------------- <AdvancedFormFieldsetDesc /> -----------------------------

    const AdvancedFormFieldsetDesc:React.FC<{
        html:string;
    }> = (props) => {

        const [opened, setOpened] = React.useState(false);

        const handleClick = () => {
            setOpened(!opened);
        }

        return (
            <S.AdvancedFormFieldsetDesc>
                <a onClick={handleClick}><layoutViews.StatusIcon status="info" inline={true} /></a>
                {opened ?
                    <layoutViews.PopupBox onCloseClick={handleClick}>
                        <div className="html-code">
                            <div dangerouslySetInnerHTML={{__html: props.html}} />
                        </div>
                    </layoutViews.PopupBox> :
                    null
                }
            </S.AdvancedFormFieldsetDesc>
        );
    };

    // ------------------- <AdvancedFormFieldset /> -----------------------------

    const AdvancedFormFieldset:React.FC<AdvancedFormFieldsetProps> = (props) => {

        const htmlClasses = [];
        if (props.formDisabled) htmlClasses.push('disabled');
        if (props.isNested) htmlClasses.push('nested');
        if (props.htmlClass) {
            htmlClasses.push(props.htmlClass);
            if (!props.formVisible || props.formDisabled) htmlClasses.push('closed');
        }

        return (
            <S.AdvancedFormFieldset className={htmlClasses.join(' ')}
                    role="group" aria-labelledby={props.uniqId}>
                <SC.ExpandableSectionLabel id={props.uniqId}>
                    <layoutViews.ExpandButton isExpanded={!props.formDisabled && props.formVisible} onClick={props.handleClick} />
                    <a onClick={props.formDisabled ? null : props.handleClick}>{props.title}</a>
                    {!props.formDisabled && props.formVisible ? null : props.closedStateHint}
                    {(!props.formDisabled && props.formVisible) || !props.closedStateDesc ?
                        null :
                        <AdvancedFormFieldsetDesc html={props.closedStateDesc} />
                    }
                </SC.ExpandableSectionLabel>
                {!props.formDisabled && props.formVisible ?
                    <div className="contents">
                        {props.children}
                    </div> :
                    null
                }
            </S.AdvancedFormFieldset>
        );
    };

    // -------------- <QueryHints /> --------------------------------------------

    const QueryHints:React.FC<{queryType:QueryType} & UsageTipsState> = (props) => {

        const clickHandler = () => {
            dispatcher.dispatch<typeof HintActions.NextQueryHint|typeof HintActions.NextCqlQueryHint>({
                name: props.queryType === 'simple' ? HintActions.NextQueryHint.name : HintActions.NextCqlQueryHint.name
            });
        };

        return (
            <S.QueryHints>
                <span className="hint">
                    <span className="tip">
                        {props.forcedTip ?
                            '\u203C\u00a0' + he.translate('global__advice') :
                            he.translate('global__tip')
                        }
                    </span>
                    {
                        props.forcedTip ?
                            props.forcedTip.message :
                            props.currentHints[props.queryType === 'simple' ? UsageTipCategory.QUERY : UsageTipCategory.CQL_QUERY]
                    }
                </span>
                <span className="next-hint">
                    (
                    <a onClick={clickHandler}>
                        {he.translate('global__next_tip')}
                    </a>
                    )
                </span>
            </S.QueryHints>
        );
    };

    const BoundQueryHints = BoundWithProps<{queryType:QueryType}, UsageTipsState>(QueryHints, queryHintModel);


    // ------------------- <TRQueryTypeField /> -----------------------------

    const TRQueryTypeField:React.FC<TRQueryTypeFieldProps> = (props) => {

        const handleSelection = (checked) => {
            dispatcher.dispatch<typeof Actions.QueryInputSetQType>({
                name: Actions.QueryInputSetQType.name,
                payload: {
                    formType: props.formType,
                    sourceId: props.sourceId,
                    queryType: checked ? 'advanced' : 'simple'
                }
            });
        };

        const handleLabelClick = (evt:React.MouseEvent) => {
            handleSelection(props.queryType !== 'advanced');
            evt.stopPropagation();
            evt.preventDefault();
        };

        return (
            <S.TRQueryTypeField>
                <label htmlFor={'query-switch-'+props.sourceId}>
                    <a onClick={handleLabelClick}>{he.translate('query__qt_advanced')}</a>
                </label>
                <S.ToggleSwitchScaler>
                    <layoutViews.ToggleSwitch
                        id={'query-switch-'+props.sourceId}
                        onChange={handleSelection}
                        checked={props.queryType === 'advanced'} />
                </S.ToggleSwitchScaler>
            </S.TRQueryTypeField>
        );
    };

    // ------------------- <TRPcqPosNegField /> -----------------------------

    const TRPcqPosNegField:React.FC<TRPcqPosNegFieldProps> = (props) => {

        const handleSelectChange = (evt) => {
            dispatcher.dispatch<typeof Actions.QueryInputSetPCQPosNeg>({
                name: Actions.QueryInputSetPCQPosNeg.name,
                payload: {
                    sourceId: props.sourceId,
                    formType: props.formType,
                    value: evt.target.value as 'pos'|'neg'
                }
            });
        };

        return (
            <div>
                <label>{he.translate('query__align_posneg_label')}</label>:{'\u00a0'}
                <select value={props.value} onChange={handleSelectChange}>
                    <option value="pos">{he.translate('query__align_contains')}</option>
                    <option value="neg">{he.translate('query__align_not_contains')}</option>
                </select>
            </div>
        );
    };

    // ---------------- <TRIncludeEmptySelector /> ---------------------------

    const TRIncludeEmptySelector:React.FC<TRIncludeEmptySelectorProps> = (props) => {

        const handleCheckbox = (value) => {

            dispatcher.dispatch(
                Actions.QueryInputSetIncludeEmpty,
                {
                    corpname: props.corpname,
                    value
                }
            );
        };

        return (
            <S.TRIncludeEmptySelector>
                <label>
                    {he.translate('query__include_empty_aligned')}:{'\u00a0'}
                    <layoutViews.ToggleSwitch
                        id={`include-empty-toggle-${props.corpname}`}
                        checked={props.value}
                        onChange={handleCheckbox} />
                </label>
            </S.TRIncludeEmptySelector>
        );
    };

    // ------------------- <TagWidget /> --------------------------------

    const TagWidget:React.FC<{
        formType:QueryFormType;
        sourceId:string;
        corpname:string;
        appliedQueryRange:[number, number];
        tagHelperView:PluginInterfaces.TagHelper.View
        closeClickHandler:()=>void;

    }> = (props) => {

        return (
            <layoutViews.PopupBox
                    onCloseClick={props.closeClickHandler}
                    customClass="tag-builder-widget"
                    customStyle={{position: 'absolute', left: '-1em', top: '-4em'}}
                    takeFocus={true}>
                <props.tagHelperView
                        sourceId={props.sourceId}
                        corpname={props.corpname}
                        onInsert={props.closeClickHandler}
                        onEscKey={props.closeClickHandler}
                        formType={props.formType} />
            </layoutViews.PopupBox>
        );
    };

    // ------------------- <WithinWidget /> --------------------------------

    interface WithinWidgetProps {
        formType:QueryFormType;
        sourceId:string;
        closeClickHandler:()=>void;
    }

    class WithinWidget extends React.PureComponent<WithinWidgetProps & WithinBuilderModelState> {

        constructor(props) {
            super(props);
            this._handleInputChange = this._handleInputChange.bind(this);
            this._handleKeyDown = this._handleKeyDown.bind(this);
            this._handleAttrChange = this._handleAttrChange.bind(this);
            this._handleInsert = this._handleInsert.bind(this);
        }

        _handleInputChange(evt) {
            dispatcher.dispatch<typeof Actions.SetWithinValue>({
                name: Actions.SetWithinValue.name,
                payload: {
                    value: evt.target.value
                }
            });
        }

        _handleKeyDown(evt) {
            if (evt.key === Keyboard.Value.ESC) {
                evt.stopPropagation();
                evt.preventDefault();
                this.props.closeClickHandler();
            }
        }

        _handleAttrChange(evt) {
            dispatcher.dispatch<typeof Actions.SetWithinAttr>({
                name: Actions.SetWithinAttr.name,
                payload: {
                    idx: evt.target.value
                }
            });
        }

        _handleInsert() {
            dispatcher.dispatch<typeof Actions.QueryInputAppendQuery>({
                name: Actions.QueryInputAppendQuery.name,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId,
                    query: WithinBuilderModel.exportQuery(this.props),
                    prependSpace: true,
                    closeWhenDone: true
                }
            });
        }

        componentDidMount() {
            dispatcher.dispatch<typeof Actions.LoadWithinBuilderData>({
                name: Actions.LoadWithinBuilderData.name,
                payload: {
                    sourceId: this.props.sourceId
                }
            });
        }

        render() {
            return (
                <layoutViews.PopupBox
                        onCloseClick={this.props.closeClickHandler}
                        customStyle={{position: 'absolute', left: '0.3em', top: '2.2em'}}>
                    <S.WithinWidget>
                        <div onKeyDown={this._handleKeyDown}>
                            <h3>{he.translate('query__create_within')}</h3>
                            {this.props.isBusy ?
                                <layoutViews.AjaxLoaderImage /> :
                                <>
                                    <div className="within-widget">
                                        <select onChange={this._handleAttrChange} value={this.props.currAttrIdx}>
                                            {List.map(
                                                ([struct, attr], i) => (
                                                    <option key={`${struct}-${attr}`} value={i}>{WithinBuilderModel.ithValue(this.props, i)}</option>
                                                ),
                                                this.props.data
                                            )}
                                        </select>
                                        {'\u00a0'}={'\u00a0'}
                                        <input type="text" value={this.props.query} onChange={this._handleInputChange}
                                                ref={item => item ? item.focus() : null} />
                                        {'\u00a0'}
                                    </div>
                                    <p>
                                        <button type="button" className="util-button"
                                                onClick={this._handleInsert}>
                                            {he.translate('query__insert_within')}
                                        </button>
                                    </p>
                                </>
                            }
                        </div>
                    </S.WithinWidget>
                </layoutViews.PopupBox>
            );
        }
    }

    const BoundWithinWidget = BoundWithProps<WithinWidgetProps, WithinBuilderModelState>(WithinWidget, withinBuilderModel);

    // ------------------- <HistoryWidget /> -----------------------------

    const HistoryWidget:React.FC<{
        sourceId:string;
        formType:QueryFormType;
        onCloseTrigger:()=>void;

    }> = (props) => {
        return (
            <S.HistoryWidget>
                <SearchHistoryWidget
                        sourceId={props.sourceId}
                        onCloseTrigger={props.onCloseTrigger}
                        formType={props.formType} />
            </S.HistoryWidget>
        );
    };

    // ------------------- <SuggestionsWidget /> -----------------------------

    const SuggestionsWidget:React.FC<{
        qsuggPlugin:PluginInterfaces.QuerySuggest.IPlugin;
        data:TokenSuggestions|null;
        formType:QueryFormType;
        sourceId:string;
        handleItemClick:(providerId:string, value:unknown) => void;

    }> = (props) => {
        const dynCls = props.data === null || List.every(s => querySuggest.isEmptyResponse(s), props.data.data) ?
            ' empty' : '';

        const ref = React.useRef<HTMLDivElement>();

        React.useLayoutEffect(
            () => {
                ref.current.focus();
            },
            [ref.current]
        );

        const handleKey = (e:React.KeyboardEvent) => {
            if (e.key === Keyboard.Value.ESC) {
                dispatcher.dispatch<typeof Actions.ToggleQuerySuggestionWidget>({
                    name: Actions.ToggleQuerySuggestionWidget.name,
                    payload: {
                        formType: props.formType,
                        sourceId: props.sourceId,
                        tokenIdx: null
                    }
                });
            }
        };

        const handleBlur = () => {
            dispatcher.dispatch<typeof Actions.ToggleQuerySuggestionWidget>({
                name: Actions.ToggleQuerySuggestionWidget.name,
                payload: {
                    formType: props.formType,
                    sourceId: props.sourceId,
                    tokenIdx: null
                }
            });
        };

        return (
            <S.SuggestionsWidget className={dynCls} tabIndex={0} onKeyDown={handleKey}
                    onBlur={handleBlur} ref={ref}>
                {props.data ?
                    pipe(
                        props.data.data,
                        List.filter(v => !props.qsuggPlugin.isEmptyResponse(v)),
                        List.map(
                            (v, i) => (
                                <React.Fragment key={`${v.rendererId}${i}`}>
                                    <h2>{v.heading}:</h2>
                                    {props.qsuggPlugin.createElement(v, props.handleItemClick)}
                                    {props.data.isPartial ?
                                        <layoutViews.AjaxLoaderBarImage /> : null}
                                </React.Fragment>
                            ),
                        )
                    ) :
                    <div className="loader"><layoutViews.AjaxLoaderImage /></div>
                }
            </S.SuggestionsWidget>
        );
    };

    // ------------------- <KeyboardWidget /> --------------------------------

    const KeyboardWidget:React.FC<{
        sourceId:string;
        formType:QueryFormType;
        inputLanguage:string;
        closeClickHandler:()=>void;

    }> = (props) => {

        const keyHandler = (evt) => {
            dispatcher.dispatch<typeof Actions.QueryInputHitVirtualKeyboardKey>({
                name: Actions.QueryInputHitVirtualKeyboardKey.name,
                payload: {
                    keyCode: evt.keyCode
                }
            });
        };

        return (
            <layoutViews.PopupBox
                    onCloseClick={props.closeClickHandler}
                    customStyle={{top: '5.6em'}}
                    takeFocus={true}
                    keyPressHandler={keyHandler}>
                <keyboardViews.VirtualKeyboard sourceId={props.sourceId}
                        inputLanguage={props.inputLanguage}
                        formType={props.formType} />
            </layoutViews.PopupBox>
        );
    };

    // ------------------- <QueryToolbox /> -----------------------------

    class QueryToolbox extends React.PureComponent<QueryToolboxProps & QueryFormModelState> {

        constructor(props) {
            super(props);
            this._handleWidgetTrigger = this._handleWidgetTrigger.bind(this);
            this._handleHistoryWidget = this._handleHistoryWidget.bind(this);
            this._handleCloseWidget = this._handleCloseWidget.bind(this);
            this._handleQueryStructureWidget = this._handleQueryStructureWidget.bind(this);
        }

        _renderButtons() {
            const ans = [];
            if (this.props.widgets.indexOf('tag') > -1) {
                ans.push(<a onClick={this._handleWidgetTrigger.bind(this, 'tag')}>{he.translate('query__insert_tag_btn_link')}</a>);
            }
            if (this.props.widgets.indexOf('within') > -1) {
                ans.push(<a onClick={this._handleWidgetTrigger.bind(this, 'within')}>{he.translate('query__insert_within_link')}</a>);
            }
            if (this.props.widgets.indexOf('keyboard') > -1) {
                ans.push(<a onClick={this._handleWidgetTrigger.bind(this, 'keyboard')}>{he.translate('query__keyboard_link')}</a>);
            }
            if (this.props.widgets.indexOf('history') > -1) {
                ans.push(<a onClick={this._handleHistoryWidget}>{he.translate('query__recent_queries_link')}</a>);
            }
            if (this.props.widgets.indexOf('structure') > -1) {
                const queryObj = this.props.queries[this.props.sourceId];
                const hasExpandedTokens = queryObj.qtype === 'simple' ?
                    List.some(t => t.isExtended, queryObj.queryParsed) :
                    false;
                ans.push(
                    <span className="with-icon">
                        <a onClick={this._handleQueryStructureWidget} className={hasExpandedTokens ? 'highlighted' : null}>{he.translate('query__query_structure')}</a>
                        {this.props.suggestionsEnabled[this.props.sourceId] ?
                            <img src={he.createStaticUrl(hasExpandedTokens ? 'img/lightbulb-pink.svg' : 'img/lightbulb-blue.svg')}
                                    alt={he.translate('query_suggestions_are_enabled')}
                                    title={he.translate('query_suggestions_are_enabled')} /> :
                            null
                        }
                    </span>
                );
            }
            return ans;
        }

        _handleWidgetTrigger(name) {
            dispatcher.dispatch<typeof Actions.SetActiveInputWidget>({
                name: Actions.SetActiveInputWidget.name,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId,
                    corpname: this.props.corpname,
                    currQuery: this.props.queries[this.props.sourceId].query,
                    value: name,
                    appliedQueryRange: tuple(
                        this.props.queries[this.props.sourceId].rawFocusIdx,
                        this.props.queries[this.props.sourceId].rawAnchorIdx
                    )
                }
            });
        }

        _handleHistoryWidget() {
            this.setState({
                activeWidget: null
            });
            this.props.toggleHistoryWidget();
        }

        _handleCloseWidget() {
            dispatcher.dispatch<typeof Actions.SetActiveInputWidget>({
                name: Actions.SetActiveInputWidget.name,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId,
                    corpname: this.props.corpname,
                    currQuery: this.props.queries[this.props.sourceId].query,
                    value: null,
                    appliedQueryRange: tuple(
                        this.props.queries[this.props.sourceId].rawFocusIdx,
                        this.props.queries[this.props.sourceId].rawAnchorIdx
                    )
                }
            });
        }

        _handleQueryStructureWidget() {
            this.props.toggleStructureWidget();
        }

        _renderWidget() {
            switch (this.props.activeWidgets[this.props.sourceId]) {
                case 'tag':
                    return <TagWidget closeClickHandler={this._handleCloseWidget}
                                tagHelperView={this.props.tagHelperView}
                                sourceId={this.props.sourceId}
                                corpname={this.props.corpname}
                                formType={this.props.formType}
                                appliedQueryRange={tuple(
                                    this.props.queries[this.props.sourceId].rawFocusIdx,
                                    this.props.queries[this.props.sourceId].rawAnchorIdx)} />;
                case 'within':
                    return <BoundWithinWidget closeClickHandler={this._handleCloseWidget}
                                sourceId={this.props.sourceId} formType={this.props.formType} />;
                case 'keyboard':
                    return <KeyboardWidget closeClickHandler={this._handleCloseWidget}
                                sourceId={this.props.sourceId} inputLanguage={this.props.inputLanguage}
                                formType={this.props.formType} />;
                case 'query-structure':
                    return <QueryStructure sourceId={this.props.sourceId} formType={this.props.formType} />;
                default:
                    return null;
            }
        }

        render() {
            return (
                <S.QueryToolbox>
                    {this._renderWidget()}
                    <ul>
                        <li>
                            <TRQueryTypeField formType={this.props.formType}
                                queryType={this.props.queries[this.props.sourceId].qtype}
                                sourceId={this.props.sourceId} />
                        </li>
                        {List.map(
                            (item, i) => <li key={i}>{item}</li>,
                            this._renderButtons()
                        )}
                        {
                            this.props.suggestionsLoading ?
                            <li><layoutViews.AjaxLoaderBarImage/></li> :
                            null
                        }
                    </ul>
                </S.QueryToolbox>
            );
        }
    }

    const BoundQueryToolbox = BoundWithProps<QueryToolboxProps, QueryFormModelState>(QueryToolbox, queryModel);

    // ------------------- <MatchCaseSelector /> -----------------------------

    const MatchCaseSelector:React.FC<{
        formType:QueryFormType;
        sourceId:string;
        matchCaseValue:boolean;
        disabled:boolean;
        useRegexp:boolean;

    }> = (props) => {

        const handleCheckbox = (checked) => {
            dispatcher.dispatch<typeof Actions.QueryInputSetMatchCase>({
                name: Actions.QueryInputSetMatchCase.name,
                payload: {
                    formType: props.formType,
                    sourceId: props.sourceId,
                    value: checked
                }
            });
        };

        return (
            <S.MatchCaseSelector>
                <label htmlFor={'match-case-switch-'+props.sourceId}>{he.translate('query__match_case')}</label>
                <layoutViews.ToggleSwitch
                    id={'match-case-switch-'+props.sourceId}
                    checked={props.matchCaseValue}
                    onChange={handleCheckbox}
                    disabled={props.disabled} />
                <span style={props.useRegexp ? {} : {visibility: 'hidden'}} className="help">
                    <layoutViews.InlineHelp noSuperscript={true}
                            customStyle={{maxWidth: '30em'}}>
                        {he.translate('query__tip_07')}
                    </layoutViews.InlineHelp>
                </span>
            </S.MatchCaseSelector>
        );
    };

    // -------------------- <DefaultAttrSelector /> ------------------------

    const DefaultAttrSelector:React.FC<{
        defaultAttr:string;
        forcedAttr:string;
        attrList:Array<Kontext.AttrItem>;
        simpleQueryDefaultAttrs:Array<Array<string>|string>;
        sourceId:string;
        formType:QueryFormType;
        queryType:QueryType;
        label:string;
        isLocalUiLang:boolean;
        tagsets:Array<PluginInterfaces.TagHelper.TagsetInfo>;

    }> = (props) => {
        const srch = pipe(
            props.tagsets,
            List.map(tagset => tuple(
                tagset,
                props.isLocalUiLang ? tagset.docUrlLocal : tagset.docUrlEn
            )),
            List.filter(([tagset, url]) => props.defaultAttr === tagset.featAttr && !!url)
        );
        const tagsetHelp = List.empty(srch) ? undefined : List.head(srch)[1];

        return (
            <span className="default-attr-selection">
                <span className="sel">
                    <span>
                        {props.label + ':\u00a0'}
                        <DefaultAttrSelect
                            value={props.defaultAttr}
                            forcedAttr={props.forcedAttr}
                            attrList={props.attrList}
                            simpleQueryDefaultAttrs={props.simpleQueryDefaultAttrs}
                            sourceId={props.sourceId}
                            formType={props.formType}
                            queryType={props.queryType} />
                    </span>
                    {tagsetHelp ?
                        <span className="tagset-summary">
                            <a href={tagsetHelp} className="external" target="_blank">
                                {he.translate('query__tagset_summary')}
                            </a>
                        </span> :
                        null
                }
                </span>
            </span>
        );
    };

    // -------------------- <UseRegexpSelector /> --------------------------

    const UseRegexpSelector:React.FC<{
        value:boolean;
        formType:QueryFormType;
        sourceId:string;

    }> = (props) => {

        const handleClick = (checked) => {
            dispatcher.dispatch<typeof Actions.QueryInputToggleAllowRegexp>({
                name: Actions.QueryInputToggleAllowRegexp.name,
                payload: {
                    formType: props.formType,
                    sourceId: props.sourceId,
                    value: checked
                }
            });
        }

        return (
            <S.UseRegexpSelector>
                <label htmlFor={'regexp-switch-'+props.sourceId}>{he.translate('query__simple_q_use_regexp')}</label>
                <layoutViews.ToggleSwitch
                    id={'regexp-switch-'+props.sourceId}
                    checked={props.value}
                    onChange={handleClick}/>
            </S.UseRegexpSelector>
        );
    };



    // ------------------- <DefaultAttrSelect /> -----------------------------

    const DefaultAttrSelect:React.FC<{
        formType:QueryFormType;
        sourceId:string;
        queryType:QueryType;
        forcedAttr:string;
        value:string|Array<string>;
        simpleQueryDefaultAttrs:Array<Array<string>|string>;
        attrList:Array<Kontext.AttrItem>;

    }> = (props) => {

        const handleSelectChange = (evt) => {
            dispatcher.dispatch<typeof Actions.QueryInputSetDefaultAttr>({
                name: Actions.QueryInputSetDefaultAttr.name,
                payload: {
                    formType: props.formType,
                    sourceId: props.sourceId,
                    value: evt.target.value
                }
            });
        };

        if (props.forcedAttr) {
            return (
                <select className="DefaultAttrSelect" disabled={true} title={he.translate('query__implicit_attr_cannot_be_changed')}>
                    <option>{props.forcedAttr}</option>
                </select>
            );

        } else {
            return (
                <select className="DefaultAttrSelect" value={formEncodeDefaultAttr(props.value)} onChange={handleSelectChange}>
                    {props.queryType === 'simple' ?
                        List.map(
                            defaultAttr => {
                                const val = Array.isArray(defaultAttr) ? defaultAttr : [defaultAttr];
                                return <option key={`attr:${val}`} value={formEncodeDefaultAttr(val)}>{val.join(' | ')}</option>;
                            },
                            props.simpleQueryDefaultAttrs
                        ) :
                        List.map(
                            item => {
                                return <option key={item.n} value={item.n || ''}>{item.label}</option>;
                            },
                            props.attrList
                        )
                    }
                </select>
            );
        }
    };

    // ------------------- <TRQueryInputField /> -----------------------------

    class TRQueryInputField extends React.PureComponent<TRQueryInputFieldProps & QueryFormModelState> {

        private _queryInputElement:React.RefObject<HTMLInputElement|HTMLTextAreaElement>;

        constructor(props) {
            super(props);
            this._queryInputElement = React.createRef();
            this._handleInputChange = this._handleInputChange.bind(this);
            this._toggleHistoryWidget = this._toggleHistoryWidget.bind(this);
            this._toggleStructureWidget = this._toggleStructureWidget.bind(this);
            this.handleReqHistory = this.handleReqHistory.bind(this);
            this.handleInputEscKeyDown = this.handleInputEscKeyDown.bind(this);
            this.handleSuggestionItemClick = this.handleSuggestionItemClick.bind(this);
            this.handleQueryOptsClick = this.handleQueryOptsClick.bind(this);
        }

        _handleInputChange(evt:React.ChangeEvent<HTMLTextAreaElement|HTMLInputElement|HTMLPreElement>) {
            if (evt.target instanceof HTMLTextAreaElement || evt.target instanceof HTMLInputElement) {
                dispatcher.dispatch<typeof Actions.QueryInputSetQuery>({
                    name: Actions.QueryInputSetQuery.name,
                    payload: {
                        formType: this.props.formType,
                        sourceId: this.props.sourceId,
                        query: evt.target.value,
                        rawAnchorIdx: this._queryInputElement.current.selectionStart,
                        rawFocusIdx: this._queryInputElement.current.selectionEnd,
                        insertRange: null
                    }
                });
            }
        }

        _toggleHistoryWidget() {
            dispatcher.dispatch<typeof HistoryActions.ToggleQueryHistoryWidget>({
                name: HistoryActions.ToggleQueryHistoryWidget.name,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId,
                    querySupertype: 'conc',
                }
            });
            if (!this.props.historyVisible[this.props.sourceId] && this._queryInputElement.current) {
                this._queryInputElement.current.focus();
            }
        }

        _toggleStructureWidget() {
            const query = this.props.queries[this.props.sourceId];
            dispatcher.dispatch<typeof Actions.ShowQueryStructureWidget>({
                name: Actions.ShowQueryStructureWidget.name,
                payload: {
                    sourceId: this.props.sourceId,
                    formType: this.props.formType
                }
            });
        }

        private handleQueryOptsClick() {
            dispatcher.dispatch<typeof Actions.QueryOptionsToggleForm>({
                name: Actions.QueryOptionsToggleForm.name,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId
                }
            });
        }

        componentDidMount() {
            if (this.props.takeFocus && this._queryInputElement.current) {
                this._queryInputElement.current.focus();
            }
        }

        componentDidUpdate(prevProps, prevState) {
            if (prevProps.historyVisible[this.props.sourceId] && !this.props.historyVisible &&
                    this._queryInputElement.current) {
                this._queryInputElement.current.focus();
            }
        }

        handleReqHistory():void {
            this._toggleHistoryWidget();
        }

        handleInputEscKeyDown():void {
            dispatcher.dispatch<typeof Actions.ToggleQuerySuggestionWidget>({
                name: Actions.ToggleQuerySuggestionWidget.name,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId,
                    tokenIdx: null
                }
            });
        }

        handleSuggestionItemClick(providerId:string, value:unknown):void {
            dispatcher.dispatch<typeof PluginInterfaces.QuerySuggest.Actions.ItemClicked>({
                name: PluginInterfaces.QuerySuggest.Actions.ItemClicked.name,
                payload: {
                    sourceId: this.props.sourceId,
                    formType: this.props.formType,
                    providerId,
                    value,
                    tokenIdx: this.props.suggestionsVisible[this.props.sourceId]
                }
            });
            this._queryInputElement.current.focus();
        }

        _renderInput() {
            const query = this.props.queries[this.props.sourceId];
            switch (query.qtype) {
                case 'simple':
                    return this.props.useRichQueryEditor ?
                        <richInputViews.RichInput
                                sourceId={this.props.sourceId}
                                refObject={this._queryInputElement as React.RefObject<HTMLSpanElement>}
                                hasHistoryWidget={this.props.widgets.indexOf('history') > -1}
                                historyIsVisible={this.props.historyVisible[this.props.sourceId]}
                                onReqHistory={this.handleReqHistory}
                                onEsc={this.handleInputEscKeyDown}
                                takeFocus={this.props.takeFocus} /> :
                        <richInputViews.RichInputFallback
                                sourceId={this.props.sourceId}
                                refObject={this._queryInputElement as React.RefObject<HTMLInputElement>}
                                hasHistoryWidget={this.props.widgets.indexOf('history') > -1}
                                historyIsVisible={this.props.historyVisible[this.props.sourceId]}
                                onReqHistory={this.handleReqHistory}
                                onEsc={this.handleInputEscKeyDown}
                                takeFocus={this.props.takeFocus} />
                case 'advanced':
                    return this.props.useRichQueryEditor ?
                        <cqlEditorViews.CQLEditor
                                formType={this.props.formType}
                                sourceId={this.props.sourceId}
                                corpname={this.props.corpname}
                                takeFocus={this.props.takeFocus}
                                onReqHistory={this.handleReqHistory}
                                onEsc={this.handleInputEscKeyDown}
                                hasHistoryWidget={this.props.widgets.indexOf('history') > -1}
                                historyIsVisible={this.props.historyVisible[this.props.sourceId]}
                                inputRef={this._queryInputElement as React.RefObject<HTMLPreElement>} /> :
                        <cqlEditorViews.CQLEditorFallback
                                formType={this.props.formType}
                                sourceId={this.props.sourceId}
                                inputRef={this._queryInputElement as React.RefObject<HTMLTextAreaElement>}
                                onReqHistory={this.handleReqHistory}
                                onEsc={this.handleInputEscKeyDown}
                                hasHistoryWidget={this.props.widgets.indexOf('history') > -1}
                                historyIsVisible={this.props.historyVisible[this.props.sourceId]} />;
            }
        }

        _renderCustomOptions() {
            const customOpts = this.props.customOptions || [];
            return !List.empty(customOpts) ?
                <>
                    {List.map(
                        (opt, i) => (
                            <div className="option custom" key={`item:${i}`}
                                    style={{gridColumnEnd: `span ${opt.props.span || 1}`}}>
                                {opt}
                            </div>
                        ),
                        customOpts
                    )}
                </> :
                null
            ;
        }

        _renderInputOptions() {
            const query = this.props.queries[this.props.sourceId];

            switch (query.qtype) {
                case 'simple':
                    return (
                        <>
                            {this._renderCustomOptions()}
                            <div className={`option${query.use_regexp ? ' disabled' : ''}`}>
                                <MatchCaseSelector matchCaseValue={query.qmcase || query.use_regexp}
                                    sourceId={this.props.sourceId}
                                    formType={this.props.formType}
                                    disabled={query.use_regexp}
                                    useRegexp={query.use_regexp} />
                            </div>
                            <div className={"option"}>
                                <UseRegexpSelector sourceId={this.props.sourceId} formType={this.props.formType}
                                        value={query.use_regexp} />
                            </div>
                            <div className="option">
                                <DefaultAttrSelector
                                    label={he.translate('query__default_attr')}
                                    sourceId={this.props.sourceId}
                                    defaultAttr={Array.isArray(query.default_attr) ? undefined : query.default_attr}
                                    forcedAttr={this.props.forcedAttr}
                                    attrList={this.props.attrList}
                                    simpleQueryDefaultAttrs={this.props.simpleQueryDefaultAttrs[this.props.sourceId]}
                                    formType={this.props.formType}
                                    queryType={this.props.queries[this.props.sourceId].qtype}
                                    tagsets={this.props.tagsets}
                                    isLocalUiLang={this.props.isLocalUiLang} />
                            </div>
                        </>
                    );
                case 'advanced':
                    return (
                        <>
                            {this._renderCustomOptions()}
                            <div className="option-list">
                                <DefaultAttrSelector
                                    label={he.translate('query__default_attr')}
                                    sourceId={this.props.sourceId}
                                    defaultAttr={query.default_attr}
                                    forcedAttr={this.props.forcedAttr}
                                    attrList={this.props.attrList}
                                    simpleQueryDefaultAttrs={this.props.simpleQueryDefaultAttrs[this.props.sourceId]}
                                    formType={this.props.formType}
                                    queryType={this.props.queries[this.props.sourceId].qtype}
                                    tagsets={this.props.tagsets}
                                    isLocalUiLang={this.props.isLocalUiLang} />
                            </div>
                        </>
                    );
            }
        }

        render() {
            const queryObj = this.props.queries[this.props.sourceId];
            const sugg = queryObj.qtype === 'simple' ?
                queryObj.queryParsed[this.props.suggestionsVisible[this.props.sourceId]] :
                queryObj.parsedAttrs[this.props.suggestionsVisible[this.props.sourceId]];
            const suggestionsLoading = !Dict.every(
                item => item === false,
                this.props.suggestionsLoading[this.props.sourceId]
            );
            const optionsCount = (this.props.customOptions || []).length + (queryObj.qtype === 'simple' ? 3 : 1);

            return (
                <div>
                    <S.QueryArea>
                        <BoundQueryToolbox
                            widgets={this.props.widgets}
                            tagHelperView={this.props.tagHelperView}
                            sourceId={this.props.sourceId}
                            corpname={this.props.corpname}
                            toggleHistoryWidget={this._toggleHistoryWidget}
                            toggleStructureWidget={this._toggleStructureWidget}
                            inputLanguage={this.props.inputLanguage}
                            suggestionsLoading={suggestionsLoading} />
                        {this._renderInput()}
                        <div style={{position: 'relative'}}>
                            {this.props.historyVisible[this.props.sourceId] ?
                                <HistoryWidget
                                        sourceId={this.props.sourceId}
                                        onCloseTrigger={this._toggleHistoryWidget}
                                        formType={this.props.formType}/>
                                : null
                            }
                            {
                                !this.props.historyVisible[this.props.sourceId] && sugg !== undefined ?
                                    <SuggestionsWidget
                                        qsuggPlugin={this.props.qsuggPlugin}
                                        data={sugg.suggestions}
                                        formType={this.props.formType}
                                        sourceId={this.props.sourceId}
                                        handleItemClick={this.handleSuggestionItemClick} />
                                    : null
                            }
                        </div>
                        <BoundQueryHints queryType={queryObj.qtype} />
                    </S.QueryArea>
                    <AdvancedFormFieldset
                            uniqId="query-options-section"
                            formVisible={this.props.queryOptionsVisible[this.props.sourceId]}
                            handleClick={this.handleQueryOptsClick}
                            htmlClass="query-options"
                            title={he.translate('query__specify_options')}
                            isNested={this.props.isNested}>
                        <div className="options" style={optionsCount === 1 ? {gridTemplateColumns: "1fr"} : null}>
                            {this._renderInputOptions()}
                        </div>
                    </AdvancedFormFieldset>
                </div>
            );
        }
    }

    const BoundTRQueryInputField = BoundWithProps<TRQueryInputFieldProps, QueryFormModelState>(TRQueryInputField, queryModel);


    return {
        TRQueryInputField: BoundTRQueryInputField,
        TRPcqPosNegField,
        TRIncludeEmptySelector,
        AdvancedFormFieldset
    };

}