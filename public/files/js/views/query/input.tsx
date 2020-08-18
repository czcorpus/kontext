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
import { Keyboard, List } from 'cnc-tskit';

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
    tagsetDocUrl:string;
    onEnterKey:()=>void;
    takeFocus?:boolean;
    qsuggPlugin:PluginInterfaces.QuerySuggest.IPlugin;
}


export interface TRQueryTypeFieldProps {
    formType:QueryFormType;
    sourceId:string;
    queryType:string; // TODO enum
    hasLemmaAttr:boolean;
}


export interface TRPcqPosNegFieldProps {
    formType:QueryFormType;
    sourceId:string;
    value:string; // TODO enum
}

export interface TRIncludeEmptySelectorProps {
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

    // ------------------- <QueryTypeHints /> -----------------------------

    class QueryTypeHints extends React.Component<{
        queryType:string;
    },
    {
        visible:boolean;
    }> {

        constructor(props) {
            super(props);
            this.state = {visible: false};
            this._handleHintClick = this._handleHintClick.bind(this);
        }

        _handleHintClick() {
            this.setState({visible: !this.state.visible});
        }

        _getHintText() {
            switch (this.props.queryType) {
                case 'iquery':
                    return [he.translate('query__qt_basic'), he.translate('query__type_hint_basic'), null];
                case 'lemma':
                    return [he.translate('query__qt_lemma'), he.translate('query__type_hint_lemma'), null];
                case 'phrase':
                    return [he.translate('query__qt_phrase'), he.translate('query__type_hint_phrase'), null];
                case 'word':
                    return [he.translate('query__qt_word_form'), he.translate('query__type_hint_word'), null];
                case 'char':
                    return [he.translate('query__qt_word_part'), he.translate('query__type_hint_char'), null];
                case 'cql':
                    return [he.translate('query__qt_cql'), he.translate('query__type_hint_cql'), he.getHelpLink('term_cql')];
                default:
                    return ['', '', null];
            }
        }

        render() {
            const [heading, text, helpUrl] = this._getHintText();
            return (
                <span>
                    <span className="hint" onClick={this._handleHintClick}>
                        <a>
                            <img src={he.createStaticUrl('img/question-mark.svg')}
                                alt={he.translate('global__info_icon')} />
                        </a>
                    </span>
                    {this.state.visible ?
                        <layoutViews.PopupBox onCloseClick={this._handleHintClick} takeFocus={true} customClass="hint">
                            <div>
                                <h3>{he.translate('query__select_type')} <span className="type">"{heading}"</span></h3>
                                <p dangerouslySetInnerHTML={{__html: text}} />
                                {helpUrl ?
                                    <p className="link">
                                        <hr />
                                        <a href={helpUrl} className="external" target='_blank'>
                                            {he.translate('global__get_more_info')}
                                        </a>
                                    </p> :
                                    null
                                }
                            </div>
                        </layoutViews.PopupBox> :
                        null
                    }
                </span>
            );
        }
    }


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
            <tr className="TRQueryTypeField">
                <th>{he.translate('query__select_type')}:</th>
                <td>
                    <select value={props.queryType} onChange={handleSelection}>
                        <option value="iquery">{he.translate('query__qt_basic')}</option>
                        {props.hasLemmaAttr ? <option value="lemma">{he.translate('query__qt_lemma')}</option> : null}
                        <option value="phrase">{he.translate('query__qt_phrase')}</option>
                        <option value="word">{he.translate('query__qt_word_form')}</option>
                        <option value="char">{he.translate('query__qt_word_part')}</option>
                        <option value="cql">{he.translate('query__qt_cql')}</option>
                    </select>
                    <QueryTypeHints queryType={props.queryType} />
                </td>
            </tr>
        );
    };

    // ------------------- <TRPcqPosNegField /> -----------------------------

    const TRPcqPosNegField:React.SFC<TRPcqPosNegFieldProps> = (props) => {

        const handleSelectChange = (evt) => {
            dispatcher.dispatch<Actions.FilterInputSetPCQPosNeg>({
                name: ActionName.FilterInputSetPCQPosNeg,
                payload: {
                    filterId: props.sourceId,
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th />
                <td>
                    <select value={props.value} onChange={handleSelectChange}>
                        <option value="pos">{he.translate('query__align_contains')}</option>
                        <option value="neg">{he.translate('query__align_not_contains')}</option>
                    </select>
                </td>
            </tr>
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
            <tr className="TRIncludeEmptySelector">
                <th />
                <td>
                    <label>
                        <input type="checkbox" checked={props.value}
                            onChange={handleCheckbox} />
                        {he.translate('query__include_empty_aligned')}
                    </label>
                </td>
            </tr>
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
        querySuggestions:{[sourceId:string]:Array<PluginInterfaces.QuerySuggest.DataAndRenderer>};
        sourceId:string;
        formType:QueryFormType;

    }> = (props) => {

        const handleKeyDown = (evt:React.KeyboardEvent) => {
            if (evt.keyCode === Keyboard.Code.ESC && !evt.altKey && !evt.ctrlKey) {
                dispatcher.dispatch<Actions.HideQuerySuggestionWidget>({
                    name: ActionName.HideQuerySuggestionWidget,
                    payload: {
                        formType: props.formType
                    }
                });
            }
        };

        const handleBlur = () => {
            dispatcher.dispatch<Actions.HideQuerySuggestionWidget>({
                name: ActionName.HideQuerySuggestionWidget,
                payload: {
                    formType: props.formType
                }
            });
        };

        const ref = React.useRef<HTMLDivElement>();

        React.useEffect(() => {
            if (ref.current) {
                ref.current.focus();
            }
        });

        return (
            <div className="suggestions-box" tabIndex={0} ref={ref} onKeyDown={handleKeyDown}
                    onBlur={handleBlur}>
                {List.map(
                    (v, i) => (
                        <React.Fragment key={`${v.rendererId}${i}`}>
                            <h2>{v.heading}:</h2>
                            {props.qsuggPlugin.createElement(v.rendererId, v.contents)}
                        </React.Fragment>
                    ),
                    props.querySuggestions[props.sourceId]
                )}
            </div>
        );
    };

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
                        {this._renderButtons().map((item, i) => {
                            return <li key={i}>{item}</li>
                        })}
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

    // ------------------- <SingleLineInput /> -----------------------------

    class SingleLineInput extends React.Component<SingleLineInputProps & QueryFormModelState> {

        constructor(props) {
            super(props);
            this.handleInputChange = this.handleInputChange.bind(this);
            this.handleKeyDown = this.handleKeyDown.bind(this);
        }

        private handleInputChange(evt:React.ChangeEvent<HTMLInputElement>) {
            dispatcher.dispatch<Actions.QueryInputSetQuery>({
                name: ActionName.QueryInputSetQuery,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId,
                    query: evt.target.value,
                    rawAnchorIdx: this.props.refObject.current.selectionStart,
                    rawFocusIdx: this.props.refObject.current.selectionEnd,
                    insertRange: null
                }
            });
        }

        private handleKeyDown(evt) {
            if (evt.keyCode === Keyboard.Code.DOWN_ARROW &&
                    this.props.hasHistoryWidget &&
                    this.props.downArrowTriggersHistory[this.props.sourceId] &&
                        !this.props.historyIsVisible) {
                this.props.onReqHistory();

            } else if (evt.keyCode === Keyboard.Code.ESC) {
                this.props.onEsc();
            }
        }

        render() {
            return <input className="simple-input" type="text"
                                spellCheck={false}
                                ref={this.props.refObject}
                                onChange={this.handleInputChange}
                                value={this.props.queries[this.props.sourceId]}
                                onKeyDown={this.handleKeyDown} />;
        }
    }

    const BoundSingleLineInput = BoundWithProps<SingleLineInputProps, QueryFormModelState>(SingleLineInput, queryModel);

    // ------------------- <DefaultAttrSelector /> -----------------------------

    const DefaultAttrSelector:React.SFC<{
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
                    formType: this.props.formType
                }
            });
            if (!this.props.historyVisible && this._queryInputElement.current) {
                this._queryInputElement.current.focus();
            }
        }

        componentDidMount() {
            if (this.props.takeFocus && this._queryInputElement.current) {
                this._queryInputElement.current.focus();
            }
        }

        componentDidUpdate(prevProps, prevState) {
            if (prevProps.historyVisible && !this.props.historyVisible &&
                    this._queryInputElement.current) {
                this._queryInputElement.current.focus();
            }
        }

        handleReqHistory():void {
            this._toggleHistoryWidget();
        }

        handleInputEscKeyDown():void {
        }

        _renderInput() {
            switch (this.props.queryType) {
                case 'iquery':
                case 'lemma':
                case 'phrase':
                case 'word':
                    return <BoundSingleLineInput
                                sourceId={this.props.sourceId}
                                refObject={this._queryInputElement as React.RefObject<HTMLInputElement>}
                                hasHistoryWidget={this.props.widgets.indexOf('history') > -1}
                                historyIsVisible={this.props.historyVisible}
                                onReqHistory={this.handleReqHistory}
                                onEsc={this.handleInputEscKeyDown} />;
                case 'cql':
                    return this.props.useCQLEditor ?
                        <cqlEditorViews.CQLEditor
                                formType={this.props.formType}
                                sourceId={this.props.sourceId}
                                takeFocus={this.props.takeFocus}
                                onReqHistory={this.handleReqHistory}
                                onEsc={this.handleInputEscKeyDown}
                                hasHistoryWidget={this.props.widgets.indexOf('history') > -1}
                                historyIsVisible={this.props.historyVisible}
                                inputRef={this._queryInputElement as React.RefObject<HTMLPreElement>} /> :
                        <cqlEditorViews.CQLEditorFallback
                                formType={this.props.formType}
                                sourceId={this.props.sourceId}
                                inputRef={this._queryInputElement as React.RefObject<HTMLTextAreaElement>}
                                onReqHistory={this.handleReqHistory}
                                onEsc={this.handleInputEscKeyDown}
                                hasHistoryWidget={this.props.widgets.indexOf('history') > -1}
                                historyIsVisible={this.props.historyVisible} />;
            }
        }

        _renderInputOptions() {
            switch (this.props.queryType) {
                case 'iquery':
                    return null;
                case 'lemma':
                    return <LposSelector wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValue}
                                sourceId={this.props.sourceId}
                                formType={this.props.formType}  />;
                case 'phrase':
                    return <MatchCaseSelector matchCaseValue={this.props.matchCaseValue}
                                sourceId={this.props.sourceId}
                                formType={this.props.formType} />;
                case 'word':
                    return (
                        <span>
                            <LposSelector wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValue}
                                sourceId={this.props.sourceId}
                                formType={this.props.formType}  />
                            {'\u00a0'}
                            <MatchCaseSelector matchCaseValue={this.props.matchCaseValue}
                                sourceId={this.props.sourceId}
                                formType={this.props.formType} />
                        </span>
                    );
                case 'cql':
                    return (
                        <span className="default-attr-selection">
                            {he.translate('query__default_attr') + ':\u00a0'}
                            <DefaultAttrSelector defaultAttr={this.props.defaultAttr}
                                    forcedAttr={this.props.forcedAttr}
                                    attrList={this.props.attrList}
                                    sourceId={this.props.sourceId}
                                    formType={this.props.formType} />{'\u00a0'}
                            {this.props.tagsetDocUrl ?
                                (<span className="tagset-summary">(
                                    <a className="external" target="_blank" href={this.props.tagsetDocUrl}>
                                    {he.translate('query__tagset_summary')}</a>)</span>)
                                : null}
                        </span>
                    );
            }
        }

        render() {
            return (
                <tr>
                    <th>{he.translate('query__query_th')}:</th>
                    <td>
                        <div className="query-area">
                            <BoundQueryToolbox
                                widgets={this.props.widgets}
                                tagHelperView={this.props.tagHelperView}
                                sourceId={this.props.sourceId}
                                toggleHistoryWidget={this._toggleHistoryWidget}
                                inputLanguage={this.props.inputLanguage} />
                            {this._renderInput()}
                            {this.props.historyVisible ?
                                <HistoryWidget
                                        queryStorageView={this.props.queryStorageView}
                                        sourceId={this.props.sourceId}
                                        onCloseTrigger={this._toggleHistoryWidget}
                                        formType={this.props.formType}/>
                                : null
                            }
                            {
                                !this.props.historyVisible && this.props.suggestionsVisible &&
                                this.props.querySuggestions[this.props.sourceId] &&
                                this.props.querySuggestions[this.props.sourceId].length ?
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
                        <div className="query-options">
                            {this._renderInputOptions()}
                        </div>
                    </td>
                </tr>
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