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
import { Dict, Keyboard, List, pipe } from 'cnc-tskit';

import { init as keyboardInit } from './virtualKeyboard';
import { init as cqlEditoInit } from './cqlEditor';
import { init as richInputInit } from './richInput';
import { WithinBuilderModel, WithinBuilderModelState } from '../../models/query/withinBuilder';
import { PluginInterfaces } from '../../types/plugins';
import { Kontext } from '../../types/common';
import { QueryFormModel, QueryFormModelState } from '../../models/query/common';
import { UsageTipsModel, UsageTipsState, UsageTipCategory } from '../../models/usageTips';
import { VirtualKeyboardModel } from '../../models/query/virtualKeyboard';
import { Actions, ActionName, QueryFormType } from '../../models/query/actions';
import { Actions as HintActions,
    ActionName as HintActionName } from '../../models/usageTips/actions';
import { QueryType, TokenSuggestions } from '../../models/query/query';
import { init as queryStructureInit } from '../../views/query/structure';


export interface InputModuleViews {
    TRQueryInputField:React.ComponentClass<TRQueryInputFieldProps>;
    TRPcqPosNegField:React.FC<TRPcqPosNegFieldProps>;
    TRIncludeEmptySelector:React.FC<TRIncludeEmptySelectorProps>;
    AdvancedFormFieldset:React.FC<AdvancedFormFieldsetProps>;
}


export interface TRQueryInputFieldProps {
    sourceId:string;
    lposValue:string;
    wPoSList:Array<{n:string; v:string}>;
    queryStorageView:PluginInterfaces.QueryStorage.WidgetView;
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
    value:string; // TODO enum
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
    handleClick:()=>void;
}

interface QueryToolboxProps {
    sourceId:string;
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
}

