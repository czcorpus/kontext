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
import { Keyboard, List, pipe } from 'cnc-tskit';

import { init as keyboardInit } from './virtualKeyboard';
import { init as cqlEditoInit } from './cqlEditor';
import { WithinBuilderModel, WithinBuilderModelState } from '../../models/query/withinBuilder';
import { PluginInterfaces } from '../../types/plugins';
import { Kontext } from '../../types/common';
import { QueryFormModel, QueryFormModelState, QueryType } from '../../models/query/common';
import { UsageTipsModel, UsageTipsState, UsageTipCategory } from '../../models/usageTips';
import { VirtualKeyboardModel } from '../../models/query/virtualKeyboard';
import { CQLEditorModel } from '../../models/query/cqleditor/model';
import { Actions, ActionName, QueryFormType } from '../../models/query/actions';
import { Actions as HintActions,
    ActionName as HintActionName } from '../../models/usageTips/actions';


export interface InputModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    queryModel:QueryFormModel<QueryFormModelState>;
    queryHintModel:UsageTipsModel;
    withinBuilderModel:WithinBuilderModel;
    virtualKeyboardModel:VirtualKeyboardModel;
    cqlEditorModel:CQLEditorModel;
}


export interface InputModuleViews {
    TRQueryInputField:React.ComponentClass<TRQueryInputFieldProps>;
    TRQueryTypeField:React.SFC<TRQueryTypeFieldProps>;
    TRPcqPosNegField:React.SFC<TRPcqPosNegFieldProps>;
    TRIncludeEmptySelector:React.SFC<TRIncludeEmptySelectorProps>;
}


export interface TRQueryInputFieldProps {
    sourceId:string;
    lposValue:string;
    wPoSList:Array<{n:string; v:string}>;
    queryType:QueryType;
    queryStorageView:PluginInterfaces.QueryStorage.WidgetView;
    tagHelperView:PluginInterfaces.TagHelper.View;
    widgets:Array<string>;
    inputLanguage:string;
    useCQLEditor:boolean;
    forcedAttr:string;
    defaultAttr:string;
    attrList:Array<Kontext.AttrItem>;
    matchCaseValue:boolean;
    onEnterKey:()=>void;
    takeFocus?:boolean;
    qsuggPlugin:PluginInterfaces.QuerySuggest.IPlugin;
    customOptions?:Array<React.ReactElement<{span:number}>>;
}


