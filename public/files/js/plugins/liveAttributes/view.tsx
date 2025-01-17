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
import { List, pipe } from 'cnc-tskit';

import * as Kontext from '../../types/kontext.js';
import * as TextTypes from '../../types/textTypes.js';
import { LiveAttrsModel, LiveAttrsModelState, TTSelectionStep,
    AlignedLangSelectionStep, isAlignedSelectionStep } from './models.js';
import * as PluginInterfaces from '../../types/plugins/index.js';
import { init as ttViewInit } from '../../views/textTypes/index.js';
import { TextTypesModelState } from '../../models/textTypes/main.js';

import * as S from './style.js';
import * as TTS from '../../views/textTypes/style.js';
import { DataSaveFormat } from '../../app/navigation/save.js';


export interface ViewModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    SubcmixerComponent:PluginInterfaces.SubcMixer.View;
    textTypesModel:IModel<TextTypesModelState>;
    liveAttrsModel:LiveAttrsModel;
}

export interface LiveAttrsCustomTTProps {
}


export function init({
    dispatcher,
    he,
    SubcmixerComponent,
    textTypesModel,
    liveAttrsModel
}:ViewModuleArgs):PluginInterfaces.LiveAttributes.Views {

    const ttViews = ttViewInit(dispatcher, he, textTypesModel);
    const layoutViews = he.getLayoutViews();

    // ----------------------------- <StepLoader /> --------------------------

    const StepLoader:React.FC<{
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

    const SelectionSteps:React.FC<{
        items:Array<TTSelectionStep|AlignedLangSelectionStep>;
        isLoading:boolean;

    }> = (props) => {

        const shortenValues = (values:Array<any>, joinChar:string) => {

            if (typeof(values) === 'string') {
                return values;
            }

            let ans:Array<string>;
            if (values.length > 5) {
                ans = values.slice(0, 2);
                ans.push('\u2026');
                ans = ans.concat(values.slice(values.length - 2, values.length));

            } else {
                ans = values;
            }
            return ans
                .map(item => item.substring(0, 1) !== '@' ? item : item.substring(1))
                .join(joinChar);
        };

        const renderAlignedLangsSel = (item) => {
            return (
                <span>
                {'\u2026\u00a0\u2229'} {shortenValues(item.languages, ' \u2229 ')}
                <br />
                </span>
            );
        };

        const renderTextTypesSel = (item:TTSelectionStep) => List.map(
            (attrName, i) => {
                const attr = item.values[attrName];
                const exclusion = attrName[0] === "!";
                if (exclusion) {
                    attrName = attrName.slice(1);
                }
                if (attr.type === 'default') {
                    return (
                        <span key={i}>
                            {i > 0 ? ', ' : ''}
                            <strong>{attrName}</strong>
                            {exclusion ? '\u00a0\u2209\u00a0' : '\u00a0\u2208\u00a0'}
                            {'{' + shortenValues(attr.selections, ', ') + '}'}
                            <br />
                        </span>
                    );

                } else {
                    return (
                        <span key={i}>
                            {i > 0 ? ', ' : ''}
                            <strong>{attrName}</strong>
                            {exclusion ? '\u00a0\u2209\u00a0' : '\u00a0\u2208\u00a0'}
                            {'{' + attr.decodedValue + '}'}
                            <br />
                        </span>
                    )
                }
            },
            item.attributes
        );

        return (
            <S.LiveAttributesSteps>
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
                                        {item.numPosInfo > 0 ?
                                            he.translate('ucnkLA__num_positions', {num_pos: item.numPosInfo}) :
                                            null
                                        }
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                );
            })}
            {props.isLoading ? <StepLoader idx={props.items.length + 1} /> : null}
            </S.LiveAttributesSteps>
        );
    };

    // ----------------------------- <RefineButton /> --------------------------

    const RefineButton:React.FC<{
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

    const UndoButton:React.FC<{
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

    const ResetButton:React.FC<{
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

    // ----------------------------- <DocumentListFieldset /> -----------------------

    const DocumentListFieldset:React.FC<{
        structAttrList:Array<{n:string; selected:boolean}>;
        totalItems:number;
        dataFormat:DataSaveFormat;
    }> = (props) => {

        const handleStructAttr = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                PluginInterfaces.LiveAttributes.Actions.SelectDownloadStructAttr,
                {
                    name: evt.target.value,
                    checked: evt.target.checked
                }
            );
        };

        const handleDataFormat = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch(
                PluginInterfaces.LiveAttributes.Actions.SetDocumentListDataFormat,
                {
                    value: evt.target.value as DataSaveFormat
                }
            );
        };

        const handleSaveButton = () => {
            dispatcher.dispatch(
                PluginInterfaces.LiveAttributes.Actions.DownloadDocumentList
            );
        };

        return (
            <S.DocumentListFieldset>
                <ul>
                    <li>
                        <S.Label htmlFor="dl-attrs">
                            {he.translate('ucnkLA__dt_structattrs')}:
                        </S.Label>
                        <ul className="attrs" id="dl-attrs">
                            {List.map(
                                x => (
                                    <li key={`sattr:${x.n}`} className={x.selected ? 'selected' : null}>
                                        <label>
                                            <input type="checkbox" value={x.n} checked={x.selected} onChange={handleStructAttr} />
                                            {x.n}
                                        </label>
                                    </li>
                                ),
                                props.structAttrList
                            )}
                        </ul>
                    </li>
                    <li>
                        <S.Label htmlFor="dl-format">
                            {he.translate('ucnkLA__dt_file_format')}:
                        </S.Label>
                        <select id="dl-format"
                                onChange={handleDataFormat}
                                value={props.dataFormat}>
                            <option value="csv">CSV</option>
                            <option value="xlsx">XLSX (Excel)</option>
                            <option value="xml">XML</option>
                            <option value="jsonl">JSONL</option>
                        </select>
                        {props.dataFormat === 'jsonl' ?
                            <layoutViews.InlineHelp
                                    htmlClass="format-select-help"
                                    url="https://jsonlines.org/">
                                {he.translate('global__jsonl_explanation')}
                            </layoutViews.InlineHelp> : null}
                    </li>
                    <li>
                        <S.Label htmlFor="dl-total-items">
                            {he.translate('ucnkLA__total_items')}:
                        </S.Label>
                        <span>
                            {props.totalItems ?
                                he.formatNumber(props.totalItems) :
                                null
                            }
                        </span>
                    </li>
                </ul>
                <p>
                    <button type="button" className="default-button" onClick={handleSaveButton}>
                        {he.translate('global__save')}
                    </button>
                </p>
            </S.DocumentListFieldset>
        );
    };

    // ----------------------------- <DocumentListWidget /> ---------------------

    const DocumentListWidget:React.FC<{
        structAttrList:Array<{n:string; selected:boolean}>;
        totalItems:number;
        dataFormat:DataSaveFormat;
        isBusy:boolean;
        onClose:()=>void
    }> = (props) => {

        React.useEffect(
            () => {
                dispatcher.dispatch(
                    PluginInterfaces.LiveAttributes.Actions.DownloadNumMatchingDocuments
                )
            },
            []
        );

        return (
            <layoutViews.ModalOverlay onCloseKey={props.onClose}>
                <layoutViews.CloseableFrame
                        onCloseClick={props.onClose}
                        label="save document list">
                    <S.DocumentListWidget>
                        {props.isBusy ?
                            <layoutViews.AjaxLoaderImage /> :
                            <DocumentListFieldset
                                structAttrList={props.structAttrList}
                                totalItems={props.totalItems}
                                dataFormat={props.dataFormat} />
                        }
                    </S.DocumentListWidget>
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        )
    }

    // ----------------------------- <LiveAttrsView /> --------------------------

    const LiveAttrsView:React.FC<LiveAttrsModelState> = (props) => {

        const handleRefine = () => {
            dispatcher.dispatch(
                PluginInterfaces.LiveAttributes.Actions.RefineClicked,
                {onlyUnlockedSelections: true}
            );
        };

        const handleReset = () => {
            dispatcher.dispatch(
                PluginInterfaces.LiveAttributes.Actions.ResetClicked,
            );
        };

        const handleUndo = () => {
            dispatcher.dispatch(
                PluginInterfaces.LiveAttributes.Actions.UndoClicked,
            );
        };

        const widgetIsActive = () => {
            return !List.empty(props.alignedCorpora) && props.selectionSteps.length > 1
                || List.empty(props.alignedCorpora) && !List.empty(props.selectionSteps);
        };

        const handleDocumentListWidget = () => {
            dispatcher.dispatch(
                PluginInterfaces.LiveAttributes.Actions.ToggleDocumentListWidget
            );
        };

        return (
            <div>
                <S.LiveAttributesControlsUL className="controls">
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
                </S.LiveAttributesControlsUL>
                <SelectionSteps items={props.selectionSteps} isLoading={props.isBusy} />
                {props.documentListWidgetVisible ?
                    <DocumentListWidget
                        onClose={handleDocumentListWidget}
                        structAttrList={props.structAttrs}
                        totalItems={props.documentListTotalSize}
                        dataFormat={props.documentListSaveFormat}
                        isBusy={props.docSaveIsBusy} /> :
                    null
                }
            </div>
        );
    }

    // ----------------------------- <AlignedLangItem /> --------------------------

    const AlignedLangItem:React.FC<{
        itemIdx:number;
        item:TextTypes.AlignedLanguageItem;

    }> = (props) => {

        const clickHandler = () => {
            dispatcher.dispatch<typeof PluginInterfaces.LiveAttributes.Actions.AlignedCorpChanged>({
                name: PluginInterfaces.LiveAttributes.Actions.AlignedCorpChanged.name,
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

    const LiveAttrsCustomTT:React.FC<LiveAttrsModelState> = (props) => {

        const renderHint = () => {
            if (props.manualAlignCorporaMode) {
                return he.translate('ucnkLA__subcorp_consider_aligned_corpora_manual');

            } else {
                return he.translate('ucnkLA__subcorp_consider_aligned_corpora_auto');
            }
        };

        const handleMinIconClick = () => {
            dispatcher.dispatch<typeof PluginInterfaces.LiveAttributes.Actions.ToggleMinimizeAlignedLangList>({
                name: PluginInterfaces.LiveAttributes.Actions.ToggleMinimizeAlignedLangList.name
            });
        };

        if (!List.empty(props.alignedCorpora)) {
            return (
                <div>
                    <TTS.TableTextTypeAttribute className={!List.empty(props.selectionSteps) && isAlignedSelectionStep(List.head(props.selectionSteps)) ? 'locked' : null}>
                        <TTS.AttribName>
                            <h3>{he.translate('ucnkLA__aligned_corpora')}</h3>
                            <ttViews.TextTypeAttributeMinIcon isMinimized={props.isTTListMinimized}
                                    onClick={handleMinIconClick} />
                        </TTS.AttribName>
                        {props.isTTListMinimized ?
                            <div /> :
                            <>
                                <S.MinimizedTTBoxNote>
                                    <p>
                                        {renderHint()}
                                    </p>
                                    {
                                        !List.empty(props.alignedCorpora) ?
                                        null :
                                        <p>{he.translate('ucnkLA__aligned_lang_cannot_be_set_here')}</p>
                                    }
                                </S.MinimizedTTBoxNote>
                                <S.CustomizedDataRows className="data-rows">
                                    <div className="scrollable">
                                        <table>
                                            <tbody>
                                                {pipe(
                                                    props.alignedCorpora,
                                                    props.manualAlignCorporaMode ?
                                                        v => v :
                                                        List.filter(v => v.selected),
                                                    List.map(
                                                        (item, i) => (
                                                            <tr key={item.value}>
                                                                <td>
                                                                    {props.manualAlignCorporaMode || item.selected ?
                                                                        <AlignedLangItem item={item} itemIdx={i} /> :
                                                                        null
                                                                    }
                                                                </td>
                                                                <td />
                                                            </tr>
                                                        )
                                                    )
                                                )}
                                                {!props.manualAlignCorporaMode && !List.some(x => x.selected, props.alignedCorpora) ?
                                                    (
                                                        <tr>
                                                            <td>
                                                                <p>{he.translate('ucnkLA__no_aligned_corpora_yet')}</p>
                                                            </td>
                                                        </tr>
                                                    ) : null
                                                }
                                            </tbody>
                                        </table>
                                    </div>
                                </S.CustomizedDataRows>
                                <div className="hidden-values" />
                                <TTS.TableTextTypeFooter>
                                    {'\u00a0'}
                                </TTS.TableTextTypeFooter>
                            </>
                        }
                    </TTS.TableTextTypeAttribute>
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