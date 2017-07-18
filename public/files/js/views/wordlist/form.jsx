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


import * as React from 'vendor/react';

/**
 *
 * @param {*} dispatcher
 * @param {*} mixins
 * @param {*} layoutViews
 * @param {*} CorparchWidget
 * @param {*} wordlistFormStore
 */
export function init(dispatcher, mixins, layoutViews, CorparchWidget, wordlistFormStore) {

    const util = mixins[0];


    // ---------------- <TRCorpusField /> -----------------------

    /**
     *
     * @param {*} props
     */
    const TRCorpusField = (props) => {

        return (
            <tr>
                <th>{util.translate('global__corpus')}:</th>
                <td>
                    <props.corparchWidget subcorpList={props.subcorpList} />
                </td>
                <td />
            </tr>
        );
    };

    // ---------------- <TRAttrSelector /> -----------------------

    const TRAttrSelector = (props) => {

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
                    {util.translate('wordlist__attrsel_label')}
                </td>
                <td>
                    <select value={props.wlattr} onChange={handleChange}>
                        <optgroup label={util.translate('wordlist__attrsel_group_pos_attrs')}>
                            {props.attrList.map(x => <option key={x.n} value={x.n}>{x.label}</option>)}
                        </optgroup>
                        <optgroup label={util.translate('wordlist__attrsel_group_struct_attrs')}>
                            {props.structAttrList.map(x => <option key={x.n} value={x.n}>{x.label}</option>)}
                        </optgroup>
                    </select>
                </td>
                <td />
            </tr>
        );
    };

    // ------------------- <CorpInfoToolbar /> -----------------------------

    const CorpInfoToolbar = (props) => {
        return (
            <ul id="query-overview-bar">
                <layoutViews.CorpnameInfoTrigger corpname={props.corpname}
                        humanCorpname={props.humanCorpname}
                        usesubcorp={props.usesubcorp} />
            </ul>
        );
    };

    // ---------------------- <TRWlpatternInput /> -------------------

    const TRWlpatternInput = (props) => {

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
                <td title={util.translate('wordlist__re_pattern_title')}>
                    {util.translate('wordlist__re_pattern_label')}:
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

    const TRFrequencyFigures = (props) => {

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
                    {util.translate('wordlist__freq_figures_label')}:
                </td>
                <td>
                    <ul className="wl-option-list">
                        <li>
                            <label>
                                <input type="radio" value="frq" checked={props.wlnums === 'frq'}
                                        onChange={handleRadioChange} />
                                {util.translate('wordlist__freq_fig_radio_frq')}
                            </label>
                        </li>
                        <li>
                            <label>
                                <input type="radio" value="docf" checked={props.wlnums === 'docf'}
                                        onChange={handleRadioChange} />
                                {util.translate('wordlist__freq_fig_radio_docf')}
                            </label>
                        </li>
                        <li>
                            <label>
                                <input type="radio" value="arf" checked={props.wlnums === 'arf'}
                                        onChange={handleRadioChange} />
                                {util.translate('wordlist__freq_fig_radio_arf')}
                            </label>
                        </li>
                    </ul>
                </td>
            </tr>
        );
    };

    // --------------------- <OutTypeAttrSel /> -------------------------------

    const OutTypeAttrSel = (props) => {

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
            <select onChange={handleChange} disabled={props.disabled}>
                <option value="">---</option>
                {props.attrList.map(x => <option key={x.n} value={x.n}>{x.label}</option>)}
            </select>
        );
    }

    // --------------------- <TROutputType /> -------------------------------

    const TROutputType = (props) => {

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
                    {util.translate('wordlist__output_type_title')}:
                </td>
                <td className="output-types">
                    <ul className="wl-option-list">
                        <li>
                            <label>
                                <input type="radio" value="simple" checked={props.wltype === 'simple'}
                                        onChange={handleOutTypeChange} />
                                {util.translate('wordlist__out_type_single_label')}
                            </label>
                            {'\u00a0'}
                            ({util.translate('wordlist__curr_wlattr_hint')}:{'\u00a0'}
                            <strong className="current-wlattr">{props.wlattr}</strong>)
                        </li>
                        <li>
                            <label>
                                <input type="radio" value="multilevel" checked={props.wltype === 'multilevel'}
                                        onChange={handleOutTypeChange} />
                                {util.translate('wordlist__out_type_multi_label')}
                            </label>:
                            <OutTypeAttrSel attrList={props.attrList} value={props.wposattr1} position={1}
                                    disabled={props.wltype !== 'multilevel'} />
                            {'\u00a0'}
                            <OutTypeAttrSel attrList={props.attrList} value={props.wposattr2} position={2}
                                    disabled={props.wltype !== 'multilevel'} />
                            {'\u00a0'}
                            <OutTypeAttrSel attrList={props.attrList} value={props.wposattr3} position={3}
                                    disabled={props.wltype !== 'multilevel'} />
                            {props.wltype === 'multilevel' ?
                                (<p className="hint">
                                    <img src={util.createStaticUrl('img/info-icon.svg')}
                                            alt={util.translate('global__info_icon')}
                                            style={{width: '1em', verticalAlign: 'middle', paddingRight: '0.4em'}} />
                                    {util.translate('wordlist__multiattr_warning')}</p>) : null}
                        </li>
                    </ul>
                </td>
            </tr>
        );
    };

    // --------------------- <FieldsetOutputOptions /> ----------------------

    const FieldsetOutputOptions = (props) => {
        return (
            <fieldset className="FieldsetOutputOptions">
                <legend>
                    {util.translate('wordlist__out_opts_fieldset_legend')}
                </legend>
                <table>
                    <tbody>
                        <TRFrequencyFigures wlnums={props.wlnums} />
                        <TROutputType attrList={props.attrList} wposattr1={props.wposattr1}
                                    wposattr2={props.wposattr2} wposattr3={props.wposattr3}
                                    wltype={props.wltype} wlattr={props.wlattr} />
                    </tbody>
                </table>
            </fieldset>
        );
    };

    // --------------------- <TRWlminfreqInput /> ----------------------------------

    const TRWlminfreqInput = (props) => {

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
                    {util.translate('wordlist__min_freq_label')}:
                </td>
                <td>
                    <input type="text" value={props.wlminfreq}
                            onChange={handleInputChange}
                            style={{width: '3em'}} />
                </td>
            </tr>
        );
    };

    // -------------------- <TRFilterFileUploadInput /> ----------------------------------------

    const TDFilterFileUploadInput = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_FORM_SET_FILTER_FILE',
                props: {
                    value: evt.target.files[0],
                    target: props.target
                }
            });
        };

        return (
            <td>
                <input type="file" onChange={handleInputChange} />
            </td>
        );

    };

    // -------------------- <TDExistingFileOps /> ----------------------------------------

    const TDExistingFileOps = (props) => {

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
                    {util.translate('global__edit')}
                </a>
                {'\u00a0'}
                <a onClick={handleRemoveClick}>
                    {util.translate('global__remove')}
                </a>
            </td>
        );
    };

    // -------------------- <ListUploadInput /> ----------------------------------------

    const TRFilterFile = (props) => {

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
    const FileEditor = (props) => {

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

        return (
            <layoutViews.ModalOverlay onCloseKey={handleClose}>
                <layoutViews.CloseableFrame onCloseClick={handleClose}
                        label={props.data.fileName}>
                    <textarea rows="30" cols="80" value={props.data.data} onChange={handleWriting} />
                    <button className="default-button" onClick={handleClose}>
                        {util.translate('global__ok')}
                    </button>
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    }

    // --------------- <TRIncludeNonWordsCheckbox /> ------------------------

    const TRIncludeNonWordsCheckbox = (props) => {

        const handleChange = (evt) => {
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
                        {util.translate('wordlist__incl_non_word_label')}:
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

    class TRFileFormatHint extends React.Component {

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
                            <p>{util.translate('wordlist__wl_white_lists')}</p>
                        </layoutViews.PopupBox>) : null}
                    </td>
                    <td>
                        <a className="hint" onClick={this._handleClick}>
                            {util.translate('wordlist__req_file_format_link')}
                        </a>
                    </td>
                </tr>
            );
        }
    }

    // --------------- <WordListForm /> ------------------------

    class WordListForm extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchStoreState();
            this._handleSubmitClick = this._handleSubmitClick.bind(this);
            this._handleStoreChange = this._handleStoreChange.bind(this);
        }

        _fetchStoreState() {
            return {
                wltype: wordlistFormStore.getWltype(),
                currentSubcorp: wordlistFormStore.getCurrentSubcorpus(),
                subcorpList: wordlistFormStore.getSubcorpList(),
                attrList: wordlistFormStore.getAttrList(),
                structAttrList: wordlistFormStore.getStructAttrList(),
                wlattr: wordlistFormStore.getWlattr(),
                wlpat: wordlistFormStore.getWlpat(),
                wlnums: wordlistFormStore.getWlnums(),
                wposattr1: wordlistFormStore.getWposattr1(),
                wposattr2: wordlistFormStore.getWposattr2(),
                wposattr3: wordlistFormStore.getWposattr3(),
                wlminfreq: wordlistFormStore.getWlminfreq(),
                filterEditorData: wordlistFormStore.getFilterEditorData(),
                hasWlwords: wordlistFormStore.hasWlwords(),
                hasBlacklist: wordlistFormStore.hasBlacklist(),
                wlFileName: wordlistFormStore.getWlFileName(),
                blFileName: wordlistFormStore.getBlFileName(),
                includeNonwords: wordlistFormStore.getIncludeNonwords()
            };
        }

        _handleSubmitClick() {
            dispatcher.dispatch({
                actionType: 'WORDLIST_FORM_SUBMIT',
                props: {}
            });
        }

        _handleStoreChange() {
            this.setState(this._fetchStoreState());
        }

        componentDidMount() {
            wordlistFormStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            wordlistFormStore.removeChangeListener(this._handleStoreChange);
        }

        render() {
            return (
                <form className="wordlist_form">
                    {this.state.filterEditorData ? <FileEditor data={this.state.filterEditorData} /> : null}
                    <table className="form">
                        <tbody>
                            <tr>
                                <td colSpan="2">
                                    <table>
                                        <tbody>
                                            <TRCorpusField corparchWidget={CorparchWidget}
                                                    currentSubcorp={this.state.currentSubcorp}
                                                    subcorpList={this.state.subcorpList} />
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <fieldset>
                        <legend>
                            {util.translate('wordlist__filter_wordlist_by_legend')}
                        </legend>
                        <table className="form">
                            <tbody>
                                <TRAttrSelector attrList={this.state.attrList}
                                        structAttrList={this.state.structAttrList}
                                        wlattr={this.state.wlattr} />
                                <TRWlpatternInput wlpat={this.state.wlpat} />
                                <TRWlminfreqInput wlminfreq={this.state.wlminfreq} />
                                <TRFilterFile label={util.translate('wordlist__whitelist_label')} target="wlwords"
                                            hasValue={this.state.hasWlwords} fileName={this.state.wlFileName} />
                                <TRFilterFile label="Blacklist" target="blacklist"
                                            hasValue={this.state.hasBlacklist} fileName={this.state.blFileName} />
                                <TRFileFormatHint />
                                <TRIncludeNonWordsCheckbox value={this.state.includeNonwords} />
                            </tbody>
                        </table>
                    </fieldset>
                    <FieldsetOutputOptions wlnums={this.state.wlnums} wposattr1={this.state.wposattr1}
                            wposattr2={this.state.wposattr2} wposattr3={this.state.wposattr3}
                            attrList={this.state.attrList}
                            wltype={this.state.wltype} wlattr={this.state.wlattr} />
                    <div className="buttons">
                        <button className="default-button" type="button"
                                onClick={this._handleSubmitClick}>
                            {util.translate('wordlist__make_wl_btn')}
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