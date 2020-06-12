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
import {IActionDispatcher} from 'kombo';
import {PluginInterfaces} from '../types/plugins';
import {Kontext, TextTypes, KeyCodes} from '../types/common';
import { ExtendedInfo } from '../models/textTypes/valueSelections';
import { CoreViews } from '../types/coreViews';
import { Subscription } from 'rxjs';


export interface TextTypesPanelProps {
    liveAttrsView:PluginInterfaces.LiveAttributes.View;
    liveAttrsCustomTT:PluginInterfaces.LiveAttributes.CustomAttribute;
    onReady:()=>void;
}


interface TextTypesPanelState {
    attributes:Immutable.List<TextTypes.AttributeSelection>;
    rangeModes:Immutable.Map<string, boolean>;
    minimized:Immutable.Map<string, boolean>;
    hasSomeMaximizedBoxes:boolean;
}


export interface TextTypeAttributeMinIconProps {
    isMinimized:boolean;
    onClick:()=>void;
}


export interface TextTypesViews {
    TextTypesPanel:React.ComponentClass<TextTypesPanelProps>;
    TextTypeAttributeMinIcon:React.SFC<TextTypeAttributeMinIconProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, textTypesModel:TextTypes.ITextTypesModel):TextTypesViews {

    const layoutViews = he.getLayoutViews();

    // ----------------------------- <RangeSelector /> --------------------------

    class RangeSelector extends React.Component<{
        attrName:string;
    },
    {
        fromValue:string;
        toValue:string;
        keepCurrent:boolean;
        intervalBehavior:string;
        hasSelectedValues:boolean;
        showHelp:boolean;
    }> {

        constructor(props) {
            super(props);
            this._confirmClickHandler = this._confirmClickHandler.bind(this);
            this._mkInputChangeHandler = this._mkInputChangeHandler.bind(this);
            this._keyboardHandler = this._keyboardHandler.bind(this);
            this._helpClickHandler = this._helpClickHandler.bind(this);
            this._helpCloseHandler = this._helpCloseHandler.bind(this);
            this.state = {
                fromValue: null,
                toValue: null,
                keepCurrent: false,
                intervalBehavior: 'strict',
                hasSelectedValues: textTypesModel.findHasSelectedItems(this.props.attrName),
                showHelp: false
            };
        }

        _confirmClickHandler() {
            dispatcher.dispatch({
                name: 'TT_RANGE_BUTTON_CLICKED',
                payload: {
                    attrName: this.props.attrName,
                    fromVal: this.state.fromValue ? parseFloat(this.state.fromValue) : null,
                    toVal: this.state.toValue ? parseFloat(this.state.toValue) : null,
                    keepCurrent: this.state.keepCurrent,
                    strictInterval: this.state.intervalBehavior === 'strict'
                }
            });
        }

        _mkInputChangeHandler(name) {
            return (evt) => {
                const newState = he.cloneState(this.state);
                if (name !== 'keepCurrent') {
                    newState[name] = evt.target.value;

                } else {
                    newState[name] = !this.state.keepCurrent;
                }
                this.setState(newState);
            };
        }

        _keyboardHandler(evt) {
            if (evt.keyCode === KeyCodes.ENTER) {
                this._confirmClickHandler();
                evt.preventDefault();
            }
        }

        _helpClickHandler() {
            const newState = he.cloneState(this.state);
            newState.showHelp = true;
            this.setState(newState);
        }

        _helpCloseHandler() {
            const newState = he.cloneState(this.state);
            newState.showHelp = false;
            this.setState(newState);
        }

        render() {
            return (
                <div className="range-selector">
                    <div>
                        <label className="date">
                            {he.translate('query__tt_from')}:{'\u00A0'}
                            <input onChange={this._mkInputChangeHandler('fromValue')}
                                    onKeyDown={this._keyboardHandler}
                                    className="from-value"
                                    type="text" style={{width: '5em'}} />
                        </label>
                        {'\u00A0'}
                        <label className="date">
                            {he.translate('query__tt_to')}:{'\u00A0'}
                            <input onChange={this._mkInputChangeHandler('toValue')}
                                    onKeyDown={this._keyboardHandler}
                                    className="to-value"
                                    type="text" style={{width: '5em'}} />
                        </label>
                    </div>
                    {
                        this.state.hasSelectedValues
                        ? (
                            <label className="keep-current">
                                {he.translate('query__tt_keep_current_selection')}:{'\u00A0'}
                                <input type="checkbox" onChange={this._mkInputChangeHandler('keepCurrent')} />
                            </label>
                        )
                        : null
                    }
                    <div className="interval-switch">
                        <div>
                            <span className="label">
                                {he.translate('query__tt_interval_inclusion_policy')}:{'\u00A0'}
                            </span>
                            <select className="interval-behavior" defaultValue={this.state.intervalBehavior}
                                    onChange={this._mkInputChangeHandler('intervalBehavior')}>
                                <option value="relaxed">{he.translate('query__tt_partial_interval')}</option>
                                <option value="strict">{he.translate('query__tt_strict_interval')}</option>
                            </select>
                            <a className="context-help">
                                <layoutViews.ImgWithMouseover
                                     src={he.createStaticUrl('img/question-mark.svg')}
                                     htmlClass="over-img"
                                     alt="question-mark.svg"
                                     clickHandler={this._helpClickHandler} />
                            </a>
                            {this.state.showHelp
                                ? <layoutViews.PopupBox onCloseClick={this._helpCloseHandler}
                                        status="info" autoWidth={CoreViews.AutoWidth.NARROW}>
                                        <div>{he.translate('query__tt_range_help_text')}</div>
                                    </layoutViews.PopupBox>
                                : null}
                        </div>
                    </div>
                    <button type="button" className="default-button confirm-range"
                            onClick={this._confirmClickHandler}>{he.translate('query__tt_range_OK')}</button>
                </div>
            );
        }
    }


    // ----------------------------- <CheckboxItem /> --------------------------

    class CheckBoxItem extends React.Component<{
        itemName:string;
        itemValue:string;
        itemIdx:number;
        itemIsSelected:boolean;
        itemIsLocked:boolean;
    }, {}> {

        constructor(props) {
            super(props);
            this._clickHandler = this._clickHandler.bind(this);
        }

        _clickHandler() {
            dispatcher.dispatch({
                name: 'TT_VALUE_CHECKBOX_CLICKED',
                payload: {
                    attrName: this.props.itemName,
                    itemIdx: this.props.itemIdx
                }
            });
        }

        shouldComponentUpdate(nextProps, nextState) {
            return this.props.itemValue !== nextProps.itemValue ||
                    this.props.itemIsSelected !== nextProps.itemIsSelected ||
                    this.props.itemIsLocked !== nextProps.itemIsLocked;
        }

        render() {
            const itemName = 'sca_' + this.props.itemName;
            return (
                <label className={this.props.itemIsLocked ? 'locked' : null}>
                    <input
                        type="checkbox"
                        name={itemName}
                        value={this.props.itemValue}
                        className="attr-selector user-selected"
                        checked={this.props.itemIsSelected}
                        onChange={this._clickHandler}
                        disabled={this.props.itemIsLocked}
                    />
                    {this.props.itemIsLocked ?
                        <input type="hidden" name={itemName} value={this.props.itemValue} /> : null }
                    {this.props.itemValue}
                </label>
            );
        }
    }

    // ----------------------------- <ExtendedInfoBox /> --------------------------

    const ExtendedInfoBox:React.SFC<{
        attrName:string;
        ident:string;
        data:ExtendedInfo;

    }> = (props) => {

        const clickCloseHandler = () => {
            dispatcher.dispatch({
                name: 'TT_EXTENDED_INFORMATION_REMOVE_REQUEST',
                payload: {
                    attrName: props.attrName,
                    ident: props.ident
                }
            });
        };

        const renderContent = () => {
            if (props.data.has('__message__')) {
                return <div className="message"><p>{props.data.get('__message__')}</p></div>;

            } else {
                return (
                    <ul>
                        {props.data.entrySeq().map((item) => {
                            return <li key={item[0]}><strong>{item[0]}:</strong>{'\u00A0'}{item[1]}</li>;
                        })}
                    </ul>
                );
            }
        };

        return (
            <layoutViews.PopupBox onCloseClick={clickCloseHandler}
                        customClass="metadata-detail"
                        customStyle={{marginLeft: '5em'}}>
                {renderContent()}
            </layoutViews.PopupBox>
        );
    };

    // ----------------------------- <ExtendedInfoButton /> ------------------------------

    class ExtendedInfoButton extends React.Component<{
        attrName:string;
        ident:string;
        containsExtendedInfo:boolean;
        numGrouped:number;

    },
    {
        isWaiting:boolean;
    }> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = {isWaiting: false};
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
            this._handleClick = this._handleClick.bind(this);
        }

        _handleClick(evt) {
            this.setState({isWaiting: true});
            dispatcher.dispatch({
                name: 'TT_EXTENDED_INFORMATION_REQUEST',
                payload: {
                    attrName: this.props.attrName,
                    ident: this.props.ident
                }
            });
        }

        _modelChangeHandler() {
            if (this.state.isWaiting && this.props.containsExtendedInfo) {
                this.setState({isWaiting: textTypesModel.isBusy()});
            }
        }

        componentDidMount() {
            this.modelSubscription = textTypesModel.addListener(this._modelChangeHandler);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        render() {
            if (this.state.isWaiting) {
                return <img src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                            alt={he.translate('global__loading')} />;

            } else if (this.props.numGrouped < 2) {
                return <a onClick={this._handleClick} className="bib-info">i</a>;

            } else {
                return <a onClick={this._handleClick} className="bib-warn">!</a>
            }

        }
    }

    // ----------------------------- <FullListContainer /> --------------------------

    const FullListContainer:React.SFC<{
        attrObj:TextTypes.AttributeSelection; // TODO maybe something more serializable here
        hasExtendedInfo:boolean;
        rangeIsOn:boolean;

    }> = (props) => {

        const renderListOfCheckBoxes = () => {
            return (
                <table className="FullListContainer">
                    <tbody>
                    {props.attrObj.getValues().map((item, i) => {
                        return (
                            <tr key={item.value + String(i)}>
                                <td><CheckBoxItem
                                        itemIdx={i}
                                        itemName={props.attrObj.name}
                                        itemValue={item.value}
                                        itemIsSelected={item.selected}
                                        itemIsLocked={item.locked}
                                            /></td>
                                <td className="num">{item.availItems ? he.formatNumber(item.availItems) : ''}</td>
                                <td className="extended-info">
                                {props.hasExtendedInfo ?
                                    <ExtendedInfoButton ident={item.ident} attrName={props.attrObj.name}
                                            numGrouped={item.numGrouped} containsExtendedInfo={!!item.extendedInfo} />
                                    : null
                                }
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            );
        };

        return (
            <div>
                {
                    props.rangeIsOn ? <RangeSelector attrName={props.attrObj.name} /> :
                        renderListOfCheckBoxes()
                }
            </div>
        );
    };

    // ----------------------------- <AutoCompleteBox /> --------------------------

    class AutoCompleteBox extends React.Component<{
        attrObj:TextTypes.ITextInputAttributeSelection;
        customAutoCompleteHintClickHandler:(item:TextTypes.AutoCompleteItem)=>void;
    },
    {

    }> {

        private _outsideClick:boolean;

        constructor(props) {
            super(props);
            this._outsideClick = false;
            this._handleAutoCompleteHintClick = this._handleAutoCompleteHintClick.bind(this);
            this._handleDocumentClick = this._handleDocumentClick.bind(this);
            this._handleAutoCompleteAreaClick = this._handleAutoCompleteAreaClick.bind(this);
        }

        _handleAutoCompleteHintClick(item) {
            if (typeof this.props.customAutoCompleteHintClickHandler === 'function') {
                this.props.customAutoCompleteHintClickHandler(item);

            } else {
                dispatcher.dispatch({
                    name: 'TT_ATTRIBUTE_AUTO_COMPLETE_HINT_CLICKED',
                    payload: {
                        attrName: this.props.attrObj.name,
                        ident: item.ident,
                        label: item.label,
                        append: false
                    }
                });
            }
        }

        _handleDocumentClick(event) {
            if (event.eventPhase === Event.CAPTURING_PHASE) {
                this._outsideClick = true;

            } else if (event.eventPhase === Event.BUBBLING_PHASE) {
                if (this._outsideClick) {
                    dispatcher.dispatch({
                        name: 'TT_ATTRIBUTE_AUTO_COMPLETE_RESET',
                        payload: {
                            attrName: this.props.attrObj.name
                        }
                    });
                    this._outsideClick = false;
                }
            }
        }

        _handleAutoCompleteAreaClick(event) {
            this._outsideClick = false;
        }

        componentDidMount() {
            window.document.addEventListener('click', this._handleDocumentClick, true);
            window.document.addEventListener('click', this._handleDocumentClick, false);
        }

        componentWillUnmount() {
            window.document.removeEventListener('click', this._handleDocumentClick, true);
            window.document.removeEventListener('click', this._handleDocumentClick, false);
        }

        render() {
            let data = this.props.attrObj.getAutoComplete();
            return (
                <ul className="auto-complete"
                    onClick={this._handleAutoCompleteAreaClick}>
                {data.map((item) => {
                    return (
                        <li key={item.ident}>
                            <a onClick={()=>this._handleAutoCompleteHintClick(item)}>
                                {item.label}
                            </a>
                        </li>
                    );
                })}
                </ul>
            );
        }
    }

    // ----------------------------- <RawInputContainer /> --------------------------

    class RawInputContainer extends React.PureComponent<{
        attrObj:TextTypes.ITextInputAttributeSelection;
        customInputName:string;
        customAutoCompleteHintClickHandler:(item:TextTypes.AutoCompleteItem)=>void;

    }> {

        private throttlingTimer:number;

        private _throttlingIntervalMs:number;

        constructor(props) {
            super(props);
            this.throttlingTimer = null;
            this._throttlingIntervalMs = 300;
            this._inputChangeHandler = this._inputChangeHandler.bind(this);
        }

        _inputChangeHandler(evt) {
            const v = evt.target.value;

            dispatcher.dispatch({
                name: 'TT_ATTRIBUTE_TEXT_INPUT_CHANGED',
                payload: {
                    attrName: this.props.attrObj.name,
                    value: v
                }
            });

            if (this.throttlingTimer) {
                window.clearTimeout(this.throttlingTimer);
            }
            this.throttlingTimer = window.setTimeout(() => {
                dispatcher.dispatch({
                    name: 'TT_ATTRIBUTE_TEXT_INPUT_AUTOCOMPLETE_REQUEST',
                    payload: {
                        attrName: this.props.attrObj.name,
                        value: v
                    }
                });
            }, this._throttlingIntervalMs);
        }

        _renderAutoComplete() {
            if (this.props.attrObj.getAutoComplete().size > 0) {
                return <AutoCompleteBox attrObj={this.props.attrObj}
                                customAutoCompleteHintClickHandler={this.props.customAutoCompleteHintClickHandler} />;

            } else {
                return null;
            }
        }

        render() {
            return (
                <table className="textTypes_RawInputContainer">
                    <tbody>
                        <tr>
                            <td>
                                <input type="text"
                                    name={this.props.customInputName
                                            ? this.props.customInputName
                                            : 'sca_' + this.props.attrObj.name}
                                    onChange={this._inputChangeHandler}
                                    value={this.props.attrObj.getTextFieldValue()}
                                    placeholder={textTypesModel.getTextInputPlaceholder()}
                                    autoComplete="off" />
                                {this._renderAutoComplete()}
                            </td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    }

    // ----------------------------- <RawInputMultiValueContainer /> --------------------------

    const RawInputMultiValueContainer:React.SFC<{
        attrObj:TextTypes.ITextInputAttributeSelection;
        hasExtendedInfo:boolean;
        isLocked:boolean;

    }> = (props) => {

        const handleAutoCompleteHintClick = (item) => { // typeof item = TextTypes.AutoCompleteItem
            dispatcher.dispatch({
                name: 'TT_ATTRIBUTE_AUTO_COMPLETE_HINT_CLICKED',
                payload: {
                    attrName: props.attrObj.name,
                    ident: item.ident,
                    label: item.label,
                    append: true
                }
            });
        };

        const renderCheckboxes = () => {
            const values = props.attrObj.getValues();
            return values.map((item, i) => {
                return (
                    <tr key={item.value + String(i)}>
                        <td>
                            <CheckBoxItem
                                    itemIdx={i}
                                    itemName={props.attrObj.name}
                                    itemValue={item.value}
                                    itemIsSelected={item.selected}
                                    itemIsLocked={item.locked}
                                        />
                        </td>
                        <td>
                            {props.hasExtendedInfo
                                ? <ExtendedInfoButton ident={item.ident} attrName={props.attrObj.name}
                                        numGrouped={item.numGrouped}
                                        containsExtendedInfo={!!item.extendedInfo} />
                                : null }
                        </td>
                    </tr>
                );
            });
        };

        return (
            <div>
                <table>
                    <tbody>
                        {renderCheckboxes()}
                    </tbody>
                </table>
                <RawInputContainer attrObj={props.attrObj}
                                    customInputName={null}
                                    customAutoCompleteHintClickHandler={handleAutoCompleteHintClick} />
            </div>
        );
    };

    // ----------------------------- <ValueSelector /> --------------------------

    const ValueSelector:React.SFC<{
        attrObj:TextTypes.AttributeSelection;
        rangeIsOn:boolean;
        isLocked:boolean;
        hasExtendedInfo:boolean;

    }> = (props) => {
        return (
            <div className="ValueSelector">
            {props.attrObj.containsFullList() || props.rangeIsOn
                ? <FullListContainer attrObj={props.attrObj} rangeIsOn={props.rangeIsOn}
                        hasExtendedInfo={props.hasExtendedInfo} />
                : <RawInputMultiValueContainer
                        attrObj={(props.attrObj as TextTypes.ITextInputAttributeSelection)}
                        isLocked={props.isLocked}
                        hasExtendedInfo={props.hasExtendedInfo} />
            }
            </div>
        );
    };

    // --------------------- <TextTypeAttributeMinIcon /> -----------------

    const TextTypeAttributeMinIcon:React.SFC<TextTypeAttributeMinIconProps> = (props) => {

        return (
            <div className="textTypes_TextTypeAttributeMinIcon">
                <a onClick={props.onClick}>
                    {props.isMinimized ?
                        <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/maximize-icon.svg')}
                            alt="maximize" /> :
                        <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/minimize-icon.svg')}
                        alt="minimize" />
                    }
                </a>
            </div>
        );
    }

    // ----------------------------- <TableTextTypeAttribute /> --------------------------

    class TableTextTypeAttribute extends React.Component<{
        attrObj:TextTypes.AttributeSelection;
        rangeIsOn:boolean;
        isMinimized:boolean;
    },
    {
        metaInfoHelpVisible:boolean;
        hasExtendedInfo:boolean;
        metaInfo:TextTypes.AttrSummary;
    }> {

        constructor(props) {
            super(props);
            this._selectAllHandler = this._selectAllHandler.bind(this);
            this._intervalModeSwitchHandler = this._intervalModeSwitchHandler.bind(this);
            this._metaInfoHelpClickHandler = this._metaInfoHelpClickHandler.bind(this);
            this._helpCloseHandler = this._helpCloseHandler.bind(this);
            this.state = {
                metaInfoHelpVisible: false,
                hasExtendedInfo: textTypesModel.getBibIdAttr() && textTypesModel.getBibLabelAttr() === this.props.attrObj.name,
                metaInfo: textTypesModel.getAttrSummary().get(this.props.attrObj.name)
            };
        }

        _renderModeSwitch() {
            return (
                <select className="select-mode" onChange={this._intervalModeSwitchHandler}
                        value={this.props.rangeIsOn ? 'r' : 'i'}>
                    <option value="i">{he.translate('query__tt_select_individual')}</option>
                    <option value="r">{he.translate('query__tt_select_range')}</option>
                </select>
            );
        }

        _selectAllHandler() {
            dispatcher.dispatch({
                name: 'TT_SELECT_ALL_CHECKBOX_CLICKED',
                payload: {
                    attrName: this.props.attrObj.name
                }
            });
        }

        _intervalModeSwitchHandler() {
            dispatcher.dispatch({
                name: 'TT_TOGGLE_RANGE_MODE',
                payload: {
                    attrName: this.props.attrObj.name
                }
            });
        }

        _renderSelectAll() {
            return <label className="select-all" style={{display: 'inline-block'}}>
                    <input type="checkbox" className="select-all" onClick={this._selectAllHandler} />
                        {he.translate('global__select_all')}
            </label>;
        }

        _renderFooter() {
            if (this.props.attrObj.containsFullList() && !this.props.attrObj.isLocked()) {
                if (this.props.attrObj.isInterval) {
                    if (this.props.rangeIsOn) {
                        return this._renderModeSwitch();

                    } else {
                        return <>
                            {this._renderSelectAll()}
                            {this._renderModeSwitch()}
                        </>;
                    }

                } else {
                    return this._renderSelectAll();
                }

            } else {
                return null;
            }
        }

        _metaInfoHelpClickHandler() {
            const newState = he.cloneState(this.state);
            newState.metaInfoHelpVisible = true;
            this.setState(newState);
        }

        _helpCloseHandler() {
            const newState = he.cloneState(this.state);
            newState.metaInfoHelpVisible = false;
            this.setState(newState);
        }

        _renderMetaInfo() {
            if (this.state.metaInfo) {
                return (
                    <span>
                        {this.state.metaInfo.text}
                        {'\u00A0'}
                        <a className="context-help" onClick={this._metaInfoHelpClickHandler}>
                            <layoutViews.ImgWithMouseover
                                src={he.createStaticUrl('img/question-mark.svg')}
                                htmlClass="over-img"
                                alt="question-mark.svg"
                                title={he.translate('global__alt_hint')} />
                        </a>
                        {this.state.metaInfoHelpVisible
                            ? (<layoutViews.PopupBox onCloseClick={this._helpCloseHandler} status="info"
                                        autoWidth={CoreViews.AutoWidth.NARROW}>
                                {this.state.metaInfo.help}
                                </layoutViews.PopupBox>)
                            : null}
                    </span>
                );

            } else {
                return null;
            }
        }

        shouldComponentUpdate(nextProps, nextState) {
            return this.props.attrObj !== nextProps.attrObj
                    || this.props.rangeIsOn !== nextProps.rangeIsOn
                    || this.state.metaInfoHelpVisible !== nextState.metaInfoHelpVisible
                    || this.props.isMinimized !== nextProps.isMinimized;
        }

        _renderExtendedInfo() {
            const srch = this.props.attrObj.getValues().findEntry(item => !!item.extendedInfo);
            if (srch) {
                const [srchIdx, item] = srch;
                return <ExtendedInfoBox data={item.extendedInfo} ident={item.ident}
                                attrName={this.props.attrObj.name} />;

            } else {
                return null;
            }
        }

        _renderAttrInfo() {
            if (this.props.attrObj.attrInfo.doc) {
                return (
                    <span className="info-link">{'\u00a0'}(
                        <a target="_blank" href={this.props.attrObj.attrInfo.doc}
                                title={he.translate('query__tt_click_to_see_attr_info')}>
                            {this.props.attrObj.attrInfo.docLabel}
                        </a>)
                    </span>
                );
            }
            return null;
        }

        _handleMinimizeIconFn(ident:string):()=>void {
            return () => {
                dispatcher.dispatch({
                    name: 'TT_TOGGLE_MINIMIZE_ITEM',
                    payload: {
                        ident: ident
                    }
                });
            };
        }

        render() {
            const classes = ['TableTextTypeAttribute'];
            if (this.props.attrObj.isLocked()) {
                classes.push('locked');
            }
            return (
                <div className={classes.join(' ')}>
                    <div className="attrib-name">
                        <h3 title={this.props.attrObj.name !== this.props.attrObj.label ? this.props.attrObj.name : null}>
                            {this.props.attrObj.label}
                            {
                            this.props.isMinimized && this.props.attrObj.hasUserChanges() ?
                            <span title={he.translate('query__contains_selected_text_types')}>{'\u00a0\u2713'}</span> :
                            null
                            }
                            {this._renderAttrInfo()}
                        </h3>
                        <TextTypeAttributeMinIcon isMinimized={this.props.isMinimized}
                                onClick={this._handleMinimizeIconFn(this.props.attrObj.name)} />
                    </div>
                    {this.props.isMinimized ?
                        <div></div> :
                        (<>
                            <div>
                                {this._renderExtendedInfo()}
                            </div>
                            <div className={this.props.rangeIsOn ? 'range' : 'data-rows'}>
                                <ValueSelector attrObj={this.props.attrObj}
                                        rangeIsOn={this.props.rangeIsOn}
                                        isLocked={this.props.attrObj.isLocked()}
                                        hasExtendedInfo={this.state.hasExtendedInfo}  />
                            </div>
                            <div className="metadata">
                                {this._renderMetaInfo()}
                            </div>
                            <div className="last-line">
                                {this._renderFooter()}
                            </div>
                        </>)
                    }
                </div>
            );
        }
    }

    // ----------------------------- <TTAttribMinimizeSwitch /> --------------------------

    const TTAttribMinimizeSwitch:React.SFC<{
        hasSomeMaximized:boolean;

    }> = (props) => {

        const handleClick = () => {
            dispatcher.dispatch({
                name: props.hasSomeMaximized ? 'TT_MINIMIZE_ALL' : 'TT_MAXIMIZE_ALL',
                payload: {}
            });
        };

        if (props.hasSomeMaximized) {
            return <a onClick={handleClick}>{he.translate('query__tt_minimize_all_lists')}</a>;

        } else {
            return <a onClick={handleClick}>{he.translate('query__tt_maximize_all_lists')}</a>;
        }
    };

    // ----------------------------- <TextTypesPanel /> --------------------------

    class TextTypesPanel extends React.Component<TextTypesPanelProps, TextTypesPanelState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
            this.state = this._fetchModelState();
        }

        _fetchModelState() {
            return {
                attributes: textTypesModel.getAttributes(),
                rangeModes: textTypesModel.getRangeModes(),
                minimized: textTypesModel.getMiminimizedBoxes(),
                hasSomeMaximizedBoxes: textTypesModel.hasSomeMaximizedBoxes()
            };
        }

        _modelChangeHandler() {
            this.setState(this._fetchModelState());
        }

        componentDidMount() {
            this.modelSubscription = textTypesModel.addListener(this._modelChangeHandler);
            if (typeof this.props.onReady === 'function') {
                this.props.onReady();
            }
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        render() {
            return (
                <div className="TextTypesPanel">
                    <div className="plugin-controls">
                    {this.props.liveAttrsView
                        ? <this.props.liveAttrsView />
                        : null}
                    </div>
                    <div className="text-type-top-bar">
                        <TTAttribMinimizeSwitch hasSomeMaximized={this.state.hasSomeMaximizedBoxes} />
                    </div>
                    <div className="grid">
                        {this.props.liveAttrsCustomTT
                            ? <div><this.props.liveAttrsCustomTT /></div>
                            : null}
                        {this.state.attributes.map((attrObj) => {
                            return <div key={attrObj.name + ':list:' + attrObj.containsFullList()}>
                                <TableTextTypeAttribute
                                        attrObj={attrObj}
                                        rangeIsOn={this.state.rangeModes.get(attrObj.name)}
                                        isMinimized={this.state.minimized.get(attrObj.name)} />
                            </div>;
                        })}
                    </div>
                </div>
            );
        }
    }

    return {
        TextTypesPanel: TextTypesPanel,
        TextTypeAttributeMinIcon: TextTypeAttributeMinIcon
    };

}