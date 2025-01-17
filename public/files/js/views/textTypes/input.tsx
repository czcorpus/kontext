/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
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
import { List } from 'cnc-tskit';
import { IActionDispatcher } from 'kombo';

import * as Kontext from '../../types/kontext.js';
import * as TextTypes from '../../types/textTypes.js';
import { TTSelOps } from '../../models/textTypes/selectionOps.js';
import { Actions } from '../../models/textTypes/actions.js';
import { init as commonViewInit } from './common.js';

import * as S from './style.js';

export interface RawInputMultiValueContainerProps {
    attrObj:TextTypes.TextInputAttributeSelection;
    hasExtendedInfo:boolean;
    isLocked:boolean;
    textInputPlaceholder:string;
    isBusy:boolean;
    isAutoCompleteActive:boolean;
    isNegativeSelection:boolean;

}

export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers):React.FC<RawInputMultiValueContainerProps> {

    const commonViews = commonViewInit(dispatcher, he);

    // ----------------------------- <AutoCompleteBox /> --------------------------

    class AutoCompleteBox extends React.Component<{
        attrObj:TextTypes.TextInputAttributeSelection;
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
                dispatcher.dispatch<typeof Actions.AttributeAutoCompleteHintClicked>({
                    name: Actions.AttributeAutoCompleteHintClicked.name,
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
                    dispatcher.dispatch<typeof Actions.AttributeAutoCompleteReset>({
                        name: Actions.AttributeAutoCompleteReset.name,
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
            const data = TTSelOps.getAutoComplete(this.props.attrObj);
            return (
                <>
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
                    {this.props.attrObj.autocompleteCutoff > 0 ?
                        <p>
                            {he.translate(
                                'query__tt_too_many_autocomplete_items_{num_items}',
                                {num_items: this.props.attrObj.autocompleteCutoff})}
                        </p> :
                        null
                    }
                </>
            );
        }
    }

    // ----------------------------- <RawInputContainer /> --------------------------

    class RawInputContainer extends React.PureComponent<{
        attrObj:TextTypes.TextInputAttributeSelection;
        customInputName:string;
        textInputPlaceholder:string;
        isAutoCompleteActive:boolean;
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

            dispatcher.dispatch<typeof Actions.AttributeTextInputChanged>({
                name: Actions.AttributeTextInputChanged.name,
                payload: {
                    attrName: this.props.attrObj.name,
                    type: this.props.attrObj.type,
                    value: v
                }
            });

            if (this.throttlingTimer) {
                window.clearTimeout(this.throttlingTimer);
            }
            if (this.props.isAutoCompleteActive) {
                this.throttlingTimer = window.setTimeout(() => {
                    dispatcher.dispatch<typeof Actions.AttributeTextInputAutocompleteRequest>({
                        name: Actions.AttributeTextInputAutocompleteRequest.name,
                        payload: {
                            attrName: this.props.attrObj.name,
                            value: v
                        }
                    });
                }, this._throttlingIntervalMs);
            }
        }

        _renderAutoComplete() {
            if (!List.empty(TTSelOps.getAutoComplete(this.props.attrObj))) {
                return <AutoCompleteBox attrObj={this.props.attrObj}
                                customAutoCompleteHintClickHandler={this.props.customAutoCompleteHintClickHandler} />;

            } else {
                return null;
            }
        }

        render() {
            return (
                <S.RawInputContainer>
                    <tbody>
                        <tr>
                            <td>
                                <input type="text"
                                    onChange={this._inputChangeHandler}
                                    value={TTSelOps.getTextFieldValue(this.props.attrObj)}
                                    placeholder={this.props.textInputPlaceholder}
                                    autoComplete="off" />
                                {this._renderAutoComplete()}
                            </td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tbody>
                </S.RawInputContainer>
            );
        }
    }

    // ----------------------------- <RawInputMultiValueContainer /> --------------------------

    const RawInputMultiValueContainer:React.FC<RawInputMultiValueContainerProps> = (props) => {

        const handleAutoCompleteHintClick = (item:TextTypes.AutoCompleteItem) => {
            dispatcher.dispatch<typeof Actions.AttributeAutoCompleteHintClicked>({
                name: Actions.AttributeAutoCompleteHintClicked.name,
                payload: {
                    attrName: props.attrObj.name,
                    ident: item.ident,
                    label: item.label,
                    append: true
                }
            });
        };

        const renderCheckboxes = () => {
            return List.map(
                (item, i) => (
                    <tr key={item.value + String(i)}>
                        <td>
                            <commonViews.CheckBoxItem
                                    itemIdx={i}
                                    itemName={props.attrObj.name}
                                    itemValue={item.value}
                                    itemIsSelected={item.selected}
                                    itemIsLocked={item.locked}
                                    isNegativeSelection={props.isNegativeSelection}
                                        />
                        </td>
                        <td>
                            {props.hasExtendedInfo
                                ? <commonViews.ExtendedInfoButton ident={item.ident}
                                        attrName={props.attrObj.name}
                                        numGrouped={item.numGrouped}
                                        containsExtendedInfo={!!item.extendedInfo}
                                        isBusy={props.isBusy} />
                                : null }
                        </td>
                    </tr>
                ),
                props.attrObj.values
            );
        };

        const sectionLocked = !List.empty(props.attrObj.values) && List.every(v => v.locked, props.attrObj.values);
        return (
            <S.RawInputMultiValueContainer>
                <S.FullListContainer width="100%">
                    <tbody>
                        {renderCheckboxes()}
                    </tbody>
                </S.FullListContainer>
                { sectionLocked ? null :
                    <RawInputContainer attrObj={props.attrObj}
                            customInputName={null}
                            customAutoCompleteHintClickHandler={handleAutoCompleteHintClick}
                            textInputPlaceholder={props.textInputPlaceholder}
                            isAutoCompleteActive={props.isAutoCompleteActive} />
                }
            </S.RawInputMultiValueContainer>
        );
    };

    return RawInputMultiValueContainer;

}