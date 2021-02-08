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
import { List } from 'cnc-tskit';
import {IActionDispatcher, BoundWithProps} from 'kombo';
import { Kontext } from '../../../types/common';
import {QueryFormModel, QueryFormModelState} from '../../../models/query/common';
import { VirtualKeyboardModel, VirtualKeyboardState } from '../../../models/query/virtualKeyboard';
import { ActionName, Actions, QueryFormType } from '../../../models/query/actions';
import * as S from './style';


export interface VirtualKeyboardProps {
    formType:QueryFormType;
    sourceId:string;
    inputLanguage:string;
}


export interface VirtualKeyboardViews {
    VirtualKeyboard:React.ComponentClass<VirtualKeyboardProps>;
}

export interface VirtualKeyboardModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    queryModel:QueryFormModel<QueryFormModelState>;
    virtualKeyboardModel:VirtualKeyboardModel;
}

export function init({dispatcher, he, virtualKeyboardModel}:VirtualKeyboardModuleArgs):VirtualKeyboardViews {

    // -------------------- <Key /> ----------------------------

    class Key extends React.PureComponent<{
        value:string;
        triggered:boolean;
        handleClick:(v:string)=>void;

    }> {

        constructor(props) {
            super(props);
            this._handleClick = this._handleClick.bind(this);
        }

        _handleClick() {
            this.props.handleClick(this.props.value);
        }

        componentDidUpdate(prevProps, prevState) {
            if (!prevProps.triggered && this.props.triggered) {
                this._handleClick();
            }
        }

        render() {
            const htmlClass = this.props.triggered ? 'active' : null;
            return <button type="button" onClick={this._handleClick} className={htmlClass}>{this.props.value}</button>;
        }
    }

    // -------------------- <DummyKey /> ----------------------------

    const DummyKey:React.FC<{
        value:string;

    }> = (props) => {
        return <span className="dummy">{props.value}</span>;
    };

    // -------------------- <ShiftKey /> ----------------------------

    const ShiftKey:React.FC<{
        shiftOn:boolean;
        handleShift:()=>void;

    }> = (props) => {
        const classes = ['spec'];
        if (props.shiftOn) {
            classes.push('active');
        }
        return (
            <button type="button" className={classes.join(' ')} onClick={props.handleShift}>
                {'\u21E7'}
            </button>
        );
    };

    // -------------------- <CapsKey /> ----------------------------

    class CapsKey extends React.PureComponent<{
        triggered:boolean;
        capsOn:boolean;
        handleCaps:()=>void;
    }> {

        componentDidUpdate(prevProps, prevState) {
            if (!prevProps.triggered && this.props.triggered) {
                this.props.handleCaps();
            }
        }

        render() {
            const classes = ['spec', 'caps'];
            if (this.props.capsOn) {
                classes.push('active');
            }
            return (
                <button type="button" className={classes.join(' ')} onClick={this.props.handleCaps}>
                    Caps
                </button>
            );
        }

    }

    // -------------------- <SpaceKey /> ----------------------------

    class SpaceKey extends React.PureComponent<{
        value:string;
        triggered:boolean;
        handleClick:(v:string)=>void;

    }> {

        constructor(props) {
            super(props);
            this._handleClick = this._handleClick.bind(this);
        }

        componentDidUpdate(prevProps, prevState) {
            if (!prevProps.triggered && this.props.triggered) {
                this.props.handleClick(this.props.value);
            }
        }

        _handleClick() {
            this.props.handleClick(this.props.value);
        }

        render() {
           const htmlClasses = ['space', 'spec'];
            if (this.props.triggered) {
                htmlClasses.push('active');
            }
            return (
                <button type="button" className={htmlClasses.join(' ')} onClick={this._handleClick}>
                    Space
                </button>
            );
        }
    }

    // -------------------- <BackspaceKey /> ----------------------------

    class BackspaceKey extends React.PureComponent<{
        triggered:boolean;
        handleBackspace:()=>void;

    }> {

        componentDidUpdate(prevProps, prevState) {
            if (!prevProps.triggered && this.props.triggered) {
                this.props.handleBackspace();
            }
        }

        render() {
            const htmlClasses = ['backspace', 'spec'];
            if (this.props.triggered) {
                htmlClasses.push('active');
            }
            return (
                <button type="button" className={htmlClasses.join(' ')} onClick={this.props.handleBackspace}>
                    Bksp
                </button>
            );
        }
    }

    // -------------------- <AltGrKey /> ----------------------------

    class AltGrKey extends React.PureComponent<{
        triggered:boolean;
        handleAltGr:()=>void;

    }> {

        componentDidUpdate(prevProps, prevState) {
            if (!prevProps.triggered && this.props.triggered) {
                this.props.handleAltGr();
            }
        }

        render() {
            const htmlClasses = ['altgr', 'spec'];
            if (this.props.triggered) {
                htmlClasses.push('active');
            }
            return (
                <button type="button" className={htmlClasses.join(' ')} onClick={this.props.handleAltGr}>
                    AltGr
                </button>
            );
        }
    }

    // -------------------- <KeysRow /> ----------------------------

    const KeysRow:React.FC<{
        shiftOn:boolean;
        capsOn:boolean;
        passTriggerIdx:number;
        activeDeadKeyIdx:number|null;
        data:Kontext.ListOfPairs;
        handleShift:()=>void;
        handleCaps:()=>void;
        handleBackspace:()=>void;
        handleAltGr:()=>void;
        handleClick:(v:string)=>void;

    }> = (props) => {

        const selectValue = (v) => {
            if (props.shiftOn || props.capsOn) {
                if (props.activeDeadKeyIdx !== null && v[4 + props.activeDeadKeyIdx] !== null && v[4 + props.activeDeadKeyIdx] !== undefined) {
                    return v[4 + props.activeDeadKeyIdx].toUpperCase();
                }

                return v[1];

            } else {
                if (props.activeDeadKeyIdx !== null && v[4 + props.activeDeadKeyIdx] !== null && v[4 + props.activeDeadKeyIdx] !== undefined) {
                    return v[4 + props.activeDeadKeyIdx];
                }

                return v[0];
            }
        };

        const selectKeyType = (item:Array<string>, i:number) => {
            if (/^([A-Z][a-z]+)*$/.exec(item[0])) {
                switch (item[0]) {
                    case 'Shift':
                        return <ShiftKey
                                    key={`${item[0]}-${i}`}
                                    handleShift={props.handleShift}
                                    shiftOn={props.shiftOn} />;

                    case 'Caps':
                        return <CapsKey key={`${item[0]}-${i}`}
                                    handleCaps={props.handleCaps}
                                    capsOn={props.capsOn}
                                    triggered={i === props.passTriggerIdx} />;

                    case 'Bksp':
                        return <BackspaceKey key={`${item[0]}-${i}`}
                                    handleBackspace={props.handleBackspace}
                                    triggered={i === props.passTriggerIdx} />;
                    case 'AltGr':
                        return <AltGrKey key={`${item[0]}-${i}`}
                                    handleAltGr={props.handleAltGr}
                                    triggered={i === props.passTriggerIdx} />;
                    default:
                        return <DummyKey
                                    key={`${item[0]}-${i}`}
                                    value={selectValue(item)} />;
                }

            } else if (item[0] === ' ') {
                return <SpaceKey key="space-k" triggered={i === props.passTriggerIdx} value=" "
                                handleClick={props.handleClick} />;

            } else {
                return <Key
                            key={item[0]}
                            value={selectValue(item)}
                            handleClick={props.handleClick}
                            triggered={i === props.passTriggerIdx} />;
            }
        };

        return (
            <div className="key-row">
                {List.map(selectKeyType, props.data)}
            </div>
        );
    };

    // -------------------- <Keyboard /> ----------------------------

    class VirtualKeyboard extends React.Component<VirtualKeyboardProps & VirtualKeyboardState, {}> {

        constructor(props) {
            super(props);
            this._handleClick = this._handleClick.bind(this);
            this._handleShift = this._handleShift.bind(this);
            this._handleCaps = this._handleCaps.bind(this);
            this._handleBackspace = this._handleBackspace.bind(this);
            this._handleLayoutChange = this._handleLayoutChange.bind(this);
            this._handleAltGr = this._handleAltGr.bind(this);
        }

        _handleClick(chunk:string) {
            const deadKeys = this.getCurrentLayout().deadKeys;
            let deadKeyIndex;
            if (deadKeys) {
                deadKeyIndex = List.findIndex(v => v === chunk, deadKeys);
            }

            if (deadKeys && deadKeyIndex >= 0 && this.props.activeDeadKeyIndex !== deadKeyIndex) {
                dispatcher.dispatch<Actions.QueryInputHitVirtualKeyboardDeadKey>({
                    name: ActionName.QueryInputHitVirtualKeyboardDeadKey,
                    payload: {
                        deadKeyIndex: deadKeyIndex,
                    }
                });

            } else {
                dispatcher.dispatch<Actions.QueryInputHitVirtualKeyboardDeadKey>({
                    name: ActionName.QueryInputHitVirtualKeyboardDeadKey,
                    payload: {
                        deadKeyIndex: null,
                    }
                });

                dispatcher.dispatch<Actions.QueryInputInsertAtCursor>({
                    name: ActionName.QueryInputInsertAtCursor,
                    payload: {
                        formType: this.props.formType,
                        sourceId: this.props.sourceId,
                        chunk
                    }
                });
            }

            dispatcher.dispatch<Actions.QueryInputUnhitVirtualKeyboardShift>({
                name: ActionName.QueryInputUnhitVirtualKeyboardShift
            });
        }

        _handleShift() {
            dispatcher.dispatch<Actions.QueryInputToggleVirtualKeyboardShift>({
                name: ActionName.QueryInputToggleVirtualKeyboardShift
            });
        }

        _handleCaps() {
            dispatcher.dispatch<Actions.QueryInputToggleVirtualKeyboardCaps>({
                name: ActionName.QueryInputToggleVirtualKeyboardCaps
            });
        }

        _handleBackspace() {
            dispatcher.dispatch<Actions.QueryInputRemoveLastChar>({
                name: ActionName.QueryInputRemoveLastChar,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId
                }
            });

            dispatcher.dispatch<Actions.QueryInputUnhitVirtualKeyboardShift>({
                name: ActionName.QueryInputUnhitVirtualKeyboardShift
            });
        }

        _handleLayoutChange(evt) {
            dispatcher.dispatch<Actions.QueryInputSetVirtualKeyboardLayout>({
                name: ActionName.QueryInputSetVirtualKeyboardLayout,
                payload: {idx: evt.target.value}
            });
        }

        _handleAltGr() {
            dispatcher.dispatch<Actions.QueryInputToggleVirtualKeyboardAltGr>({
                name: ActionName.QueryInputToggleVirtualKeyboardAltGr
            });
        }

        getCurrentLayoutIdx():number {
            return this.props.currentLayoutIdx > 0 ? this.props.currentLayoutIdx : 0;
        }

        getCurrentLayout():Kontext.VirtualKeyboardLayout {
            return this.props.layouts[this.getCurrentLayoutIdx()];
        }

        _renderContents() {
            return (
                <div>
                    <div className="layout-selection">
                        <h3>{he.translate('query__kb_layout')}:</h3>
                        <select onChange={this._handleLayoutChange} value={this.props.currentLayoutIdx > 0 ? this.props.currentLayoutIdx : 0}>
                        {List.map((item, i) => {
                            return <option key={i} value={i} title={item.label}>{item.name}</option>;
                        }, this.props.layouts)}
                        </select>
                    </div>
                    {List.map((item, i) => {
                        const passTriggerIdx = this.props.activeKey && i === this.props.activeKey[0] ? this.props.activeKey[1] : null;
                        return <KeysRow key={`row${i}`}
                                    data={item}
                                    handleClick={this._handleClick}
                                    shiftOn={this.props.shiftOn}
                                    handleShift={this._handleShift}
                                    capsOn={this.props.capsOn}
                                    handleCaps={this._handleCaps}
                                    handleAltGr={this._handleAltGr}
                                    handleBackspace={this._handleBackspace}
                                    passTriggerIdx={passTriggerIdx}
                                    activeDeadKeyIdx={this.props.activeDeadKeyIndex} />;
                    }, this.getCurrentLayout().keys)}
                </div>
            );
        }

        render() {
            return (
                <S.VirtualKeyboard>
                    {this._renderContents()}
                </S.VirtualKeyboard>
            );
        }
    }

    return {
        VirtualKeyboard: BoundWithProps<VirtualKeyboardProps, VirtualKeyboardState>(
            VirtualKeyboard, virtualKeyboardModel)
    };
}