export interface TRQueryTypeFieldProps {
    formType:QueryFormType;
    sourceId:string;
    queryType:QueryType;
    hasLemmaAttr:boolean;
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

interface SingleLineInputProps {
    sourceId:string;
    refObject:React.RefObject<HTMLInputElement>;
    hasHistoryWidget:boolean;
    historyIsVisible:boolean;
    onReqHistory:()=>void;
    onEsc:()=>void;
}

interface QueryToolboxProps {
    sourceId:string;
    widgets:Array<string>;
    inputLanguage:string;
    tagHelperView:PluginInterfaces.TagHelper.View;
    qsAvailable:boolean;
    toggleHistoryWidget:()=>void;
}

export function init({
    dispatcher, he, queryModel, queryHintModel, withinBuilderModel,
    virtualKeyboardModel, cqlEditorModel}:InputModuleArgs):InputModuleViews {

    const keyboardViews = keyboardInit({
        dispatcher: dispatcher,
        he: he,
        queryModel: queryModel,
        virtualKeyboardModel: virtualKeyboardModel
    });
    const cqlEditorViews = cqlEditoInit(dispatcher, he, queryModel, cqlEditorModel);
    const layoutViews = he.getLayoutViews();


    // -------------- <QueryHints /> --------------------------------------------

    class QueryHints extends React.PureComponent<UsageTipsState> {

        constructor(props) {
            super(props);
            this._clickHandler = this._clickHandler.bind(this);
        }

        _clickHandler() {
            dispatcher.dispatch<HintActions.NextQueryHint>({
                name: HintActionName.NextQueryHint
            });
        }

        render() {
            return (
                <div>
                    <span className="hint">{this.props.currentHints[UsageTipCategory.QUERY]}</span>
                    <span className="next-hint">
                        <a onClick={this._clickHandler} title={he.translate('global__next_tip')}>
                            <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/next-page.svg')}
                                    alt={he.translate('global__next_tip')} />
                        </a>
                    </span>
                </div>
            );
        }
    }

    const BoundQueryHints = Bound<UsageTipsState>(QueryHints, queryHintModel);


    // ------------------- <TRQueryTypeField /> -----------------------------

    const TRQueryTypeField:React.SFC<TRQueryTypeFieldProps> = (props) => {

        const handleSelection = (evt) => {
            dispatcher.dispatch<Actions.QueryInputSelectType>({
                name: ActionName.QueryInputSelectType,
                payload: {
                    formType: props.formType,
                    sourceId: props.sourceId,
                    queryType: evt.target.value
                }
            });
        };

        return (
            <div className="TRQueryTypeField">
                <ul>
                    <li>
                        <label>
                            <input type="radio" value="simple" checked={props.queryType === 'simple'} onChange={handleSelection} />
                            {he.translate('query__qt_simple')}
                        </label>
                    </li>
                    <li>
                        <label>
                            <input type="radio" value="advanced" checked={props.queryType === 'advanced'} onChange={handleSelection} />
                            {he.translate('query__qt_advanced')}
                        </label>
                    </li>
                </ul>
            </div>
        );
    };

    // ------------------- <TRPcqPosNegField /> -----------------------------

    const TRPcqPosNegField:React.SFC<TRPcqPosNegFieldProps> = (props) => {

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

    const TRIncludeEmptySelector:React.SFC<TRIncludeEmptySelectorProps> = (props) => {

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

    const TagWidget:React.SFC<{
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

    const HistoryWidget:React.SFC<{
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

    const SuggestionsWidget:React.SFC<{
        qsuggPlugin:PluginInterfaces.QuerySuggest.IPlugin;
        querySuggestions:{[sourceId:string]:[Array<PluginInterfaces.QuerySuggest.DataAndRenderer<unknown>>, boolean]};
        sourceId:string;
        formType:QueryFormType;

    }> = (props) => (
        <div className="suggestions-box">
            {QueryFormModel.hasSuggestionsFor(props.querySuggestions, props.sourceId) ?
                pipe(
                    props.querySuggestions[props.sourceId][0],
                    List.filter(v => !props.qsuggPlugin.isEmptyResponse(v)),
                    List.map(
                        (v, i) => (
                            <React.Fragment key={`${v.rendererId}${i}`}>
                                <h2>{v.heading}:</h2>
                                {props.qsuggPlugin.createElement(v)}
                                {props.querySuggestions[props.sourceId][1] ?
                                    <layoutViews.AjaxLoaderBarImage /> : null}
                            </React.Fragment>
                        ),
                    )
                ) : null
            }
        </div>
    );

    // ------------------- <KeyboardWidget /> --------------------------------

    const KeyboardWidget:React.SFC<{
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
            this._handleQuerySuggestWidget = this._handleQuerySuggestWidget.bind(this);
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
            if (this.props.qsAvailable) {
                ans.push(
                    <>
                        <a onClick={this._handleQuerySuggestWidget}>{he.translate('query__suggestions_available')}</a>
                        {this.props.suggestionsVisible[this.props.sourceId] ?
                            null :
                            <span className="notifications">{'\u25CF'}</span>
                        }
                    </>
                );
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

        _handleQuerySuggestWidget() {
            dispatcher.dispatch<Actions.ToggleQuerySuggestionWidget>({
                name: ActionName.ToggleQuerySuggestionWidget,
                payload: {
                    sourceId: this.props.sourceId,
                    formType: this.props.formType
                }
            });
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
                default:
                    return null;
            }
        }

        render() {
            return (
                <div className="query-toolbox">
                    {this._renderWidget()}
                    <ul>
                        {List.map(
                            (item, i) => <li key={i}>{item}</li>,
                            this._renderButtons()
                        )}
                    </ul>
                </div>
            );
        }
    }

    const BoundQueryToolbox = BoundWithProps<QueryToolboxProps, QueryFormModelState>(QueryToolbox, queryModel);

    // ------------------- <LposSelector /> -----------------------------

    const LposSelector:React.SFC<{
        sourceId:string;
        formType:QueryFormType;
        wPoSList:Array<{v:string; n:string}>;
        lposValue:string;

    }> = (props) => {

        const handleLposChange = (evt) => {
            dispatcher.dispatch<Actions.QueryInputSetLpos>({
                name: ActionName.QueryInputSetLpos,
                payload: {
                    formType: props.formType,
                    sourceId: props.sourceId,
                    lpos: evt.target.value
                }
            });
        };

        return (
            <span>
                {he.translate('query__pos')}:{'\u00a0'}
                <select onChange={handleLposChange} value={props.lposValue}>
                    <option value="">{he.translate('query__not_specified')}</option>
                    {props.wPoSList.map(item => {
                        return <option key={item.v} value={item.v}>{item.n}</option>;
                    })}
                </select>
            </span>
        );
    };

    // ------------------- <MatchCaseSelector /> -----------------------------

    const MatchCaseSelector:React.SFC<{
        formType:QueryFormType;
        sourceId:string;
        matchCaseValue:boolean;

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
                    onChange={handleCheckbox} />
            </label>
        );
    };

    // -------------------- <DefaultAttrSelector /> ------------------------

    const DefaultAttrSelector:React.SFC<{
        defaultAttr:string;
        forcedAttr:string;
        attrList:Array<Kontext.AttrItem>;
        sourceId:string;
        formType:QueryFormType;
        label:string;

    }> = (props) => (
        <span className="default-attr-selection">
            {props.label + ':\u00a0'}
            <DefaultAttrSelect defaultAttr={props.defaultAttr}
                forcedAttr={props.forcedAttr}
                attrList={props.attrList}
                sourceId={props.sourceId}
                formType={props.formType} />{'\u00a0'}
    </span>
    )

    // ------------------- <SingleLineInput /> -----------------------------

    const SingleLineInput:React.SFC<SingleLineInputProps & QueryFormModelState> = (props) => {

        const handleInputChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch<Actions.QueryInputSetQuery>({
                name: ActionName.QueryInputSetQuery,
                payload: {
                    formType: props.formType,
                    sourceId: props.sourceId,
                    query: evt.target.value,
                    rawAnchorIdx: props.refObject.current.selectionStart,
                    rawFocusIdx: props.refObject.current.selectionEnd,
                    insertRange: null
                }
            });
        };

        const handleKeyDown = (evt) => {
            if (evt.keyCode === Keyboard.Code.DOWN_ARROW &&
                    props.hasHistoryWidget &&
                    props.downArrowTriggersHistory[props.sourceId] &&
                        !props.historyIsVisible) {
                props.onReqHistory();

            } else if (evt.keyCode === Keyboard.Code.ESC) {
                props.onEsc();
            }
        };

        const handleKeyUp = (evt) => {
            if ((evt.keyCode === Keyboard.Code.LEFT_ARROW ||
                    evt.keyCode === Keyboard.Code.HOME ||
                    evt.keyCode === Keyboard.Code.END ||
                    evt.keyCode === Keyboard.Code.RIGHT_ARROW) && props.refObject.current) {
                dispatcher.dispatch<Actions.QueryInputMoveCursor>({
                    name: ActionName.QueryInputMoveCursor,
                    payload: {
                        formType: props.formType,
                        sourceId: props.sourceId,
                        rawAnchorIdx: props.refObject.current.selectionStart,
                        rawFocusIdx: props.refObject.current.selectionEnd
                    }
                });
            }
        }

        const handleClick = (evt) => {
            if (props.refObject.current) {
                dispatcher.dispatch<Actions.QueryInputMoveCursor>({
                    name: ActionName.QueryInputMoveCursor,
                    payload: {
                        formType: props.formType,
                        sourceId: props.sourceId,
                        rawAnchorIdx: props.refObject.current.selectionStart,
                        rawFocusIdx: props.refObject.current.selectionEnd
                    }
                });
            }
        };

        return <input className="simple-input" type="text"
                            spellCheck={false}
                            ref={props.refObject}
                            onChange={handleInputChange}
                            value={props.queries[props.sourceId]}
                            onKeyDown={handleKeyDown}
                            onKeyUp={handleKeyUp}
                            onClick={handleClick} />;
    }

    const BoundSingleLineInput = BoundWithProps<SingleLineInputProps, QueryFormModelState>(SingleLineInput, queryModel);

    // ------------------- <DefaultAttrSelect /> -----------------------------

    const DefaultAttrSelect:React.SFC<{
        formType:QueryFormType;
        sourceId:string;
        forcedAttr:string;
        defaultAttr:string;
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
                <select disabled={true} title={he.translate('query__implicit_attr_cannot_be_changed')}>
                    <option>{props.forcedAttr}</option>
                </select>
            );

        } else {
            return (
                <select value={props.defaultAttr} onChange={handleSelectChange}>
                    {props.attrList.map(item => {
                        return <option key={item.n} value={item.n}>{item.label}</option>;
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
            this.handleReqHistory = this.handleReqHistory.bind(this);
            this.handleInputEscKeyDown = this.handleInputEscKeyDown.bind(this);
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
                    sourceId: this.props.sourceId
                }
            });
        }

        _renderInput() {
            switch (this.props.queryType) {
                case 'simple':
                    return <BoundSingleLineInput
                                sourceId={this.props.sourceId}
                                refObject={this._queryInputElement as React.RefObject<HTMLInputElement>}
                                hasHistoryWidget={this.props.widgets.indexOf('history') > -1}
                                historyIsVisible={this.props.historyVisible[this.props.sourceId]}
                                onReqHistory={this.handleReqHistory}
                                onEsc={this.handleInputEscKeyDown} />;
                case 'advanced':
                    return this.props.useCQLEditor ?
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
            switch (this.props.queryType) {
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
                                <div className="option">
                                    <MatchCaseSelector matchCaseValue={this.props.matchCaseValue}
                                        sourceId={this.props.sourceId}
                                        formType={this.props.formType} />
                                </div>
                                <div className="option">
                                    <DefaultAttrSelector
                                        label={he.translate('query__applied_attr')}
                                        sourceId={this.props.sourceId}
                                        defaultAttr={this.props.defaultAttr}
                                        forcedAttr={this.props.forcedAttr}
                                        attrList={this.props.attrList}
                                        formType={this.props.formType} />
                                </div>
                                <div className="option">
                                {Kontext.isWordLikePosAttr(this.props.defaultAttr) ?
                                    <LposSelector wPoSList={this.props.wPoSList}
                                        lposValue={this.props.lposValue}
                                        sourceId={this.props.sourceId}
                                        formType={this.props.formType}  /> :
                                    null
                                }
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
                                        defaultAttr={this.props.defaultAttr}
                                        forcedAttr={this.props.forcedAttr}
                                        attrList={this.props.attrList}
                                        formType={this.props.formType} />
                                </div>
                            </div>
                        </>
                    );
            }
        }

        render() {
            return (
                <div>
                    <div className="query-area">
                        <BoundQueryToolbox
                            widgets={this.props.widgets}
                            tagHelperView={this.props.tagHelperView}
                            sourceId={this.props.sourceId}
                            toggleHistoryWidget={this._toggleHistoryWidget}
                            inputLanguage={this.props.inputLanguage}
                            qsAvailable={QueryFormModel.hasSuggestionsFor(this.props.querySuggestions, this.props.sourceId)} />
                        {this._renderInput()}
                        {this.props.historyVisible[this.props.sourceId] ?
                            <HistoryWidget
                                    queryStorageView={this.props.queryStorageView}
                                    sourceId={this.props.sourceId}
                                    onCloseTrigger={this._toggleHistoryWidget}
                                    formType={this.props.formType}/>
                            : null
                        }

                        {
                            !this.props.historyVisible[this.props.sourceId] &&
                            this.props.suggestionsVisible[this.props.sourceId] &&
                            QueryFormModel.hasSuggestionsFor(this.props.querySuggestions, this.props.sourceId) ?
                                <SuggestionsWidget
                                    qsuggPlugin={this.props.qsuggPlugin}
                                    querySuggestions={this.props.querySuggestions}
                                    sourceId={this.props.sourceId}
                                    formType={this.props.formType} />
                                : null
                        }
                        <div className="query-hints">
                            <BoundQueryHints  />
                        </div>
                    </div>
                    <fieldset className="query-options">
                        <legend>
                            <span className="form-extension-switch always-expand">
                                {he.translate('global__options')}
                            </span>
                        </legend>
                        <div className="options">
                            {this._renderInputOptions()}
                        </div>
                    </fieldset>
                </div>
            );
        }
    }

    const BoundTRQueryInputField = BoundWithProps<TRQueryInputFieldProps, QueryFormModelState>(TRQueryInputField, queryModel)

    return {
        TRQueryInputField: BoundTRQueryInputField,
        TRQueryTypeField: TRQueryTypeField,
        TRPcqPosNegField: TRPcqPosNegField,
        TRIncludeEmptySelector: TRIncludeEmptySelector
    };

}