export function init({
    dispatcher, he, queryModel, queryHintModel, withinBuilderModel,
    virtualKeyboardModel, querySuggest}:InputModuleArgs):InputModuleViews {

    const keyboardViews = keyboardInit({
        dispatcher: dispatcher,
        he: he,
        queryModel: queryModel,
        virtualKeyboardModel: virtualKeyboardModel
    });
    const cqlEditorViews = cqlEditoInit(dispatcher, he, queryModel);
    const richInputViews = richInputInit(dispatcher, he, queryModel);
    const QueryStructure = queryStructureInit({dispatcher, he, queryModel});
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
            <span className="AdvancedFormFieldsetDesc">
                <a onClick={handleClick}><layoutViews.StatusIcon status="info" inline={true} /></a>
                {opened ?
                    <layoutViews.PopupBox onCloseClick={handleClick}>
                        <div className="html-code">
                            <div dangerouslySetInnerHTML={{__html: props.html}} />
                        </div>
                    </layoutViews.PopupBox> :
                    null
                }
            </span>
        );
    };

    // ------------------- <AdvancedFormFieldset /> -----------------------------

    const AdvancedFormFieldset:React.FC<AdvancedFormFieldsetProps> = (props) => {

        const htmlClasses = [];
        htmlClasses.push(props.formVisible ? 'collapse' : 'expand');

        return (
            <section className={`AdvancedFormFieldset${props.isNested ? ' nested' : ''} ${props.htmlClass}${props.formVisible && props.htmlClass ? '' : ' closed'}`}
                    role="group" aria-labelledby={props.uniqId}>
                <h2 id={props.uniqId}>
                    <layoutViews.ExpandButton isExpanded={props.formVisible} onClick={props.handleClick} />
                        <a onClick={props.handleClick}>{props.title}</a>
                    {props.formVisible ? null : props.closedStateHint}
                    {props.formVisible || !props.closedStateDesc ?
                        null :
                        <AdvancedFormFieldsetDesc html={props.closedStateDesc} />
                    }
                </h2>
                {props.formVisible ?
                    <div className="contents">
                        {props.children}
                    </div> :
                    null
                }
            </section>
        );
    };

    // -------------- <QueryHints /> --------------------------------------------

    const QueryHints:React.FC<{queryType:QueryType} & UsageTipsState> = (props) => {

        const clickHandler = () => {
            dispatcher.dispatch<HintActions.NextQueryHint|HintActions.NextCqlQueryHint>({
                name: props.queryType === 'simple' ? HintActionName.NextQueryHint : HintActionName.NextCqlQueryHint
            });
        };

        return (
            <div className="QueryHints">
                <span className={props.forcedTip ? "hint highlight" : "hint"}>
                    {
                        props.forcedTip ?
                            props.forcedTip :
                            props.currentHints[props.queryType === 'simple' ? UsageTipCategory.QUERY : UsageTipCategory.CQL_QUERY]
                    }
                </span>
                <span className="next-hint">
                    <a onClick={clickHandler} title={he.translate('global__next_tip')}>
                        <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/next-page.svg')}
                                alt={he.translate('global__next_tip')} />
                    </a>
                </span>
            </div>
        );
    };

    const BoundQueryHints = BoundWithProps<{queryType:QueryType}, UsageTipsState>(QueryHints, queryHintModel);


    // ------------------- <TRQueryTypeField /> -----------------------------

    const TRQueryTypeField:React.FC<TRQueryTypeFieldProps> = (props) => {

        const handleSelection = (checked) => {
            dispatcher.dispatch<Actions.QueryInputSetQType>({
                name: ActionName.QueryInputSetQType,
                payload: {
                    formType: props.formType,
                    sourceId: props.sourceId,
                    queryType: checked ? 'simple' : 'advanced'
                }
            });
        };

        return (
            <div className="TRQueryTypeField">
                <label htmlFor="chck_wsdA3fe"><a>{he.translate('query__qt_advanced')}</a></label>
                <layoutViews.ToggleSwitch
                    id="chck_wsdA3fe"
                    onChange={handleSelection}
                    checked={props.queryType === 'advanced'} />
            </div>
        );
    };

    // ------------------- <TRPcqPosNegField /> -----------------------------

    const TRPcqPosNegField:React.FC<TRPcqPosNegFieldProps> = (props) => {

        const handleSelectChange = (evt) => {
            dispatcher.dispatch<Actions.FilterInputSetPCQPosNeg>({
                name: ActionName.FilterInputSetPCQPosNeg,
                payload: {
                    filterId: props.sourceId,
                    formType: props.formType,
                    value: evt.target.value
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

        const handleCheckbox = () => {
            dispatcher.dispatch<Actions.QueryInputSetIncludeEmpty>({
                name: ActionName.QueryInputSetIncludeEmpty,
                payload: {
                    corpname: props.corpname,
                    value: !props.value
                }
            });
        };

        return (
            <div className="TRIncludeEmptySelector">
                <label>
                    {he.translate('query__include_empty_aligned')}:{'\u00a0'}
                    <input type="checkbox" checked={props.value}
                        onChange={handleCheckbox} />
                </label>
            </div>
        );
    };

    // ------------------- <TagWidget /> --------------------------------

    const TagWidget:React.FC<{
        formType:QueryFormType;
        sourceId:string;
        args:Kontext.GeneralProps;
        tagHelperView:PluginInterfaces.TagHelper.View
        closeClickHandler:()=>void;

    }> = (props) => {

        return (
            <layoutViews.PopupBox
                    onCloseClick={props.closeClickHandler}
                    customClass="tag-builder-widget"
                    customStyle={{position: 'absolute', left: '10em', marginTop: '6.5em'}}
                    takeFocus={true}>
                <props.tagHelperView
                        sourceId={props.sourceId}
                        onInsert={props.closeClickHandler}
                        onEscKey={props.closeClickHandler}
                        formType={props.formType}
                        range={[props.args['leftIdx'], props.args['rightIdx']]} />
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
            dispatcher.dispatch<Actions.SetWithinValue>({
                name: ActionName.SetWithinValue,
                payload: {
                    value: evt.target.value
                }
            });
        }

        _handleKeyDown(evt) {
            if (evt.keyCode === Keyboard.Code.ESC) {
                evt.stopPropagation();
                evt.preventDefault();
                this.props.closeClickHandler();
            }
        }

        _handleAttrChange(evt) {
            dispatcher.dispatch<Actions.SetWithinAttr>({
                name: ActionName.SetWithinAttr,
                payload: {
                    idx: evt.target.value
                }
            });
        }

        _handleInsert() {
            dispatcher.dispatch<Actions.QueryInputAppendQuery>({
                name: ActionName.QueryInputAppendQuery,
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
            dispatcher.dispatch<Actions.LoadWithinBuilderData>({
                name: ActionName.LoadWithinBuilderData,
                payload: {
                    sourceId: this.props.sourceId
                }
            });
        }

        render() {
            return (
                <layoutViews.PopupBox
                        onCloseClick={this.props.closeClickHandler}
                        customStyle={{position: 'absolute', left: '80pt', marginTop: '5pt'}}>
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
        queryStorageView:PluginInterfaces.QueryStorage.WidgetView;

    }> = (props) => {
        return (
            <div className="history-widget">
                <props.queryStorageView
                        sourceId={props.sourceId}
                        onCloseTrigger={props.onCloseTrigger}
                        formType={props.formType} />
            </div>
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
            if (e.keyCode === Keyboard.Code.ESC) {
                dispatcher.dispatch<Actions.ToggleQuerySuggestionWidget>({
                    name: ActionName.ToggleQuerySuggestionWidget,
                    payload: {
                        formType: props.formType,
                        sourceId: props.sourceId,
                        tokenIdx: null
                    }
                });
            }
        };

        const handleBlur = () => {
            dispatcher.dispatch<Actions.ToggleQuerySuggestionWidget>({
                name: ActionName.ToggleQuerySuggestionWidget,
                payload: {
                    formType: props.formType,
                    sourceId: props.sourceId,
                    tokenIdx: null
                }
            });
        };

        return (
            <div className={`SuggestionsWidget${dynCls}`} tabIndex={0} onKeyDown={handleKey}
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
            </div>
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
            dispatcher.dispatch<Actions.QueryInputHitVirtualKeyboardKey>({
                name: ActionName.QueryInputHitVirtualKeyboardKey,
                payload: {
                    keyCode: evt.keyCode
                }
            });
        };

        return (
            <layoutViews.PopupBox
                    onCloseClick={props.closeClickHandler}
                    customStyle={{marginTop: '3.5em'}}
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
                ans.push(<a onClick={this._handleQueryStructureWidget} className={hasExpandedTokens ? 'highlighted' : null}>{he.translate('query__query_structure')}</a>);
            }
            return ans;
        }

        _handleWidgetTrigger(name) {
            dispatcher.dispatch<Actions.SetActiveInputWidget>({
                name: ActionName.SetActiveInputWidget,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId,
                    value: name,
                    widgetArgs: this.props.widgetArgs
                }
            });
        }

        _handleHistoryWidget() {
            this.setState({
                activeWidget: null,
                widgetArgs: {}
            });
            this.props.toggleHistoryWidget();
        }

        _handleCloseWidget() {
            dispatcher.dispatch<Actions.SetActiveInputWidget>({
                name: ActionName.SetActiveInputWidget,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId,
                    value: null,
                    widgetArgs: this.props.widgetArgs
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
                                formType={this.props.formType}
                                args={this.props.widgetArgs} />;
                case 'within':
                    return <BoundWithinWidget closeClickHandler={this._handleCloseWidget}
                                sourceId={this.props.sourceId} formType={this.props.formType} />;
                case 'keyboard':
                    return <KeyboardWidget closeClickHandler={this._handleCloseWidget}
                                sourceId={this.props.sourceId} inputLanguage={this.props.inputLanguage}
                                formType={this.props.formType} />;
                case 'query-structure':
                    return <QueryStructure sourceId={this.props.sourceId} formType={this.props.formType}
                                defaultAttribute={this.props.simpleQueryDefaultAttrs[this.props.sourceId]} />;
                default:
                    return null;
            }
        }

        render() {
            return (
                <div className="query-toolbox">
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
                </div>
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

    }> = (props) => {

        const handleCheckbox = (evt) => {
            dispatcher.dispatch<Actions.QueryInputSetMatchCase>({
                name: ActionName.QueryInputSetMatchCase,
                payload: {
                    formType: props.formType,
                    sourceId: props.sourceId,
                    value: !props.matchCaseValue
                }
            });
        };

        return (
            <label>
                {he.translate('query__match_case')}:{'\u00a0'}
                <input type="checkbox" name="qmcase" value="1" checked={props.matchCaseValue}
                    onChange={handleCheckbox} disabled={props.disabled} />
            </label>
        );
    };

    // -------------------- <DefaultAttrSelector /> ------------------------

    const DefaultAttrSelector:React.FC<{
        defaultAttr:string;
        forcedAttr:string;
        attrList:Array<Kontext.AttrItem>;
        simpleQueryDefaultAttrs:Array<string>;
        sourceId:string;
        formType:QueryFormType;
        queryType:QueryType;
        label:string;

    }> = (props) => (
        <span className="default-attr-selection">
            {props.label + ':\u00a0'}
            <DefaultAttrSelect defaultAttr={props.defaultAttr}
                forcedAttr={props.forcedAttr}
                attrList={props.attrList}
                simpleQueryDefaultAttrs={props.simpleQueryDefaultAttrs}
                sourceId={props.sourceId}
                formType={props.formType}
                queryType={props.queryType} />{'\u00a0'}
        </span>
    );

    // -------------------- <UseRegexpSelector /> --------------------------

    const UseRegexpSelector:React.FC<{
        value:boolean;
        formType:QueryFormType;
        sourceId:string;

    }> = (props) => {

        const handleClick = () => {
            dispatcher.dispatch<Actions.QueryInputToggleAllowRegexp>({
                name: ActionName.QueryInputToggleAllowRegexp,
                payload: {
                    formType: props.formType,
                    sourceId: props.sourceId,
                    value: !props.value
                }
            });
        }

        return (
            <span>
                <label>
                    {he.translate('query__simple_q_use_regexp')}:
                    <input type="checkbox" checked={props.value} onChange={handleClick} />
                </label>
            </span>
        );
    };



    // ------------------- <DefaultAttrSelect /> -----------------------------

    const DefaultAttrSelect:React.FC<{
        formType:QueryFormType;
        sourceId:string;
        queryType:QueryType;
        forcedAttr:string;
        defaultAttr:string;
        simpleQueryDefaultAttrs:Array<string>;
        attrList:Array<Kontext.AttrItem>;

    }> = (props) => {

        const handleSelectChange = (evt) => {
            dispatcher.dispatch<Actions.QueryInputSetDefaultAttr>({
                name: ActionName.QueryInputSetDefaultAttr,
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
                <select className="DefaultAttrSelect" value={props.defaultAttr || ''} onChange={handleSelectChange}>
                    {!List.empty(props.simpleQueryDefaultAttrs) && props.queryType === 'simple' ?
                        <option value="">{props.simpleQueryDefaultAttrs.join(' | ')}</option> :
                        null}
                    {props.attrList.map(item => {
                        return <option key={item.n} value={item.n || ''}>{item.label}</option>;
                    })}
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
                dispatcher.dispatch<Actions.QueryInputSetQuery>({
                    name: ActionName.QueryInputSetQuery,
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
            dispatcher.dispatch<Actions.ToggleQueryHistoryWidget>({
                name: ActionName.ToggleQueryHistoryWidget,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId
                }
            });
            if (!this.props.historyVisible[this.props.sourceId] && this._queryInputElement.current) {
                this._queryInputElement.current.focus();
            }
        }

        _toggleStructureWidget() {
            const query = this.props.queries[this.props.sourceId];
            dispatcher.dispatch<Actions.ShowQueryStructureWidget>({
                name: ActionName.ShowQueryStructureWidget,
                payload: {
                    sourceId: this.props.sourceId,
                    formType: this.props.formType
                }
            });
        }

        private handleQueryOptsClick() {
            dispatcher.dispatch<Actions.QueryOptionsToggleForm>({
                name: ActionName.QueryOptionsToggleForm,
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
            dispatcher.dispatch<Actions.ToggleQuerySuggestionWidget>({
                name: ActionName.ToggleQuerySuggestionWidget,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId,
                    tokenIdx: null
                }
            });
        }

        handleSuggestionItemClick(providerId:string, value:unknown):void {
            dispatcher.dispatch<PluginInterfaces.QuerySuggest.Actions.ItemClicked>({
                name: PluginInterfaces.QuerySuggest.ActionName.ItemClicked,
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

        _renderInputOptions() {
            const customOpts = this.props.customOptions || [];
            const query = this.props.queries[this.props.sourceId];
            switch (query.qtype) {
                case 'simple':
                    return (
                        <>
                            {!List.empty(customOpts) ?
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
                            }
                            <>
                                <div className={`option${query.use_regexp ? ' disabled' : ''}`}>
                                    <MatchCaseSelector matchCaseValue={query.qmcase || query.use_regexp}
                                        sourceId={this.props.sourceId}
                                        formType={this.props.formType}
                                        disabled={query.use_regexp} />
                                    {query.use_regexp ?
                                        (
                                            <layoutViews.InlineHelp noSuperscript={true}
                                                    customStyle={{maxWidth: '30em'}}>
                                                {he.translate('query__tip_07')}
                                            </layoutViews.InlineHelp>
                                        ) :
                                        null
                                    }
                                </div>
                                <div className={"option"}>
                                    <UseRegexpSelector sourceId={this.props.sourceId} formType={this.props.formType}
                                            value={query.use_regexp} />
                                </div>
                                <div className="option">
                                    <DefaultAttrSelector
                                        label={he.translate('query__default_attr')}
                                        sourceId={this.props.sourceId}
                                        defaultAttr={query.default_attr}
                                        forcedAttr={this.props.forcedAttr}
                                        attrList={this.props.attrList}
                                        simpleQueryDefaultAttrs={this.props.simpleQueryDefaultAttrs[this.props.sourceId]}
                                        formType={this.props.formType}
                                        queryType={this.props.queries[this.props.sourceId].qtype} />
                                </div>
                            </>
                        </>
                    );
                case 'advanced':
                    return (
                        <>
                            {!List.empty(customOpts) ?
                                <div className="option-list-custom">
                                    {List.map(
                                        (opt, i) => <div key={`item:${i}`}>{opt}</div>,
                                        customOpts
                                    )}
                                </div> :
                                null
                            }
                            <div className="option-list">
                                <div>
                                    <DefaultAttrSelector
                                        label={he.translate('query__default_attr')}
                                        sourceId={this.props.sourceId}
                                        defaultAttr={query.default_attr}
                                        forcedAttr={this.props.forcedAttr}
                                        attrList={this.props.attrList}
                                        simpleQueryDefaultAttrs={this.props.simpleQueryDefaultAttrs[this.props.sourceId]}
                                        formType={this.props.formType}
                                        queryType={this.props.queries[this.props.sourceId].qtype} />
                                </div>
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

            return (
                <div>
                    <div className="query-area">
                        <BoundQueryToolbox
                            widgets={this.props.widgets}
                            tagHelperView={this.props.tagHelperView}
                            sourceId={this.props.sourceId}
                            toggleHistoryWidget={this._toggleHistoryWidget}
                            toggleStructureWidget={this._toggleStructureWidget}
                            inputLanguage={this.props.inputLanguage}
                            suggestionsLoading={suggestionsLoading} />
                        {this._renderInput()}
                        <div style={{position: 'relative'}}>
                            {this.props.historyVisible[this.props.sourceId] ?
                                <HistoryWidget
                                        queryStorageView={this.props.queryStorageView}
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
                    </div>
                    <AdvancedFormFieldset
                            uniqId="query-options-section"
                            formVisible={this.props.queryOptionsVisible[this.props.sourceId]}
                            handleClick={this.handleQueryOptsClick}
                            htmlClass="query-options"
                            title={he.translate('query__specify_options')}
                            isNested={this.props.isNested}>
                        <div className="options">
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
        TRPcqPosNegField: TRPcqPosNegField,
        TRIncludeEmptySelector: TRIncludeEmptySelector,
        AdvancedFormFieldset: AdvancedFormFieldset
    };

}