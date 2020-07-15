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
import { Keyboard, List, Dict } from 'cnc-tskit';
import { IActionDispatcher, IModel, BoundWithProps } from 'kombo';

import { PluginInterfaces } from '../types/plugins';
import { Kontext, TextTypes } from '../types/common';
import { ExtendedInfo } from '../models/textTypes/valueSelections';
import { CoreViews } from '../types/coreViews';
import { TextTypesModelState } from '../models/textTypes/main';
import { Actions, ActionName } from '../models/textTypes/actions';


export interface TextTypesPanelProps {
    liveAttrsView:PluginInterfaces.LiveAttributes.View;
    liveAttrsCustomTT:PluginInterfaces.LiveAttributes.CustomAttribute;
    onReady:()=>void;
}



export interface TextTypeAttributeMinIconProps {
    isMinimized:boolean;
    onClick:()=>void;
}


export interface TextTypesViews {
    TextTypesPanel:React.ComponentClass<TextTypesPanelProps>;
    TextTypeAttributeMinIcon:React.SFC<TextTypeAttributeMinIconProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, textTypesModel:IModel<TextTypesModelState>):TextTypesViews {

    const layoutViews = he.getLayoutViews();

    // ----------------------------- <RangeSelector /> --------------------------

    class RangeSelector extends React.Component<{
        attrName:string;
        hasSelectedValues:boolean;
    },
    {
        fromValue:string;
        toValue:string;
        keepCurrent:boolean;
        intervalBehavior:string;
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
                showHelp: false
            };
        }

        _confirmClickHandler() {
            dispatcher.dispatch<Actions.RangeButtonClicked>({
                name: ActionName.RangeButtonClicked,
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
            if (evt.keyCode === Keyboard.Code.ENTER) {
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
                        this.props.hasSelectedValues
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
            dispatcher.dispatch<Actions.ValueCheckboxClicked>({
                name: ActionName.ValueCheckboxClicked,
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
            dispatcher.dispatch<Actions.ExtendedInformationRemoveRequest>({
                name: ActionName.ExtendedInformationRemoveRequest,
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

    class ExtendedInfoButton extends React.PureComponent<{
        attrName:string;
        ident:string;
        containsExtendedInfo:boolean;
        numGrouped:number;
        isBusy:boolean;
    }> {


        constructor(props) {
            super(props);
            this._handleClick = this._handleClick.bind(this);
        }

        _handleClick(evt) {
            dispatcher.dispatch<Actions.ExtendedInformationRequest>({
                name: ActionName.ExtendedInformationRequest,
                payload: {
                    attrName: this.props.attrName,
                    ident: this.props.ident
                }
            });
        }

        render() {
            if (this.props.isBusy) {
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
        hasSelectedItems:boolean;
        rangeIsOn:boolean;
        isBusy:boolean;

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
                                            isBusy={props.isBusy}
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
                    props.rangeIsOn ? <RangeSelector attrName={props.attrObj.name} hasSelectedValues={props.hasSelectedItems} /> :
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
                dispatcher.dispatch<Actions.AttributeAutoCompleteHintClicked>({
                    name: ActionName.AttributeAutoCompleteHintClicked,
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
                    dispatcher.dispatch<Actions.AttributeAutoCompleteReset>({
                        name: ActionName.AttributeAutoCompleteReset,
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
        textInputPlaceholder:string;
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

            dispatcher.dispatch<Actions.AttributeTextInputChanged>({
                name: ActionName.AttributeTextInputChanged,
                payload: {
                    attrName: this.props.attrObj.name,
                    value: v
                }
            });

            if (this.throttlingTimer) {
                window.clearTimeout(this.throttlingTimer);
            }
            this.throttlingTimer = window.setTimeout(() => {
                dispatcher.dispatch<Actions.AttributeTextInputAutocompleteRequest>({
                    name: ActionName.AttributeTextInputAutocompleteRequest,
                    payload: {
                        attrName: this.props.attrObj.name,
                        value: v
                    }
                });
            }, this._throttlingIntervalMs);
        }

        _renderAutoComplete() {
            if (!List.empty(this.props.attrObj.getAutoComplete())) {
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
                                    placeholder={this.props.textInputPlaceholder}
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
        textInputPlaceholder:string;
        isBusy:boolean;

    }> = (props) => {

        const handleAutoCompleteHintClick = (item:TextTypes.AutoCompleteItem) => {
            dispatcher.dispatch<Actions.AttributeAutoCompleteHintClicked>({
                name: ActionName.AttributeAutoCompleteHintClicked,
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
                                        containsExtendedInfo={!!item.extendedInfo}
                                        isBusy={props.isBusy} />
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
                                    customAutoCompleteHintClickHandler={handleAutoCompleteHintClick}
                                    textInputPlaceholder={props.textInputPlaceholder} />
            </div>
        );
    };

    // ----------------------------- <ValueSelector /> --------------------------

    const ValueSelector:React.SFC<{
        attrObj:TextTypes.AttributeSelection;
        rangeIsOn:boolean;
        isLocked:boolean;
        hasExtendedInfo:boolean;
        textInputPlaceholder:string;
        isBusy:boolean;

    }> = (props) => {
        return (
            <div className="ValueSelector">
            {props.attrObj.containsFullList() || props.rangeIsOn
                ? <FullListContainer attrObj={props.attrObj} rangeIsOn={props.rangeIsOn}
                        hasExtendedInfo={props.hasExtendedInfo}
                        isBusy={props.isBusy}
                        hasSelectedItems={props.attrObj.hasUserChanges()} />
                : <RawInputMultiValueContainer
                        attrObj={(props.attrObj as TextTypes.ITextInputAttributeSelection)}
                        isLocked={props.isLocked}
                        hasExtendedInfo={props.hasExtendedInfo}
                        textInputPlaceholder={props.textInputPlaceholder}
                        isBusy={props.isBusy} />
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

    const TableTextTypeAttribute:React.SFC<{
        attrObj:TextTypes.AttributeSelection;
        rangeIsOn:boolean;
        isMinimized:boolean;
        metaInfoHelpVisible:boolean;
        hasExtendedInfo:boolean;
        metaInfo:TextTypes.AttrSummary;
        textInputPlaceholder:string;
        isBusy:boolean;

    }> = (props) => {


        // hasExtendedInfo: textTypesModel.getBibIdAttr() && textTypesModel.getBibLabelAttr() === this.props.attrObj.name,
        //                 metaInfo: textTypesModel.getAttrSummary()[this.props.attrObj.name]

        const renderModeSwitch = () => (
            <select className="select-mode" onChange={intervalModeSwitchHandler}
                    value={props.rangeIsOn ? 'r' : 'i'}>
                <option value="i">{he.translate('query__tt_select_individual')}</option>
                <option value="r">{he.translate('query__tt_select_range')}</option>
            </select>
        );

        const selectAllHandler = () => {
            dispatcher.dispatch<Actions.SelectAllClicked>({
                name: ActionName.SelectAllClicked,
                payload: {
                    attrName: props.attrObj.name
                }
            });
        };

        const intervalModeSwitchHandler = () => {
            dispatcher.dispatch<Actions.ToggleRangeMode>({
                name: ActionName.ToggleRangeMode,
                payload: {
                    attrName: props.attrObj.name
                }
            });
        };

        const renderSelectAll = () => (
            <label className="select-all" style={{display: 'inline-block'}}>
                    <input type="checkbox" className="select-all" onClick={selectAllHandler} />
                        {he.translate('global__select_all')}
            </label>
        );

        const renderFooter = () => {
            if (props.attrObj.containsFullList() && !props.attrObj.isLocked()) {
                if (props.attrObj.isInterval) {
                    if (props.rangeIsOn) {
                        return renderModeSwitch();

                    } else {
                        return <>
                            {renderSelectAll()}
                            {renderModeSwitch()}
                        </>;
                    }

                } else {
                    return renderSelectAll();
                }

            } else {
                return null;
            }
        }

        const metaInfoHelpClickHandler = () => {
            dispatcher.dispatch<Actions.ToggleMetaInfoView>({
                name: ActionName.ToggleMetaInfoView
            });
        }

        const helpCloseHandler = () => {
            dispatcher.dispatch<Actions.ToggleMetaInfoView>({
                name: ActionName.ToggleMetaInfoView
            });
        }

        const renderMetaInfo = () => {
            if (props.metaInfo) {
                return (
                    <span>
                        {props.metaInfo.text}
                        {'\u00A0'}
                        <a className="context-help" onClick={metaInfoHelpClickHandler}>
                            <layoutViews.ImgWithMouseover
                                src={he.createStaticUrl('img/question-mark.svg')}
                                htmlClass="over-img"
                                alt="question-mark.svg"
                                title={he.translate('global__alt_hint')} />
                        </a>
                        {props.metaInfoHelpVisible
                            ? (<layoutViews.PopupBox onCloseClick={helpCloseHandler} status="info"
                                        autoWidth={CoreViews.AutoWidth.NARROW}>
                                {props.metaInfo.help}
                                </layoutViews.PopupBox>)
                            : null}
                    </span>
                );

            } else {
                return null;
            }
        };

        const renderExtendedInfo = () => {
            const srch = List.find(item => !!item.extendedInfo, props.attrObj.getValues());
            if (srch) {
                return <ExtendedInfoBox data={srch.extendedInfo} ident={srch.ident}
                                attrName={props.attrObj.name} />;

            } else {
                return null;
            }
        }

        const renderAttrInfo = () => {
            if (props.attrObj.attrInfo.doc) {
                return (
                    <span className="info-link">{'\u00a0'}(
                        <a target="_blank" href={props.attrObj.attrInfo.doc}
                                title={he.translate('query__tt_click_to_see_attr_info')}>
                            {props.attrObj.attrInfo.docLabel}
                        </a>)
                    </span>
                );
            }
            return null;
        }

        const handleMinimizeIconFn = (ident:string):()=>void => {
            return () => {
                dispatcher.dispatch<Actions.ToggleMinimizeItem>({
                    name: ActionName.ToggleMinimizeItem,
                    payload: {
                        ident: ident
                    }
                });
            };
        };


        const classes = ['TableTextTypeAttribute'];
        if (props.attrObj.isLocked()) {
            classes.push('locked');
        }
        return (
            <div className={classes.join(' ')}>
                <div className="attrib-name">
                    <h3 title={props.attrObj.name !== props.attrObj.label ? props.attrObj.name : null}>
                        {props.attrObj.label}
                        {
                        props.isMinimized && props.attrObj.hasUserChanges() ?
                        <span title={he.translate('query__contains_selected_text_types')}>{'\u00a0\u2713'}</span> :
                        null
                        }
                        {renderAttrInfo()}
                    </h3>
                    <TextTypeAttributeMinIcon isMinimized={props.isMinimized}
                            onClick={handleMinimizeIconFn(props.attrObj.name)} />
                </div>
                {props.isMinimized ?
                    <div></div> :
                    (<>
                        <div>
                            {renderExtendedInfo()}
                        </div>
                        <div className={props.rangeIsOn ? 'range' : 'data-rows'}>
                            <ValueSelector attrObj={props.attrObj}
                                    rangeIsOn={props.rangeIsOn}
                                    isLocked={props.attrObj.isLocked()}
                                    hasExtendedInfo={props.hasExtendedInfo}
                                    textInputPlaceholder={props.textInputPlaceholder}
                                    isBusy={props.isBusy}  />
                        </div>
                        <div className="metadata">
                            {renderMetaInfo()}
                        </div>
                        <div className="last-line">
                            {renderFooter()}
                        </div>
                    </>)
                }
            </div>
        );
    }

    // ----------------------------- <TTAttribMinimizeSwitch /> --------------------------

    const TTAttribMinimizeSwitch:React.SFC<{
        hasSomeMaximized:boolean;

    }> = (props) => {

        const handleClick = () => {
            if (props.hasSomeMaximized) {
                dispatcher.dispatch<Actions.MinimizeAll>({
                    name: ActionName.MinimizeAll
                });

            } else {
                dispatcher.dispatch<Actions.MaximizeAll>({
                    name: ActionName.MaximizeAll
                });
            }
        };

        if (props.hasSomeMaximized) {
            return <a onClick={handleClick}>{he.translate('query__tt_minimize_all_lists')}</a>;

        } else {
            return <a onClick={handleClick}>{he.translate('query__tt_maximize_all_lists')}</a>;
        }
    };

    // ----------------------------- <TextTypesPanel /> --------------------------

    class TextTypesPanel extends React.PureComponent<TextTypesPanelProps & TextTypesModelState> {

        componentDidMount() {
            if (typeof this.props.onReady === 'function') {
                this.props.onReady();
            }
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
                        <TTAttribMinimizeSwitch hasSomeMaximized={Dict.hasValue(false, this.props.minimizedBoxes)} />
                    </div>
                    <div className="grid">
                        {this.props.liveAttrsCustomTT
                            ? <div><this.props.liveAttrsCustomTT /></div>
                            : null}
                        {List.map((attrObj) => {
                            return <div key={attrObj.name + ':list:' + attrObj.containsFullList()}>
                                <TableTextTypeAttribute
                                        attrObj={attrObj}
                                        rangeIsOn={this.props.rangeModeStatus[attrObj.name]}
                                        isMinimized={this.props.minimizedBoxes[attrObj.name]}
                                        metaInfoHelpVisible={this.props.metaInfoHelpVisible}
                                        hasExtendedInfo={this.props.bibIdAttr === attrObj.name}
                                        metaInfo={this.props.metaInfo[attrObj.name]}
                                        isBusy={this.props.isBusy}
                                        textInputPlaceholder={this.props.textInputPlaceholder} />
                            </div>;
                            },
                            this.props.attributes
                        )}
                    </div>
                </div>
            );
        }
    }

    return {
        TextTypesPanel: BoundWithProps<TextTypesPanelProps, TextTypesModelState>(TextTypesPanel, textTypesModel),
        TextTypeAttributeMinIcon: TextTypeAttributeMinIcon
    };

}