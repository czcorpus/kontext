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
import {ActionDispatcher} from '../../app/dispatcher';
import {init as keyboardInit} from './keyboard';
import {init as cqlEditoInit} from './cqlEditor';
import {WithinBuilderModel} from '../../models/query/withinBuilder';
import {PluginInterfaces} from '../../types/plugins';
import {Kontext, KeyCodes} from '../../types/common';
import {QueryFormModel} from '../../models/query/common';
import {UsageTipsModel, UsageTipsState, UsageTipCategory} from '../../models/usageTips';
import {VirtualKeyboardModel} from '../../models/query/virtualKeyboard';
import {CQLEditorModel} from '../../models/query/cqleditor/model';


export interface InputModuleArgs {
    dispatcher:ActionDispatcher;
    he:Kontext.ComponentHelpers;
    queryModel:QueryFormModel;
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
    actionPrefix:string;
    sourceId:string;
    lposValue:string;
    wPoSList:Immutable.List<{n:string; v:string}>;
    queryType:string;
    queryStorageView:PluginInterfaces.QueryStorage.WidgetView;
    tagHelperView:PluginInterfaces.TagHelper.View;
    widgets:Immutable.List<string>;
    inputLanguage:string;
    useCQLEditor:boolean;
    forcedAttr:string;
    defaultAttr:string;
    attrList:Immutable.List<Kontext.AttrItem>;
    matchCaseValue:boolean;
    tagsetDocUrl:string;
    onEnterKey:()=>void;
    takeFocus?:boolean;
}


export interface TRQueryInputFieldState {
    query:string;
    historyVisible:boolean;
    cqlEditorMessage:string;
}


export interface TRQueryTypeFieldProps {
    actionPrefix:string;
    sourceId:string;
    queryType:string; // TODO enum
    hasLemmaAttr:boolean;
}


export interface TRPcqPosNegFieldProps {
    actionPrefix:string;
    sourceId:string;
    value:string; // TODO enum
}

export interface TRIncludeEmptySelectorProps {
    value:boolean;
    corpname:string;
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

