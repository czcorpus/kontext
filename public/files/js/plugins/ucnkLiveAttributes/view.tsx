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
import {Kontext, TextTypes} from '../../types/common';
import {LiveAttrsModel, SelectionStep} from './models';
import { PluginInterfaces } from '../../types/plugins';


export interface ViewModuleArgs {
    dispatcher:ActionDispatcher;
    he:Kontext.ComponentHelpers;
    SubcmixerComponent:PluginInterfaces.SubcMixerView;
    textTypesModel:TextTypes.ITextTypesModel;
    liveAttrsModel:LiveAttrsModel;
}

export interface LiveAttrsViewProps {
}

export interface LiveAttrsCustomTTProps {
}

export interface Views {
    LiveAttrsView:React.ComponentClass<LiveAttrsViewProps>;
    LiveAttrsCustomTT:React.ComponentClass<LiveAttrsCustomTTProps>;
}


export function init({dispatcher, he, SubcmixerComponent, textTypesModel, liveAttrsModel}:ViewModuleArgs):Views {

    // ----------------------------- <StepLoader /> --------------------------

    const StepLoader:React.SFC<{
        idx:number;

    }> = (props) => {
        return (
            <div className="step-block">
                <table className="step">
                    <tbody>
                        <tr>
                            <td className="num">{props.idx}</td>
                            <td className="data">
                                <img src={he.createStaticUrl('img/ajax-loader-bar.gif')} alt={he.translate('global__loading')} />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    // ----------------------------- <SelectionSteps /> --------------------------

    const SelectionSteps:React.SFC<{
        items:Array<SelectionStep>;
        isLoading:boolean;

    }> = (props) => {

        const shortenValues = (values, joinChar) => {
            let ans;
            if (values.length > 5) {
                ans = values.slice(0, 2);
                ans.push('\u2026');
                ans = ans.concat(values.slice(values.length - 2, values.length));

            } else {
                ans = values;
            }
            return ans
                .map(item => item.substr(0, 1) !== '@' ? item : item.substr(1))
                .join(joinChar);
        };

        const renderAlignedLangsSel = (item) => {
            return (
                <span>
                {shortenValues(item.languages, ' + ')}
                <br />
                </span>
            );
        };

        const renderTextTypesSel = (item) => {
            if (item.error) {
                return <span>{item.error}</span>;

            } else {
                return item.attributes.map((attr, i) => {
                    return (
                        <span key={i}>
                            {i > 0 ? ', ' : ''}
                            <strong>{attr}</strong>
                                {'\u00a0\u2208\u00a0'}
                                {'{' + shortenValues(item.values.get(attr), ', ') + '}'}
                                <br />
                        </span>
                    );
                });
            }
        };

        return (
            <div className="steps">
            {props.items.map((item, i) => {
                return (
                    <div className="step-block" key={i}>
                        <table className="step">
                            <tbody>
                                <tr>
                                    <td className="num">{item.num}</td>
                                    <td className="data">
                                        {i > 0 ? '\u2026\u00a0&\u00a0' : ''}
                                        {item.num === 1 && item['languages']
                                            ? renderAlignedLangsSel(item)
                                            : renderTextTypesSel(item)
                                        }
                                        {he.translate('ucnkLA__num_positions', {num_pos: item.numPosInfo})}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                );
            })}
            {props.isLoading ? <StepLoader idx={props.items.length + 1} /> : null}
            </div>
        );
    };

    // ----------------------------- <RefineButton /> --------------------------

    const RefineButton:React.SFC<{
        enabled:boolean;
        mkClickHandler:(action:string)=>(evt:React.MouseEvent<{}>)=>void;

    }> = (props) => {

        if (props.enabled) {
            return (
                <a className="util-button" onClick={props.mkClickHandler('refine')}>
                    {he.translate('ucnkLA__refine_selection_btn')}
                </a>
            );

        } else {
            return <a className="util-button disabled">{he.translate('ucnkLA__refine_selection_btn')}</a>
        }
    };

    // ----------------------------- <UndoButton /> --------------------------

    const UndoButton:React.SFC<{
        enabled:boolean;
        mkClickHandler:(action:string)=>(evt:React.MouseEvent<{}>)=>void;

    }> = (props) => {
        if (props.enabled) {
            return (
                <a className="util-button cancel" onClick={props.mkClickHandler('undo')}>
                    {he.translate('ucnkLA__undo_selection_btn')}
                </a>
            );

        } else {
            return <a className="util-button cancel disabled">{he.translate('ucnkLA__undo_selection_btn')}</a>
        }
    }

    // ----------------------------- <ResetButton /> --------------------------

    const ResetButton:React.SFC<{
        enabled:boolean;
        mkClickHandler:(action:string)=>(evt:React.MouseEvent<{}>)=>void;

    }> = (props) => {

        if (props.enabled) {
            return (
                <a className="util-button cancel" onClick={props.mkClickHandler('reset')}>
                    {he.translate('ucnkLA__reset_selection_btn')}
                </a>
            );

        } else {
            return <a className="util-button cancel disabled">{he.translate('ucnkLA__reset_selection_btn')}</a>
        }
    };

    // ----------------------------- <LiveAttrsView /> --------------------------

    class LiveAttrsView extends React.Component<LiveAttrsViewProps, {
        selectionSteps:Array<SelectionStep>;
        alignedCorpora:Immutable.List<TextTypes.AlignedLanguageItem>;
        isLoading:boolean;
        controlsEnabled:boolean;
        canUndoRefine:boolean;
    }> {

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this._changeHandler = this._changeHandler.bind(this);
            this._mkClickHandler = this._mkClickHandler.bind(this);
        }

        _mkClickHandler(action) {
            const actionMap = {
                refine: 'LIVE_ATTRIBUTES_REFINE_CLICKED',
                reset: 'LIVE_ATTRIBUTES_RESET_CLICKED',
                undo: 'LIVE_ATTRIBUTES_UNDO_CLICKED'
            };
            return (evt) => {
                const newState = he.cloneState(this.state);
                newState.isLoading = true;
                this.setState(newState);
                dispatcher.dispatch({
                    actionType: actionMap[action],
                    props: {}
                });
            }
        }

        _fetchModelState() {
            return {
                selectionSteps: liveAttrsModel.getSelectionSteps(),
                alignedCorpora: liveAttrsModel.getAlignedCorpora(),
                isLoading: liveAttrsModel.getIsBusy(),
                controlsEnabled: liveAttrsModel.getControlsEnabled(),
                canUndoRefine: liveAttrsModel.canUndoRefine()
            };
        }

        _changeHandler() {
            this.setState(this._fetchModelState());
        }

        componentDidMount() {
            textTypesModel.addChangeListener(this._changeHandler);
            liveAttrsModel.addChangeListener(this._changeHandler);
        }

        componentWillUnmount() {
            textTypesModel.removeChangeListener(this._changeHandler);
            liveAttrsModel.removeChangeListener(this._changeHandler);
        }

        _widgetIsActive() {
            return this.state.alignedCorpora.size > 0 && this.state.selectionSteps.length > 1
                || this.state.alignedCorpora.size === 0 && this.state.selectionSteps.length > 0;
        }

        render() {
            return (
                <div className="live-attributes">
                    <ul className="controls">
                        <li>
                            <RefineButton enabled={this.state.controlsEnabled} mkClickHandler={this._mkClickHandler} />
                        </li>
                        <li>
                            <UndoButton enabled={this.state.controlsEnabled && this.state.canUndoRefine} mkClickHandler={this._mkClickHandler} />
                        </li>
                        <li>
                            <ResetButton enabled={this.state.controlsEnabled && this.state.canUndoRefine} mkClickHandler={this._mkClickHandler} />
                        </li>
                        {SubcmixerComponent ?
                            (<li>
                                <SubcmixerComponent isActive={this._widgetIsActive()} />
                            </li>)
                        : null}
                    </ul>
                    <SelectionSteps items={this.state.selectionSteps} isLoading={this.state.isLoading} />
                </div>
            );
        }
    }

    // ----------------------------- <AlignedLangItem /> --------------------------

    const AlignedLangItem:React.SFC<{
        itemIdx:number;
        item:TextTypes.AlignedLanguageItem;

    }> = (props) => {

        const clickHandler = () => {
            dispatcher.dispatch({
                actionType: 'LIVE_ATTRIBUTES_ALIGNED_CORP_CHANGED',
                props: {
                    idx: props.itemIdx
                }
            });
        };

        return (
            <label>
                <input type="checkbox" className="aligned-lang" name="aligned_corpora"
                        onChange={clickHandler} checked={props.item.selected}
                        value={props.item.value} disabled={props.item.locked} />
                {'\u00a0'}{props.item.label}
            </label>
        );
    };

    // ----------------------------- <LiveAttrsCustomTT /> --------------------------

    class LiveAttrsCustomTT extends React.Component<LiveAttrsCustomTTProps, {
        hasAvailableAlignedCorpora:boolean;
        alignedCorpora:Immutable.List<TextTypes.AlignedLanguageItem>;
        isLocked:boolean;
        manualAlignCorporaMode:boolean;

    }> {

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this._changeHandler = this._changeHandler.bind(this);
        }

        _fetchModelState() {
            return {
                hasAvailableAlignedCorpora: liveAttrsModel.hasAvailableAlignedCorpora(),
                alignedCorpora: liveAttrsModel.getAlignedCorpora(),
                isLocked: liveAttrsModel.hasLockedAlignedLanguages(),
                manualAlignCorporaMode: liveAttrsModel.isManualAlignCorporaMode()
            };
        }

        _changeHandler() {
            this.setState(this._fetchModelState());
        }

        componentDidMount() {
            liveAttrsModel.addChangeListener(this._changeHandler);
        }

        componentWillUnmount() {
            liveAttrsModel.removeChangeListener(this._changeHandler);
        }

        _renderHint() {
            if (this.state.manualAlignCorporaMode) {
                return he.translate('ucnkLA__subcorp_consider_aligned_corpora_manual');

            } else {
                return he.translate('ucnkLA__subcorp_consider_aligned_corpora_auto');
            }
        }

        render() {
            if (this.state.hasAvailableAlignedCorpora) {
                let classes = ['envelope', 'aligned'];
                if (this.state.isLocked) {
                    classes.push('locked');
                }
                return (
                    <table className={classes.join(' ')}>
                        <tbody>
                            <tr className="attrib-name">
                                <th>
                                    {he.translate('ucnkLA__aligned_corpora')}
                                </th>
                            </tr>
                            <tr>
                                <td className="note">
                                    <p>
                                        {this._renderHint()}
                                    </p>
                                    {this.state.hasAvailableAlignedCorpora && this.state.alignedCorpora.size > 0 ?
                                        null :
                                        <p>{he.translate('ucnkLA__aligned_lang_cannot_be_set_here')}</p>
                                    }
                                </td>
                            </tr>
                            <tr>
                                <td className="data-rows">
                                    <div className="scrollable">
                                        <table>
                                            <tbody>
                                                {this.state.alignedCorpora.map((item, i) => {
                                                    return (
                                                        <tr key={item.value}>
                                                            <td>
                                                                <AlignedLangItem item={item} itemIdx={i} />
                                                            </td>
                                                            <td />
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td className="hidden-values">
                                </td>
                            </tr>
                            <tr className="last-line">
                                <td>{'\u00a0'}</td>
                            </tr>
                        </tbody>
                    </table>
                );

            } else {
                return null;
            }
        }
    }

    return {
        LiveAttrsView: LiveAttrsView,
        LiveAttrsCustomTT: LiveAttrsCustomTT
    };

}