/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
import { IActionDispatcher, Bound } from 'kombo';
import { Keyboard } from 'cnc-tskit';

import { Kontext } from '../../types/common';
import { WordlistFormModel, WordlistFormState } from '../../models/wordlist/form';
import { PluginInterfaces } from '../../types/plugins';
import { Actions, ActionName } from '../../models/wordlist/actions';
import { FileTarget, WlnumsTypes } from '../../models/wordlist/common';

import * as S from './style';


export interface WordlistFormViewArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    CorparchWidget:PluginInterfaces.Corparch.WidgetView;
    wordlistFormModel:WordlistFormModel
}

export interface CorpInfoToolbarProps {
    corpname:string;
    humanCorpname:string;
    usesubcorp:string;
    origSubcorpName:string;
    foreignSubcorp:boolean;
}

export interface WordlistFormExportViews {
    WordListForm:React.ComponentClass<{}>;
    CorpInfoToolbar:React.SFC<CorpInfoToolbarProps>;
}


export function init({dispatcher, he, CorparchWidget, wordlistFormModel}:WordlistFormViewArgs):WordlistFormExportViews {

    const layoutViews = he.getLayoutViews();

    // ---------------- <TRCorpusField /> -----------------------

    /**
     *
     * @param {*} props
     */
    const TRCorpusField:React.SFC<{
        corparchWidget:PluginInterfaces.Corparch.WidgetView;
        currentSubcorp:string;

    }> = (props) => {
        return (
            <tr>
                <td>
                    <props.corparchWidget />
                </td>
                <td />
            </tr>
        );
    };

    // ---------------- <TRAttrSelector /> -----------------------

    const TRAttrSelector:React.SFC<{
        wlattr:string;
        attrList:Array<Kontext.AttrItem>;
        structAttrList:Array<Kontext.AttrItem>;

    }> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch<Actions.WordlistFormSelectAttr>({
                name: ActionName.WordlistFormSelectAttr,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <td>
                    {he.translate('wordlist__attrsel_label')}
                </td>
                <td>
                    <select value={props.wlattr} onChange={handleChange}>
                        <optgroup label={he.translate('global__attrsel_group_pos_attrs')}>
                            {props.attrList.map(x => <option key={x.n} value={x.n}>{x.label}</option>)}
                        </optgroup>
                        <optgroup label={he.translate('global__attrsel_group_struct_attrs')}>
                            {props.structAttrList.map(x => <option key={x.n} value={x.n}>{x.label}</option>)}
                        </optgroup>
                    </select>
                </td>
                <td />
            </tr>
        );
    };

    // ------------------- <CorpInfoToolbar /> -----------------------------

    const CorpInfoToolbar:React.SFC<CorpInfoToolbarProps> = (props) => {
        return (
            <ul id="query-overview-bar">
                <layoutViews.CorpnameInfoTrigger corpname={props.corpname}
                        humanCorpname={props.humanCorpname}
                        usesubcorp={props.usesubcorp}
                        origSubcorpName={props.origSubcorpName}
                        foreignSubcorp={props.foreignSubcorp} />
            </ul>
        );
    };

    // ---------------------- <TRWlpatternInput /> -------------------

    const TRWlpatternInput:React.SFC<{
        wlpat:string;

    }> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch<Actions.WordlistFormSetWlpat>({
                name: ActionName.WordlistFormSetWlpat,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <td title={he.translate('wordlist__re_pattern_title')}>
                    {he.translate('wordlist__re_pattern_label')}:
                </td>
                <td>
                    <input type="text" value={props.wlpat} onChange={handleChange}
                            style={{width: '20em'}} />
                </td>
                <td />
            </tr>
        );
    }

    // ------------------ <TRFrequencyFigures /> -------------------------------

    const TRFrequencyFigures:React.SFC<{
        wlnums:string;

    }> = (props) => {

        const handleRadioChange = (evt) => {
            dispatcher.dispatch<Actions.WordlistFormSetWlnums>({
                name: ActionName.WordlistFormSetWlnums,
                payload: {
                    value: evt.target.value
                }
            });
        }

        return (
            <tr>
                <td>
                    {he.translate('wordlist__freq_figures_label')}:
                </td>
                <td>
                    <ul className="wl-option-list">
                        <li>
                            <label>
                                <input type="radio" value="frq" checked={props.wlnums === 'frq'}
                                        onChange={handleRadioChange} />
                                {he.translate('wordlist__freq_fig_radio_frq')}
                            </label>
                        </li>
                        <li>
                            <label>
                                <input type="radio" value="docf" checked={props.wlnums === 'docf'}
                                        onChange={handleRadioChange} />
                                {he.translate('wordlist__freq_fig_radio_docf')}
                            </label>
                        </li>
                        <li>
                            <label>
                                <input type="radio" value="arf" checked={props.wlnums === 'arf'}
                                        onChange={handleRadioChange} />
                                {he.translate('wordlist__freq_fig_radio_arf')}
                            </label>
                        </li>
                    </ul>
                </td>
            </tr>
        );
    };

    // --------------------- <OutTypeAttrSel /> -------------------------------

    const OutTypeAttrSel:React.SFC<{
        position:number;
        attrList:Array<Kontext.AttrItem>;
        enabled:boolean;
        value:string;

    }> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch<Actions.WordlistFormSelectWlposattr>({
                name: ActionName.WordlistFormSelectWlposattr,
                payload: {
                    position: props.position,
                    value: evt.target.value
                }
            });
        }

        return (
            <select onChange={handleChange} disabled={!props.enabled}>
                <option value={props.value}>---</option>
                {props.attrList.map(x => <option key={x.n} value={x.n}>{x.label}</option>)}
            </select>
        );
    }

    // --------------------- <MultiLevelPosAttr /> -------------------------------

    const MultiLevelPosAttr:React.SFC<{
        attrList:Array<Kontext.AttrItem>;
        enabled:boolean;
        numWlPosattrLevels:number;
        wposattrs:[string, string, string];

    }> = (props) => {

        const handleAddPosAttrLevelBtn = () => {
            dispatcher.dispatch<Actions.WordlistFormAddPosattrLevel>({
                name: ActionName.WordlistFormAddPosattrLevel
            });
        };

        return <ul className="MultiLevelPosAttr">
                <li>
                    <OutTypeAttrSel attrList={props.attrList} position={1}
                            enabled={props.enabled} value={props.wposattrs[0]} />
                </li>
            {props.numWlPosattrLevels >= 2 ?
                <li>
                    <OutTypeAttrSel attrList={props.attrList} position={2}
                        enabled={props.enabled} value={props.wposattrs[1]} />
                </li> :
                null
            }
            {props.numWlPosattrLevels >= 3 ?
                <li>
                    <OutTypeAttrSel attrList={props.attrList} position={3}
                        enabled={props.enabled} value={props.wposattrs[2]} />
                </li> :
                null
            }
            {props.numWlPosattrLevels < 3 && props.enabled ?
                <li>
                    <layoutViews.PlusButton onClick={handleAddPosAttrLevelBtn}
                        mouseOverHint={he.translate('wordlist__add_attr')} />
                </li> :
                null
            }
            {props.enabled ?
                (<p className="hint">
                    <img src={he.createStaticUrl('img/info-icon.svg')}
                            alt={he.translate('global__info_icon')}
                            style={{width: '1em', verticalAlign: 'middle', paddingRight: '0.4em'}} />
                    {he.translate('wordlist__multiattr_warning')}</p>) : null}
        </ul>;
    }

    // --------------------- <TROutputType /> -------------------------------

    const TROutputType:React.SFC<{
        wltype:string;
        allowsMultilevelWltype:boolean;
        wlattr:string;
        attrList:Array<Kontext.AttrItem>;
        wposattrs:[string, string, string];
        numWlPosattrLevels:number;

    }> = (props) => {

        const handleOutTypeChange = (evt) => {
            dispatcher.dispatch<Actions.WordlistFormSetWltype>({
                name: ActionName.WordlistFormSetWltype,
                payload: {
                    value: evt.target.value
                }
            });
        }

        return (
            <tr>
                <td>
                    {he.translate('wordlist__output_type_title')}:
                </td>
                <td className="output-types">
                    <ul className="wl-option-list">
                        <li>
                            <label>
                                <input type="radio" value="simple" checked={props.wltype === 'simple'}
                                        onChange={handleOutTypeChange} />
                                {he.translate('wordlist__out_type_single_label')}
                            </label>
                            {'\u00a0'}
                            ({he.translate('wordlist__curr_wlattr_hint')}:{'\u00a0'}
                            <strong className="current-wlattr">{props.wlattr}</strong>)
                        </li>
                        {props.allowsMultilevelWltype ?
                            (<li>
                                <label>
                                    <input type="radio" value="multilevel" checked={props.wltype === 'multilevel'}
                                            onChange={handleOutTypeChange} />
                                    {he.translate('wordlist__out_type_multi_label')}
                                </label>:
                                <MultiLevelPosAttr enabled={props.wltype === 'multilevel'}
                                        attrList={props.attrList}
                                        wposattrs={props.wposattrs}
                                        numWlPosattrLevels={props.numWlPosattrLevels} />
                            </li>) :
                            (<li>
                                <label>
                                    <input type="radio" disabled={true} onChange={handleOutTypeChange} value="" checked={false} />
                                    {he.translate('wordlist__out_type_multi_label')}
                                </label>:
                                {'\u00a0'}
                                <span className="hint">{he.translate('wordlist__ml_not_avail')}</span>
                            </li>)
                        }
                    </ul>
                </td>
            </tr>
        );
    };

    // --------------------- <FieldsetOutputOptions /> ----------------------

    const FieldsetOutputOptions:React.SFC<{
        wlnums:string;
        attrList:Array<Kontext.AttrItem>;
        wposattrs:[string, string, string];
        numWlPosattrLevels:number;
        wltype:string;
        wlattr:string;
        allowsMultilevelWltype:boolean;

    }> = (props) => {
        return (
            <S.FieldsetOutputOptions>
                <legend>
                    {he.translate('wordlist__out_opts_fieldset_legend')}
                </legend>
                <table>
                    <tbody>
                        <TRFrequencyFigures wlnums={props.wlnums} />
                        <TROutputType attrList={props.attrList} wposattrs={props.wposattrs}
                                    numWlPosattrLevels={props.numWlPosattrLevels}
                                    wltype={props.wltype} wlattr={props.wlattr}
                                    allowsMultilevelWltype={props.allowsMultilevelWltype} />
                    </tbody>
                </table>
            </S.FieldsetOutputOptions>
        );
    };

    // --------------------- <TRWlminfreqInput /> ----------------------------------

    const TRWlminfreqInput:React.SFC<{
        wlminfreq:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<Actions.WordlistFormSetWlminfreq>({
                name: ActionName.WordlistFormSetWlminfreq,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <td>
                    {he.translate('wordlist__min_freq_label')}:
                </td>
                <td>
                    <layoutViews.ValidatedItem invalid={props.wlminfreq.isInvalid}>
                        <input type="text" value={props.wlminfreq.value}
                                onChange={handleInputChange}
                                style={{width: '3em'}} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    };

    // -------------------- <TRFilterFileUploadInput /> ----------------------------------------

    const TDFilterFileUploadInput:React.SFC<{
        target:FileTarget;

    }> = (props) => {

        const handleInputChange = (evt:React.ChangeEvent<{}>) => {
            dispatcher.dispatch<Actions.WordlistFormSetFilter>({
                name: ActionName.WordlistFormSetFilter,
                payload: {
                    value: evt.target['files'][0],
                    target: props.target
                }
            });
        };

        const handleNewFileClick = (evt) => {
            if (props.target === FileTarget.WHITELIST) {
                dispatcher.dispatch<Actions.WordlistFormCreateWhitelist>({
                    name: ActionName.WordlistFormCreateWhitelist
                });

            } else {
                dispatcher.dispatch<Actions.WordlistFormCreateBlacklist>({
                    name: ActionName.WordlistFormCreateBlacklist
                });
            }
        }

        return (
            <td>
                <a onClick={handleNewFileClick}>{he.translate('wordlist__create_filter_list')}</a>
                / <input type="file" onChange={handleInputChange} />
            </td>
        );

    };

    // -------------------- <TDExistingFileOps /> ----------------------------------------

    const TDExistingFileOps:React.SFC<{
        target:FileTarget;
        fileName:string;

    }> = (props) => {

        const handleRemoveClick = (evt) => {
            dispatcher.dispatch<Actions.WordlistFormClearFilterFile>({
                name: ActionName.WordlistFormClearFilterFile,
                payload: {
                    target: props.target
                }
            });
        };

        const handleEditorEnableClick = (evt) => {
            dispatcher.dispatch<Actions.WordlistFormReopenEditor>({
                name: ActionName.WordlistFormReopenEditor,
                payload: {
                    target: props.target
                }
            });
        };

        return (
            <S.TDExistingFileOps>
                <span className="active-file">{props.fileName}</span>
                {'\u00a0'}
                <a onClick={handleEditorEnableClick}>
                    {he.translate('global__edit')}
                </a>
                {'\u00a0'}
                <a onClick={handleRemoveClick}>
                    {he.translate('global__remove')}
                </a>
            </S.TDExistingFileOps>
        );
    };

    // -------------------- <ListUploadInput /> ----------------------------------------

    const TRFilterFile:React.SFC<{
        label:string;
        hasValue:boolean;
        target:FileTarget;
        fileName:string;

    }> = (props) => {

        return (
            <tr>
                <td>
                    {props.label}:{'\u00a0'}
                </td>
                {props.hasValue ?
                    <TDExistingFileOps target={props.target} fileName={props.fileName} /> :
                    <TDFilterFileUploadInput target={props.target} />
                }
            </tr>
        );
    };

    // -------------------- <FileEditor /> ----------------------------------------

    /**
     *
     */
    const FileEditor:React.SFC<{
        data:{
            fileName:string;
            data:string;
        }
    }> = (props) => {

        const handleClose = () => {
            dispatcher.dispatch<Actions.WordlistFormCloseEditor>({
                name: ActionName.WordlistFormCloseEditor
            });
        };

        const handleWriting = (evt) => {
            dispatcher.dispatch<Actions.WordlistFormUpdateEditor>({
                name: ActionName.WordlistFormUpdateEditor,
                payload: {
                    value: evt.target.value
                }
            });
        };

        const handleKeyDown = (evt:React.KeyboardEvent<{}>) => {
            if (evt.key === Keyboard.Value.ENTER) {
                if (evt.shiftKey) {
                    dispatcher.dispatch<Actions.WordlistFormUpdateEditor>({
                        name: ActionName.WordlistFormUpdateEditor,
                        payload: {
                            value: props.data.data + '\n'
                        }
                    });

                } else {
                    handleClose();
                }
                evt.stopPropagation();
                evt.preventDefault();
            }
        };

        return (
            <layoutViews.ModalOverlay onCloseKey={handleClose}>
                <layoutViews.CloseableFrame onCloseClick={handleClose}
                        label={props.data.fileName}>
                    <p className="note">
                        {he.translate('wordlist__use_ctrl_enter_for_newline')}
                    </p>
                    <textarea rows={30} cols={80} value={props.data.data} onChange={handleWriting}
                        onKeyDown={handleKeyDown} ref={item => item ? item.focus() : null} />
                    <button className="default-button" onClick={handleClose}>
                        {he.translate('global__ok')}
                    </button>
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    }

    // --------------- <TRIncludeNonWordsCheckbox /> ------------------------

    const TRIncludeNonWordsCheckbox:React.SFC<{
        value:boolean;

    }> = (props) => {

        const handleChange = (evt:React.ChangeEvent<{}>) => {
            dispatcher.dispatch<Actions.WordlistFormSetIncludeNonwords>({
                name: ActionName.WordlistFormSetIncludeNonwords,
                payload: {
                    value: !props.value
                }
            });
        };

        return (
            <S.TRIncludeNonWordsCheckbox>
                <td>
                    <label htmlFor="wl-include-non-words-checkbox">
                        {he.translate('wordlist__incl_non_word_label')}:
                    </label>
                </td>
                <td>
                    <input id="wl-include-non-words-checkbox" type="checkbox" checked={props.value}
                            onChange={handleChange} />
                </td>
            </S.TRIncludeNonWordsCheckbox>
        );
    };

    // --------------- <TRFileFormatHint /> ------------------------

    class TRFileFormatHint extends React.Component<{},
    {
        hintVisible:boolean;
    }> {

        constructor(props) {
            super(props);
            this.state = {hintVisible: false};
            this._handleClick = this._handleClick.bind(this);
            this._handleCloseClick = this._handleCloseClick.bind(this);
        }

        _handleClick() {
            this.setState({hintVisible: true});
        }

        _handleCloseClick() {
            this.setState({hintVisible: false});
        }

        render() {
            return (
                <tr>
                    <td>
                    {this.state.hintVisible ?
                        (<layoutViews.PopupBox onCloseClick={this._handleCloseClick}
                                customStyle={{width: '20em'}}>
                            <p>{he.translate('wordlist__wl_white_lists')}</p>
                        </layoutViews.PopupBox>) : null}
                    </td>
                    <td>
                        <a className="hint" onClick={this._handleClick}>
                            {he.translate('wordlist__req_file_format_link')}
                        </a>
                    </td>
                </tr>
            );
        }
    }

    // --------------- <WordListForm /> ------------------------

    class WordListForm extends React.PureComponent<WordlistFormState> {

        constructor(props) {
            super(props);
            this._handleSubmitClick = this._handleSubmitClick.bind(this);
            this._handleKeyPress = this._handleKeyPress.bind(this);
        }

        _handleSubmitClick() {
            dispatcher.dispatch<Actions.WordlistFormSubmit>({
                name: ActionName.WordlistFormSubmit
            });
        }

        _handleKeyPress(evt) {
            if (evt.key === Keyboard.Value.ENTER) {
                evt.preventDefault();
                evt.stopPropagation();
                this._handleSubmitClick();
            }
        }

        render() {
            return (
                <form className="wordlist_form" onKeyDown={this._handleKeyPress}>
                    {this.props.filterEditorData.target !== FileTarget.EMPTY ? <FileEditor data={this.props.filterEditorData} /> : null}
                    <table className="form">
                        <tbody>
                            <tr>
                                <td colSpan={2}>
                                    <table>
                                        <tbody>
                                            <TRCorpusField corparchWidget={CorparchWidget}
                                                    currentSubcorp={this.props.currentSubcorpus} />
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <fieldset>
                        <legend>
                            {he.translate('wordlist__filter_wordlist_by_legend')}
                        </legend>
                        <table className="form">
                            <tbody>
                                <TRAttrSelector attrList={this.props.attrList}
                                        structAttrList={this.props.structAttrList}
                                        wlattr={this.props.wlattr} />
                                <TRWlpatternInput wlpat={this.props.wlpat} />
                                <TRWlminfreqInput wlminfreq={this.props.wlminfreq} />
                                <TRFilterFile label={he.translate('wordlist__whitelist_label')} target={FileTarget.WHITELIST}
                                            hasValue={!!this.props.wlwords} fileName={this.props.wlFileName} />
                                <TRFilterFile label={he.translate('wordlist__blacklist_label')} target={FileTarget.BLACKLIST}
                                            hasValue={!!this.props.blacklist} fileName={this.props.blFileName} />
                                <TRFileFormatHint />
                                <TRIncludeNonWordsCheckbox value={this.props.includeNonwords} />
                            </tbody>
                        </table>
                    </fieldset>
                    <FieldsetOutputOptions wlnums={this.props.wlnums} wposattrs={this.props.wlposattrs}
                            numWlPosattrLevels={this.props.numWlPosattrLevels}
                            attrList={this.props.attrList} wltype={this.props.wltype} wlattr={this.props.wlattr}
                            allowsMultilevelWltype={this.props.wlnums === WlnumsTypes.FRQ} />
                    <div className="buttons">
                        <button className="default-button" type="button"
                                onClick={this._handleSubmitClick}>
                            {he.translate('wordlist__make_wl_btn')}
                        </button>
                    </div>
                </form>
            );
        }
    }

    return {
        WordListForm: Bound(WordListForm, wordlistFormModel),
        CorpInfoToolbar: CorpInfoToolbar
    };
}