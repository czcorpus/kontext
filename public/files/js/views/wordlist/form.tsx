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
import * as Immutable from 'immutable';
import {ActionDispatcher} from '../../app/dispatcher';
import {Kontext} from '../../types/common';
import {WordlistFormModel, WordlistFormState, WlnumsTypes, FileTarget} from '../../models/wordlist/form';
import {PluginInterfaces} from '../../types/plugins';

export interface WordlistFormViewArgs {
    dispatcher:ActionDispatcher;
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
                <th>{he.translate('global__corpus')}:</th>
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
        attrList:Immutable.List<Kontext.AttrItem>;
        structAttrList:Immutable.List<Kontext.AttrItem>;

    }> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_FORM_SELECT_ATTR',
                props: {
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
            dispatcher.dispatch({
                actionType: 'WORDLIST_FORM_SET_WLPAT',
                props: {
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
            dispatcher.dispatch({
                actionType: 'WORDLIST_FORM_SET_WLNUMS',
                props: {
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
        attrList:Immutable.List<Kontext.AttrItem>;
        enabled:boolean;
        value:string;

    }> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_FORM_SELECT_WLPOSATTR',
                props: {
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
        attrList:Immutable.List<Kontext.AttrItem>;
        enabled:boolean;
        numWlPosattrLevels:number;
        wposattrs:[string, string, string];

    }> = (props) => {

        const handleAddPosAttrLevelBtn = () => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_FORM_ADD_POSATTR_LEVEL',
                props: {}
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
        attrList:Immutable.List<Kontext.AttrItem>;
        wposattrs:[string, string, string];
        numWlPosattrLevels:number;

    }> = (props) => {

        const handleOutTypeChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_FORM_SET_WLTYPE',
                props: {
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
        attrList:Immutable.List<Kontext.AttrItem>;
        wposattrs:[string, string, string];
        numWlPosattrLevels:number;
        wltype:string;
        wlattr:string;
        allowsMultilevelWltype:boolean;

    }> = (props) => {
        return (
            <fieldset className="FieldsetOutputOptions">
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
            </fieldset>
        );
    };

    // --------------------- <TRWlminfreqInput /> ----------------------------------

    const TRWlminfreqInput:React.SFC<{
        wlminfreq:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_FORM_SET_WLMINFREQ',
                props: {
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
            dispatcher.dispatch({
                actionType: 'WORDLIST_FORM_SET_FILTER_FILE',
                props: {
                    value: evt.target['files'][0],
                    target: props.target
                }
            });
        };

        const handleNewFileClick = (evt) => {
            dispatcher.dispatch({
                actionType: props.target === FileTarget.WHITELIST ?
                        'WORDLIST_FORM_CREATE_WHITELIST' :
                        'WORDLIST_FORM_CREATE_BLACKLIST',
                props: {}
            })
        }

        return (
            <td>
                <a onClick={handleNewFileClick}>{he.translate('wordlist__create_filter_list')}</a> / <input type="file" onChange={handleInputChange} />
            </td>
        );

    };

    // -------------------- <TDExistingFileOps /> ----------------------------------------

    const TDExistingFileOps:React.SFC<{
        target:string;
        fileName:string;

    }> = (props) => {

        const handleRemoveClick = (evt) => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_FORM_CLEAR_FILTER_FILE',
                props: {
                    target: props.target
                }
            });
        };

        const handleEditorEnableClick = (evt) => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_FORM_REOPEN_EDITOR',
                props: {
                    target: props.target
                }
            });
        };

        return (
            <td className="TDExistingFileOps">
                <span className="active-file">{props.fileName}</span>
                {'\u00a0'}
                <a onClick={handleEditorEnableClick}>
                    {he.translate('global__edit')}
                </a>
                {'\u00a0'}
                <a onClick={handleRemoveClick}>
                    {he.translate('global__remove')}
                </a>
            </td>
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
            dispatcher.dispatch({
                actionType: 'WORDLIST_FORM_CLOSE_EDITOR',
                props: {}
            });
        };

        const handleWriting = (evt) => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_FORM_UPDATE_EDITOR',
                props: {
                    value: evt.target.value
                }
            });
        };

        const handleKeyDown = (evt:React.KeyboardEvent<{}>) => {
            if (evt.keyCode === 13) {
                if (evt.shiftKey) {
                    dispatcher.dispatch({
                        actionType: 'WORDLIST_FORM_UPDATE_EDITOR',
                        props: {
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
            dispatcher.dispatch({
                actionType: 'WORDLIST_FORM_SET_INCLUDE_NONWORDS',
                props: {
                    value: !props.value
                }
            });
        };

        return (
            <tr className="TRIncludeNonWordsCheckbox">
                <td>
                    <label htmlFor="wl-include-non-words-checkbox">
                        {he.translate('wordlist__incl_non_word_label')}:
                    </label>
                </td>
                <td>
                    <input id="wl-include-non-words-checkbox" type="checkbox" checked={props.value}
                            onChange={handleChange} />
                </td>
            </tr>
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

    class WordListForm extends React.Component<{}, WordlistFormState> {

        constructor(props) {
            super(props);
            this.state = wordlistFormModel.getState();
            this._handleSubmitClick = this._handleSubmitClick.bind(this);
            this._handleModelChange = this._handleModelChange.bind(this);
            this._handleKeyPress = this._handleKeyPress.bind(this);
        }

        _handleSubmitClick() {
            dispatcher.dispatch({
                actionType: 'WORDLIST_FORM_SUBMIT',
                props: {}
            });
        }

        _handleModelChange(state:WordlistFormState) {
            this.setState(state);
        }

        _handleKeyPress(evt) {
            if (evt.keyCode === 13) {
                evt.preventDefault();
                evt.stopPropagation();
                this._handleSubmitClick();
            }
        }

        componentDidMount() {
            wordlistFormModel.addChangeListener(this._handleModelChange);
        }

        componentWillUnmount() {
            wordlistFormModel.removeChangeListener(this._handleModelChange);
        }

        render() {
            return (
                <form className="wordlist_form" onKeyDown={this._handleKeyPress}>
                    {this.state.filterEditorData.target !== FileTarget.EMPTY ? <FileEditor data={this.state.filterEditorData} /> : null}
                    <table className="form">
                        <tbody>
                            <tr>
                                <td colSpan={2}>
                                    <table>
                                        <tbody>
                                            <TRCorpusField corparchWidget={CorparchWidget}
                                                    currentSubcorp={this.state.currentSubcorpus} />
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
                                <TRAttrSelector attrList={this.state.attrList}
                                        structAttrList={this.state.structAttrList}
                                        wlattr={this.state.wlattr} />
                                <TRWlpatternInput wlpat={this.state.wlpat} />
                                <TRWlminfreqInput wlminfreq={this.state.wlminfreq} />
                                <TRFilterFile label={he.translate('wordlist__whitelist_label')} target={FileTarget.WHITELIST}
                                            hasValue={!!this.state.wlwords} fileName={this.state.wlFileName} />
                                <TRFilterFile label={he.translate('wordlist__blacklist_label')} target={FileTarget.BLACKLIST}
                                            hasValue={!!this.state.blacklist} fileName={this.state.blFileName} />
                                <TRFileFormatHint />
                                <TRIncludeNonWordsCheckbox value={this.state.includeNonwords} />
                            </tbody>
                        </table>
                    </fieldset>
                    <FieldsetOutputOptions wlnums={this.state.wlnums} wposattrs={this.state.wlposattrs}
                            numWlPosattrLevels={this.state.numWlPosattrLevels}
                            attrList={this.state.attrList} wltype={this.state.wltype} wlattr={this.state.wlattr}
                            allowsMultilevelWltype={this.state.wlnums === WlnumsTypes.FRQ} />
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
        WordListForm: WordListForm,
        CorpInfoToolbar: CorpInfoToolbar
    };
}