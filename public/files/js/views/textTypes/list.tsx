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
import { Keyboard, List } from 'cnc-tskit';
import { IActionDispatcher } from 'kombo';

import { Kontext, TextTypes } from '../../types/common';
import { CoreViews } from '../../types/coreViews';
import { Actions, ActionName } from '../../models/textTypes/actions';
import { WidgetView } from '../../models/textTypes/common';
import { init as commonViewInit } from './common';

import * as S from './style';

export interface FullListContainerProps {
    attrObj:TextTypes.FullAttributeSelection;
    hasExtendedInfo:boolean;
    hasSelectedItems:boolean;
    widget:{widget:WidgetView; active:boolean};
    isBusy:boolean;
}

export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers):React.FC<FullListContainerProps> {

    const layoutViews = he.getLayoutViews();
    const commonViews = commonViewInit(dispatcher, he);

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
            if (evt.key === Keyboard.Value.ENTER) {
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

    // ----------------------------- <FullListContainer /> --------------------------

    const FullListContainer:React.FC<FullListContainerProps> = (props) => {

        const renderRangeSelector = () => {
            switch (props.widget.widget) {
                case 'years':
                    return <RangeSelector attrName={props.attrObj.name} hasSelectedValues={props.hasSelectedItems} />
                default:
                    return <div>Unknown widget: {props.widget.widget}</div>
            }
        }

        const renderListOfCheckBoxes = () => {
            return (
                <S.FullListContainer>
                    <tbody>
                    {List.map(
                        (item, i) => (
                            <tr key={item.value + String(i)}>
                                <td><commonViews.CheckBoxItem
                                        itemIdx={i}
                                        itemName={props.attrObj.name}
                                        itemValue={item.value}
                                        itemIsSelected={item.selected}
                                        itemIsLocked={item.locked}
                                            /></td>
                                <td className="num">{item.availItems ? he.formatNumber(item.availItems) : ''}</td>
                                <td className="extended-info">
                                {props.hasExtendedInfo ?
                                    <commonViews.ExtendedInfoButton ident={item.ident} attrName={props.attrObj.name}
                                            isBusy={props.isBusy}
                                            numGrouped={item.numGrouped} containsExtendedInfo={!!item.extendedInfo} />
                                    : null
                                }
                                </td>
                            </tr>
                        ),
                        props.attrObj.values
                    )}
                    </tbody>
                </S.FullListContainer>
            );
        };

        return (
            <div>
                {
                    props.widget.active ?
                        renderRangeSelector() :
                        renderListOfCheckBoxes()
                }
            </div>
        );
    };



    return FullListContainer;

}