    class QueryHints extends React.Component<{
        actionPrefix:string;
    }, UsageTipsState> {

        constructor(props) {
            super(props);
            this._changeListener = this._changeListener.bind(this);
            this._clickHandler = this._clickHandler.bind(this);
            this.state = queryHintModel.getState();
        }

        _changeListener(state) {
            this.setState(state);
        }

        _clickHandler() {
            dispatcher.dispatch({
                actionType: this.props.actionPrefix + 'NEXT_QUERY_HINT',
                props: {}
            });
        }

        componentDidMount() {
            queryHintModel.addChangeListener(this._changeListener);
        }

        componentWillUnmount() {
            queryHintModel.removeChangeListener(this._changeListener);
        }

        render() {
            return (
                <div>
                    <span className="hint">{this.state.currentHints.get(UsageTipCategory.QUERY)}</span>
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
            dispatcher.dispatch({
                actionType: props.actionPrefix + 'QUERY_INPUT_SELECT_TYPE',
                props: {
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
            dispatcher.dispatch({
                actionType: props.actionPrefix + 'QUERY_INPUT_SET_PCQ_POS_NEG',
                props: {
                    corpname: props.sourceId,
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
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SET_INCLUDE_EMPTY',
                props: {
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
        sourceId:string;
        actionPrefix:string;
        args:Kontext.GeneralProps;
        tagHelperView:PluginInterfaces.TagHelper.View
        closeClickHandler:()=>void;

    }> = (props) => {

        return (
            <layoutViews.PopupBox
                    onCloseClick={props.closeClickHandler}
                    customClass="tag-builder-widget"
                    customStyle={{position: 'absolute', left: '10em', marginTop: '6.5em'}}>
                <props.tagHelperView
                        sourceId={props.sourceId}
                        onInsert={props.closeClickHandler}
                        onEscKey={props.closeClickHandler}
                        actionPrefix={props.actionPrefix}
                        range={[props.args['leftIdx'], props.args['rightIdx']]} />
            </layoutViews.PopupBox>
        );
    };

    // ------------------- <WithinWidget /> --------------------------------

    class WithinWidget extends React.Component<{
        actionPrefix:string;
        sourceId:string;
        closeClickHandler:()=>void;

    }, {
        exportedQuery:string;
        data:Immutable.List<[string, string]>;
        attr:number;
        query:string;
    }> {

        constructor(props) {
            super(props);
            this._handleModelChange = this._handleModelChange.bind(this);
            this._handleInputChange = this._handleInputChange.bind(this);
            this._handleKeyDown = this._handleKeyDown.bind(this);
            this._handleAttrChange = this._handleAttrChange.bind(this);
            this._handleInsert = this._handleInsert.bind(this);
            this.state = {
                data: withinBuilderModel.getData(),
                query: withinBuilderModel.getQuery(),
                attr: withinBuilderModel.getCurrAttrIdx(),
                exportedQuery: withinBuilderModel.exportQuery()
            };
        }

        _handleModelChange() {
            this.setState({
                data: withinBuilderModel.getData(),
                query: withinBuilderModel.getQuery(),
                attr: withinBuilderModel.getCurrAttrIdx(),
                exportedQuery: withinBuilderModel.exportQuery()
            });
        }

        _handleInputChange(evt) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SET_WITHIN_VALUE',
                props: {
                    value: evt.target.value
                }
            });
        }

        _handleKeyDown(evt) {
            if (evt.keyCode === 27) {
                evt.stopPropagation();
                evt.preventDefault();
                this.props.closeClickHandler();
            }
        }

        _handleAttrChange(evt) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SET_WITHIN_ATTR',
                props: {
                    idx: evt.target.value
                }
            });
        }

        _handleInsert() {
            dispatcher.dispatch({
                actionType: this.props.actionPrefix + 'QUERY_INPUT_APPEND_QUERY',
                props: {
                    sourceId: this.props.sourceId,
                    query: this.state.exportedQuery,
                    prependSpace: true,
                    closeWhenDone: true
                }
            });
        }

        componentDidMount() {
            withinBuilderModel.addChangeListener(this._handleModelChange);
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_LOAD_WITHIN_BUILDER_DATA',
                props: {
                    sourceId: this.props.sourceId
                }
            });
        }

        componentWillUnmount() {
            withinBuilderModel.removeChangeListener(this._handleModelChange);
        }

        render() {
            return (
                <layoutViews.PopupBox
                        onCloseClick={this.props.closeClickHandler}
                        customStyle={{position: 'absolute', left: '80pt', marginTop: '5pt'}}>
                    <div onKeyDown={this._handleKeyDown}>
                        <h3>{he.translate('query__create_within')}</h3>
                        <div className="within-widget">
                            <select onChange={this._handleAttrChange} value={this.state.attr}>
                                {this.state.data.map((item, i) => {
                                    return <option key={item.join('-')} value={i}>{`${item[0]}.${item[1]}`}</option>;
                                })}
                            </select>
                            {'\u00a0'}={'\u00a0'}
                            <input type="text" value={this.state.query} onChange={this._handleInputChange}
                                    ref={item => item ? item.focus() : null} />
                            {'\u00a0'}
                        </div>
                        <p>
                            <button type="button" className="util-button"
                                    onClick={this._handleInsert}>
                                {he.translate('query__insert_within')}
                            </button>
                        </p>
                    </div>
                </layoutViews.PopupBox>
            );
        }
    }

    // ------------------- <HistoryWidget /> -----------------------------

    const HistoryWidget:React.SFC<{
        sourceId:string;
        actionPrefix:string;
        onCloseTrigger:()=>void;
        queryStorageView:PluginInterfaces.QueryStorage.WidgetView;

    }> = (props) => {
        return (
            <div className="history-widget">
                <props.queryStorageView
                        sourceId={props.sourceId}
                        onCloseTrigger={props.onCloseTrigger}
                        actionPrefix={props.actionPrefix} />
            </div>
        );
    };

    // ------------------- <KeyboardWidget /> --------------------------------

    const KeyboardWidget:React.SFC<{
        sourceId:string;
        actionPrefix:string;
        inputLanguage:string;
        closeClickHandler:()=>void;

    }> = (props) => {

        const keyHandler = (evt) => {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_HIT_VIRTUAL_KEYBOARD_KEY',
                props: {
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
                <keyboardViews.Keyboard sourceId={props.sourceId}
                        inputLanguage={props.inputLanguage}
                        actionPrefix={props.actionPrefix} />
            </layoutViews.PopupBox>
        );
    };

    // ------------------- <QueryToolbox /> -----------------------------

    class QueryToolbox extends React.Component<{
        sourceId:string;
        actionPrefix:string;
        widgets:Immutable.List<string>;
        inputLanguage:string;
        tagHelperView:PluginInterfaces.TagHelper.View;
        toggleHistoryWidget:()=>void;

    }, {
        activeWidget:string;
        widgetArgs:Kontext.GeneralProps;
    }> {

        constructor(props) {
            super(props);
            this._handleWidgetTrigger = this._handleWidgetTrigger.bind(this);
            this._handleHistoryWidget = this._handleHistoryWidget.bind(this);
            this._handleCloseWidget = this._handleCloseWidget.bind(this);
            this._handleQueryModelChange = this._handleQueryModelChange.bind(this);
            this.state = {
                activeWidget: queryModel.getActiveWidget(this.props.sourceId),
                widgetArgs: queryModel.getWidgetArgs()
            };
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
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SET_ACTIVE_WIDGET',
                props: {
                    sourceId: this.props.sourceId,
                    value: name
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
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SET_ACTIVE_WIDGET',
                props: {
                    sourceId: this.props.sourceId,
                    value: null
                }
            });
        }

        _renderWidget() {
            switch (this.state.activeWidget) {
                case 'tag':
                    return <TagWidget closeClickHandler={this._handleCloseWidget}
                                tagHelperView={this.props.tagHelperView}
                                sourceId={this.props.sourceId}
                                actionPrefix={this.props.actionPrefix}
                                args={this.state.widgetArgs} />;
                case 'within':
                    return <WithinWidget closeClickHandler={this._handleCloseWidget}
                                sourceId={this.props.sourceId} actionPrefix={this.props.actionPrefix} />;
                case 'keyboard':
                    return <KeyboardWidget closeClickHandler={this._handleCloseWidget}
                                sourceId={this.props.sourceId} inputLanguage={this.props.inputLanguage}
                                actionPrefix={this.props.actionPrefix} />;
                default:
                    return null;
            }
        }

        _handleQueryModelChange() {
            this.setState({
                activeWidget: queryModel.getActiveWidget(this.props.sourceId),
                widgetArgs: queryModel.getWidgetArgs()
            });
        }

        componentDidMount() {
            queryModel.addChangeListener(this._handleQueryModelChange);
        }

        componentWillUnmount() {
            queryModel.removeChangeListener(this._handleQueryModelChange);
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

    // ------------------- <LposSelector /> -----------------------------

    const LposSelector:React.SFC<{
        sourceId:string;
        actionPrefix:string;
        wPoSList:Immutable.List<{v:string; n:string}>;
        lposValue:string;

    }> = (props) => {

        const handleLposChange = (evt) => {
            dispatcher.dispatch({
                actionType: props.actionPrefix + 'QUERY_INPUT_SET_LPOS',
                props: {
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
        actionPrefix:string;
        sourceId:string;
        matchCaseValue:boolean;

    }> = (props) => {

        const handleCheckbox = (evt) => {
            dispatcher.dispatch({
                actionType: props.actionPrefix + 'QUERY_INPUT_SET_MATCH_CASE',
                props: {
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

    // ------------------- <DefaultAttrSelector /> -----------------------------

    const DefaultAttrSelector:React.SFC<{
        actionPrefix:string;
        sourceId:string;
        forcedAttr:string;
        defaultAttr:string;
        attrList:Immutable.List<Kontext.AttrItem>;

    }> = (props) => {

        const handleSelectChange = (evt) => {
            dispatcher.dispatch({
                actionType: props.actionPrefix + 'QUERY_INPUT_SET_DEFAULT_ATTR',
                props: {
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

    class TRQueryInputField extends React.Component<TRQueryInputFieldProps, TRQueryInputFieldState> {

        private _queryInputElement:React.RefObject<HTMLInputElement>;

        constructor(props) {
            super(props);
            this._queryInputElement = React.createRef();
            this._handleInputChange = this._handleInputChange.bind(this);
            this._handleModelChange = this._handleModelChange.bind(this);
            this._inputKeyHandler = this._inputKeyHandler.bind(this);
            this._toggleHistoryWidget = this._toggleHistoryWidget.bind(this);
            this._inputChangeHandler = this._inputChangeHandler.bind(this);
            this.state = {
                query: queryModel.getQuery(this.props.sourceId),
                historyVisible: false,
                cqlEditorMessage: cqlEditorModel.getState().message.get(this.props.sourceId)
            };
        }

        _handleInputChange(evt:React.ChangeEvent<HTMLTextAreaElement|HTMLInputElement>) {
            dispatcher.dispatch({
                actionType: this.props.actionPrefix + 'QUERY_INPUT_SET_QUERY',
                props: {
                    sourceId: this.props.sourceId,
                    query: evt.target.value
                }
            });
        }

        _handleModelChange(state) {
            this.setState({
                query: queryModel.getQuery(this.props.sourceId),
                historyVisible: this.state.historyVisible,
                cqlEditorMessage: state ? state.message.get(this.props.sourceId) : this.state.cqlEditorMessage
            });
        }

        _inputKeyHandler(evt) {
            if (this.props.widgets.indexOf('history') > -1 &&
                    evt.keyCode === KeyCodes.DOWN_ARROW && !this.state.historyVisible) {
                this._toggleHistoryWidget();
                evt.stopPropagation();
                evt.preventDefault();

            } else if (evt.keyCode === KeyCodes.ENTER && !evt.shiftKey) {
                this.props.onEnterKey();
                evt.stopPropagation();
                evt.preventDefault();

            } else if (evt.keyCode === KeyCodes.ESC) {
                // TODO - use a React way
                const firstButton = document.querySelector('.query-form button');
                if (firstButton instanceof HTMLButtonElement) {
                    firstButton.focus();
                }
            }
        }

        _inputChangeHandler() {}

        _toggleHistoryWidget() {
            this.setState({
                query: queryModel.getQuery(this.props.sourceId),
                historyVisible: !this.state.historyVisible,
                cqlEditorMessage: this.state.cqlEditorMessage
            });
        }

        componentDidMount() {
            cqlEditorModel.addChangeListener(this._handleModelChange);
            if (this.props.takeFocus && this._queryInputElement.current) {
                this._queryInputElement.current.focus();
            }
        }

        componentWillUnmount() {
            cqlEditorModel.removeChangeListener(this._handleModelChange);
        }

        componentDidUpdate(prevProps, prevState) {
            if (prevState.historyVisible && !this.state.historyVisible &&
                    this._queryInputElement.current) {
                this._queryInputElement.current.focus();
            }
        }

        _renderInput() {
            switch (this.props.queryType) {
                case 'iquery':
                case 'lemma':
                case 'phrase':
                case 'word':
                case 'char':
                    return <input className="simple-input" type="text"
                                spellCheck={false}
                                ref={this._queryInputElement}
                                onChange={this._handleInputChange}
                                value={this.state.query}
                                onKeyDown={this._inputKeyHandler} />;
                case 'cql':
                    return this.props.useCQLEditor ?
                        <cqlEditorViews.CQLEditor
                                sourceId={this.props.sourceId}
                                initialValue={this.state.query}
                                takeFocus={this.props.takeFocus}
                                inputKeyHandler={this._inputKeyHandler}
                                inputChangeHandler={this._inputChangeHandler} /> :
                        <cqlEditorViews.CQLEditorFallback
                            value={this.state.query}
                            takeFocus={this.props.takeFocus}
                            inputChangeHandler={this._handleInputChange} />;
            }
        }

        _renderInputOptions() {
            switch (this.props.queryType) {
                case 'iquery':
                case 'char':
                    return null;
                case 'lemma':
                    return <LposSelector wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValue}
                                sourceId={this.props.sourceId}
                                actionPrefix={this.props.actionPrefix}  />;
                case 'phrase':
                    return <MatchCaseSelector matchCaseValue={this.props.matchCaseValue}
                                sourceId={this.props.sourceId}
                                actionPrefix={this.props.actionPrefix} />;
                case 'word':
                    return (
                        <span>
                            <LposSelector wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValue}
                                sourceId={this.props.sourceId}
                                actionPrefix={this.props.actionPrefix}  />
                            {'\u00a0'}
                            <MatchCaseSelector matchCaseValue={this.props.matchCaseValue}
                                sourceId={this.props.sourceId}
                                actionPrefix={this.props.actionPrefix} />
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
                                    actionPrefix={this.props.actionPrefix} />{'\u00a0'}
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
                            <QueryToolbox widgets={this.props.widgets}
                                tagHelperView={this.props.tagHelperView}
                                sourceId={this.props.sourceId}
                                toggleHistoryWidget={this._toggleHistoryWidget}
                                inputLanguage={this.props.inputLanguage}
                                actionPrefix={this.props.actionPrefix} />
                            {this._renderInput()}
                            {this.state.historyVisible ?
                                <HistoryWidget
                                        queryStorageView={this.props.queryStorageView}
                                        sourceId={this.props.sourceId}
                                        onCloseTrigger={this._toggleHistoryWidget}
                                        actionPrefix={this.props.actionPrefix}/>
                                : null
                            }
                            <div className="query-hints">
                                {
                                    this.state.cqlEditorMessage ?
                                    <div className="cql-editor-message"
                                            dangerouslySetInnerHTML={{__html: this.state.cqlEditorMessage}} /> :
                                    <QueryHints actionPrefix={this.props.actionPrefix} />
                                }
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


    return {
        TRQueryInputField: TRQueryInputField,
        TRQueryTypeField: TRQueryTypeField,
        TRPcqPosNegField: TRPcqPosNegField,
        TRIncludeEmptySelector: TRIncludeEmptySelector
    };

}