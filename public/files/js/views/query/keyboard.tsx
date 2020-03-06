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
import {Kontext} from '../../types/common';
import {IActionDispatcher} from 'kombo';
import {QueryFormModel, AppendQueryInputAction} from '../../models/query/common';
import { VirtualKeyboardModel } from '../../models/query/virtualKeyboard';
import { Subscription } from 'rxjs';


export interface KeyboardProps {
    actionPrefix:string;
    sourceId:string;
    inputLanguage:string;
}


export interface KeyboardState {
    shiftOn:boolean;
    capsOn:boolean;
    layout:Kontext.VirtualKeyboardLayout;
    layoutNames:Kontext.ListOfPairs;
    currentLayoutIdx:number;
    triggeredKey:[number, number];
}


export interface KeyboardViews {
    Keyboard:React.ComponentClass<KeyboardProps>;
}

export interface KeyboardModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    queryModel:QueryFormModel;
    virtualKeyboardModel:VirtualKeyboardModel
}

export function init({dispatcher, he, virtualKeyboardModel}:KeyboardModuleArgs):KeyboardViews {

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

    const DummyKey:React.SFC<{
        value:string;

    }> = (props) => {
        return <span className="dummy">{props.value}</span>;
    };

    // -------------------- <ShiftKey /> ----------------------------

    const ShiftKey:React.SFC<{
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

    // -------------------- <KeysRow /> ----------------------------

    const KeysRow:React.SFC<{
        shiftOn:boolean;
        capsOn:boolean;
        passTriggerIdx:number;
        data:Kontext.ListOfPairs;
        handleShift:()=>void;
        handleCaps:()=>void;
        handleBackspace:()=>void;
        handleClick:(v:string)=>void;

    }> = (props) => {

        const selectValue = (v) => {
            if (props.shiftOn || props.capsOn) {
                return v[1];

            } else {
                return v[0];
            }
        };

        const selectKeyType = (item, i) => {
            if (/^[A-Z][a-z]{2,}$/.exec(item[0])) {
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
            {props.data.map(selectKeyType)}
            </div>
        );
    };

    // -------------------- <Keyboard /> ----------------------------

    class Keyboard extends React.Component<KeyboardProps, KeyboardState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this._handleClick = this._handleClick.bind(this);
            this._handleShift = this._handleShift.bind(this);
            this._handleCaps = this._handleCaps.bind(this);
            this._handleBackspace = this._handleBackspace.bind(this);
            this._handleLayoutChange = this._handleLayoutChange.bind(this);
            this._modelChangeListener = this._modelChangeListener.bind(this);
            this.state = {
                shiftOn: false,
                capsOn: false,
                layout: null,
                currentLayoutIdx: null,
                triggeredKey: null,
                layoutNames: null
            };
        }

        _handleClick(v) {
            dispatcher.dispatch<AppendQueryInputAction>({
                name: this.props.actionPrefix + 'QUERY_INPUT_APPEND_QUERY',
                payload: {
                    sourceId: this.props.sourceId,
                    query: v,
                    prependSpace: false,
                    closeWhenDone: false,
                    triggeredKey: this.state.triggeredKey
                }
            });
            const newState = he.cloneState(this.state);
            newState.shiftOn = false;
            this.setState(newState);
        }

        _handleShift() {
            const newState = he.cloneState(this.state);
            newState.shiftOn = !this.state.shiftOn;
            newState.capsOn = false;
            this.setState(newState);
        }

        _handleCaps() {
            const newState = he.cloneState(this.state);
            newState.shiftOn = false;
            newState.capsOn = !this.state.capsOn;
            this.setState(newState);
        }

        _handleBackspace() {
            dispatcher.dispatch({
                name: this.props.actionPrefix + 'QUERY_INPUT_REMOVE_LAST_CHAR',
                payload: {
                    sourceId: this.props.sourceId
                }
            });
            const newState = he.cloneState(this.state);
            newState.shiftOn = false;
            this.setState(newState);
        }

        _handleLayoutChange(evt) {
            dispatcher.dispatch({
                name: 'QUERY_INPUT_SET_VIRTUAL_KEYBOARD_LAYOUT',
                payload: {idx: evt.target.value}
            });
        }

        _modelChangeListener() {
            this.setState({
                shiftOn: this.state.shiftOn,
                capsOn: this.state.capsOn,
                layout: virtualKeyboardModel.getCurrentLayout(),
                layoutNames: virtualKeyboardModel.getLayoutNames(),
                currentLayoutIdx: virtualKeyboardModel.getCurrentLayoutIdx(),
                triggeredKey: virtualKeyboardModel.getActiveKey()
            });
        }

        componentDidMount() {
            this.modelSubscription = virtualKeyboardModel.addListener(this._modelChangeListener);
            dispatcher.dispatch({
                name: 'QUERY_INPUT_LOAD_VIRTUAL_KEYBOARD_LAYOUTS',
                payload: {
                    inputLanguage: this.props.inputLanguage
                }
            });
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        _renderContents() {
            return (
                <div>
                    <div className="layout-selection">
                        <h3>{he.translate('query__kb_layout')}:</h3>
                        <select onChange={this._handleLayoutChange} value={this.state.currentLayoutIdx}>
                        {this.state.layoutNames.map((item, i) => {
                            return <option key={i} value={i} title={item[1]}>{item[0]}</option>;
                        })}
                        </select>
                    </div>
                    {this.state.layout.keys.map((item, i) => {
                        const passTriggerIdx =  i === this.state.triggeredKey[0] ? this.state.triggeredKey[1] : null;
                        return <KeysRow key={`row${i}`}
                                    data={item}
                                    handleClick={this._handleClick}
                                    shiftOn={this.state.shiftOn}
                                    handleShift={this._handleShift}
                                    capsOn={this.state.capsOn}
                                    handleCaps={this._handleCaps}
                                    handleBackspace={this._handleBackspace}
                                    passTriggerIdx={passTriggerIdx} />;
                    })}
                </div>
            );
        }

        render() {
            return (
                <div className="virtual-keyboard-buttons">
                    {this.state.layout && this.state.layoutNames ?
                        this._renderContents()
                        : <img src={he.createStaticUrl('img/ajax-loader.gif')} alt={he.translate('global__loading')} />
                    }
                </div>
            );
        }
    }

    return {
        Keyboard: Keyboard
    };
}