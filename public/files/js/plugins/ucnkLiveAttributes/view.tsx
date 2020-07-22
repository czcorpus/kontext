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
import { IActionDispatcher, Bound, IModel } from 'kombo';
import { List } from 'cnc-tskit';

import { Kontext, TextTypes } from '../../types/common';
import { LiveAttrsModel, LiveAttrsModelState, TTSelectionStep,
    AlignedLangSelectionStep, isAlignedSelectionStep } from './models';
import { PluginInterfaces } from '../../types/plugins';
import { init as ttViewInit } from '../../views/textTypes';
import { TextTypesModelState } from '../../models/textTypes/main';
import { Actions, ActionName } from './actions';


export interface ViewModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    SubcmixerComponent:PluginInterfaces.SubcMixer.View;
    textTypesModel:IModel<TextTypesModelState>;
    liveAttrsModel:LiveAttrsModel;
}

export interface LiveAttrsCustomTTProps {
}


export function init({dispatcher, he, SubcmixerComponent, textTypesModel, liveAttrsModel}:ViewModuleArgs):PluginInterfaces.LiveAttributes.Views {

    const ttViews = ttViewInit(dispatcher, he, textTypesModel);

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
        items:Array<TTSelectionStep|AlignedLangSelectionStep>;
        isLoading:boolean;

    }> = (props) => {

        const shortenValues = (values:Array<any>, joinChar:string) => {
            let ans:Array<string>;
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

        const renderTextTypesSel = (item:TTSelectionStep) => {
            return item.attributes.map((attr, i) => {
                return (
                    <span key={i}>
                        {i > 0 ? ', ' : ''}
                        <strong>{attr}</strong>
                            {'\u00a0\u2208\u00a0'}
                            {'{' + shortenValues(item.values[attr], ', ') + '}'}
                            <br />
                    </span>
                );
            });
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
                                        {isAlignedSelectionStep(item) ?
                                            renderAlignedLangsSel(item) :
                                            renderTextTypesSel(item)
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
        clickHandler:(evt:React.MouseEvent<{}>)=>void;

    }> = (props) => {

        if (props.enabled) {
            return (
                <a className="util-button" onClick={props.clickHandler}>
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
        clickHandler:(evt:React.MouseEvent<{}>)=>void;

    }> = (props) => {
        if (props.enabled) {
            return (
                <a className="util-button cancel" onClick={props.clickHandler}>
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
        clickHandler:(evt:React.MouseEvent<{}>)=>void;

    }> = (props) => {

        if (props.enabled) {
            return (
                <a className="util-button cancel" onClick={props.clickHandler}>
                    {he.translate('ucnkLA__reset_selection_btn')}
                </a>
            );

        } else {
            return <a className="util-button cancel disabled">{he.translate('ucnkLA__reset_selection_btn')}</a>
        }
    };

    // ----------------------------- <LiveAttrsView /> --------------------------

    const LiveAttrsView:React.SFC<LiveAttrsModelState> = (props) => {

        const handleRefine = () => {
            dispatcher.dispatch<Actions.RefineClicked>({
                name: ActionName.RefineClicked,
            });
        };

        const handleReset = () => {
            dispatcher.dispatch<Actions.ResetClicked>({
                name: ActionName.ResetClicked,
            });
        };

        const handleUndo = () => {
            dispatcher.dispatch<Actions.UndoClicked>({
                name: ActionName.UndoClicked,
            });
        };

        const widgetIsActive = () => {
            return !List.empty(props.alignedCorpora) && props.selectionSteps.length > 1
                || List.empty(props.alignedCorpora) && !List.empty(props.selectionSteps);
        };

        return (
            <div className="live-attributes">
                <ul className="controls">
                    <li>
                        <RefineButton enabled={props.controlsEnabled} clickHandler={handleRefine} />
                    </li>
                    <li>
                        <UndoButton enabled={props.controlsEnabled && !List.empty(props.selectionSteps)} clickHandler={handleUndo} />
                    </li>
                    <li>
                        <ResetButton enabled={props.controlsEnabled && !List.empty(props.selectionSteps)} clickHandler={handleReset} />
                    </li>
                    {SubcmixerComponent ?
                        (<li>
                            <SubcmixerComponent isActive={widgetIsActive()} />
                        </li>)
                    : null}
                </ul>
                <SelectionSteps items={props.selectionSteps} isLoading={props.isBusy} />
            </div>
        );
    }

    // ----------------------------- <AlignedLangItem /> --------------------------

    const AlignedLangItem:React.SFC<{
        itemIdx:number;
        item:TextTypes.AlignedLanguageItem;

    }> = (props) => {

        const clickHandler = () => {
            dispatcher.dispatch<Actions.AlignedCorpChanged>({
                name: ActionName.AlignedCorpChanged,
                payload: {
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

    const LiveAttrsCustomTT:React.SFC<LiveAttrsModelState> = (props) => {

        const renderHint = () => {
            if (props.manualAlignCorporaMode) {
                return he.translate('ucnkLA__subcorp_consider_aligned_corpora_manual');

            } else {
                return he.translate('ucnkLA__subcorp_consider_aligned_corpora_auto');
            }
        };

        const handleMinIconClick = () => {
            dispatcher.dispatch<Actions.ToggleMinimizeAlignedLangList>({
                name: ActionName.ToggleMinimizeAlignedLangList
            });
        };

        if (!List.empty(props.alignedCorpora)) {
            const classes = ['TableTextTypeAttribute', 'aligned'];
            if (!List.empty(props.selectionSteps) && isAlignedSelectionStep(List.head(props.selectionSteps))) {
                classes.push('locked');
            }
            return (
                <div className={classes.join(' ')}>
                    <div className="attrib-name">
                        <h3>{he.translate('ucnkLA__aligned_corpora')}</h3>
                        <ttViews.TextTypeAttributeMinIcon isMinimized={props.isTTListMinimized}
                                onClick={handleMinIconClick} />
                    </div>
                    {props.isTTListMinimized ?
                        <div /> :
                        <>
                            <div className="note">
                                <p>
                                    {renderHint()}
                                </p>
                                {
                                    !List.empty(props.alignedCorpora) ?
                                    null :
                                    <p>{he.translate('ucnkLA__aligned_lang_cannot_be_set_here')}</p>
                                }
                            </div>
                            <div className="data-rows">
                                <div className="scrollable">
                                    <table>
                                        <tbody>
                                            {props.alignedCorpora.map((item, i) => {
                                                return (
                                                    <tr key={item.value}>
                                                        <td>
                                                            {props.manualAlignCorporaMode || item.selected ?
                                                                <AlignedLangItem item={item} itemIdx={i} /> :
                                                                null
                                                            }
                                                        </td>
                                                        <td />
                                                    </tr>
                                                );
                                            })}
                                            {!props.manualAlignCorporaMode && !props.alignedCorpora.some(x => x.selected) ?
                                                (
                                                    <tr>
                                                        <td>
                                                            <p style={{maxWidth: '18em'}}>{he.translate('ucnkLA__no_aligned_corpora_yet')}</p>
                                                        </td>
                                                    </tr>
                                                 ) : null
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="hidden-values" />
                            <div className="last-line">
                                {'\u00a0'}
                            </div>
                        </>
                    }
                </div>
            );

        } else {
            return null;
        }
    }

    return {
        LiveAttrsView: Bound<LiveAttrsModelState>(LiveAttrsView, liveAttrsModel),
        LiveAttrsCustomTT: Bound<LiveAttrsModelState>(LiveAttrsCustomTT, liveAttrsModel)
    };

}