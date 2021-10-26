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
import { Keyboard, List } from 'cnc-tskit';

import * as Kontext from '../../../types/kontext';
import { MultiposAttr, WordlistFormModel, WordlistFormState } from '../../../models/wordlist/form';
import * as PluginInterfaces from '../../../types/plugins';
import { Actions } from '../../../models/wordlist/actions';
import { FileTarget, WlnumsTypes } from '../../../models/wordlist/common';
import * as S from './style';
import * as SC from '../../query/style';
import { QueryOverviewBarUL as Style_QueryOverviewBarUL } from '../../query/basicOverview/style';


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
    CorpInfoToolbar:React.FC<CorpInfoToolbarProps>;
}


export function init({dispatcher, he, CorparchWidget, wordlistFormModel}:WordlistFormViewArgs):WordlistFormExportViews {

    const layoutViews = he.getLayoutViews();


    // ---------------- <AttrSelector /> -----------------------

    const AttrSelector:React.FC<{
        wlattr:string;
        attrList:Array<Kontext.AttrItem>;
        structAttrList:Array<Kontext.AttrItem>;

    }> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch<typeof Actions.WordlistFormSelectAttr>({
                name: Actions.WordlistFormSelectAttr.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <>
                <label htmlFor="wl-attr-selector">
                    {he.translate('wordlist__attrsel_label')}:
                </label>
                <span>
                    <select id="wl-attr-selector" value={props.wlattr} onChange={handleChange}>
                        <optgroup label={he.translate('global__attrsel_group_pos_attrs')}>
                            {props.attrList.map(x => <option key={x.n} value={x.n}>{x.label}</option>)}
                        </optgroup>
                        <optgroup label={he.translate('global__attrsel_group_struct_attrs')}>
                            {props.structAttrList.map(x => <option key={x.n} value={x.n}>{x.label}</option>)}
                        </optgroup>
                    </select>
                </span>
            </>
        );
    };

    // ------------------- <CorpInfoToolbar /> -----------------------------

    const CorpInfoToolbar:React.FC<CorpInfoToolbarProps> = (props) => {
        return (
            <Style_QueryOverviewBarUL>
                <layoutViews.CorpnameInfoTrigger corpname={props.corpname}
                        humanCorpname={props.humanCorpname}
                        usesubcorp={props.usesubcorp}
                        origSubcorpName={props.origSubcorpName}
                        foreignSubcorp={props.foreignSubcorp} />
            </Style_QueryOverviewBarUL>
        );
    };

    // ---------------------- <WlpatternInput /> -------------------

    const WlpatternInput:React.FC<{
        wlpat:string;

    }> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch<typeof Actions.WordlistFormSetWlpat>({
                name: Actions.WordlistFormSetWlpat.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        const ref = React.useRef<HTMLInputElement>();

        React.useLayoutEffect(
            () => {
                ref.current.focus();
            },
            [ref.current]
        );

        return (
            <>
                <label title={he.translate('wordlist__re_pattern_title')}
                        htmlFor="wl-pattern-input">
                    {he.translate('wordlist__re_pattern_label')}:
                </label>
                <S.WlpatternInput>
                    <input id="wl-pattern-input" ref={ref} type="text" value={props.wlpat} onChange={handleChange}
                            style={{width: '20em'}} />
                </S.WlpatternInput>
            </>
        );
    }

    // ------------------ <FrequencyFigures /> -------------------------------

    const FrequencyFigures:React.FC<{
        wlnums:string;

    }> = (props) => {

        const handleRadioChange = (evt) => {
            dispatcher.dispatch<typeof Actions.WordlistFormSetWlnums>({
                name: Actions.WordlistFormSetWlnums.name,
                payload: {
                    value: evt.target.value
                }
            });
        }

        return (
            <>
                <label id="wl-freq-figures">
                    {he.translate('wordlist__freq_figures_label')}:
                </label>
                <div>
                    <ul className="wl-option-list" aria-labelledby="wl-freq-figures">
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
                </div>
            </>
        );
    };

    // --------------------- <OutTypeAttrSel /> -------------------------------

    const OutTypeAttrSel:React.FC<{
        attrList:Array<Kontext.AttrItem>;
        enabled:boolean;
        value:MultiposAttr;

    }> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch<typeof Actions.WordlistFormSelectWlposattr>({
                name: Actions.WordlistFormSelectWlposattr.name,
                payload: {
                    ident: props.value.inputId,
                    value: evt.target.value
                }
            });
        }

        return (
            <select onChange={handleChange} disabled={!props.enabled}>
                <option value={props.value.value}>---</option>
                {List.map(
                    x => <option key={x.n} value={x.n}>{x.label}</option>,
                    props.attrList
                )}
            </select>
        );
    }

    // --------------------- <MultiLevelPosAttr /> -------------------------------

    const MultiLevelPosAttr:React.FC<{
        attrList:Array<Kontext.AttrItem>;
        enabled:boolean;
        maxNumLevels:number;
        wposattrs:Array<MultiposAttr>;

    }> = (props) => {

        const handleAddPosAttrLevelBtn = () => {
            dispatcher.dispatch<typeof Actions.WordlistFormAddPosattrLevel>({
                name: Actions.WordlistFormAddPosattrLevel.name
            });
        };

        const handleRemovePosAttrBtn = (ident:string) => () => {
            dispatcher.dispatch<typeof Actions.WordlistFormRemovePosattrLevel>({
                name: Actions.WordlistFormRemovePosattrLevel.name,
                payload: {
                    ident
                }
            });
        };

        return (
            <S.MultiLevelPosAttrUL>
                {List.map(
                    attr => (
                        <li key={attr.inputId}>
                            <OutTypeAttrSel attrList={props.attrList} value={attr}
                                    enabled={props.enabled} />
                            {List.size(props.wposattrs) > 1 ?
                                <a onClick={handleRemovePosAttrBtn(attr.inputId)}>
                                    <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/close-icon.svg')}
                                            alt={he.translate('wordlist__remove_attribute')} />
                                </a> :
                                null
                            }
                        </li>
                    ),
                    props.wposattrs
                )}
                {List.size(props.wposattrs) < 3 && props.enabled ?
                    <li className="add-btn">
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
            </S.MultiLevelPosAttrUL>
        );
    }

    // --------------------- <OutputType /> -------------------------------

    const OutputType:React.FC<{
        wltype:string;
        allowsMultilevelWltype:boolean;
        wlattr:string;
        attrList:Array<Kontext.AttrItem>;
        wposattrs:Array<MultiposAttr>;
        maxNumWlPosattrLevels:number;

    }> = (props) => {

        const handleOutTypeChange = (evt) => {
            dispatcher.dispatch<typeof Actions.WordlistFormSetWltype>({
                name: Actions.WordlistFormSetWltype.name,
                payload: {
                    value: evt.target.value
                }
            });
        }

        return (
            <>
                <label id="wl-output-type-sel">
                    {he.translate('wordlist__output_type_title')}:
                </label>
                <div className="output-types" aria-labelledby="wl-output-type-sel">
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
                                        maxNumLevels={props.maxNumWlPosattrLevels} />
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
                </div>
            </>
        );
    };

    // --------------------- <FieldsetOutputOptions /> ----------------------

    const FieldsetOutputOptions:React.FC<{
        wlnums:string;
        attrList:Array<Kontext.AttrItem>;
        wposattrs:Array<MultiposAttr>;
        maxNumWlPosattrLevels:number;
        wltype:string;
        wlattr:string;
        allowsMultilevelWltype:boolean;
        formVisible:boolean;
        handleClick:()=>void;

    }> = (props) => {

        return (
            <S.FieldsetOutputOptions aria-labelledby="wlform-output-options">

                <SC.ExpandableSectionLabel id="wlform-output-options" >
                    <layoutViews.ExpandButton isExpanded={props.formVisible} onClick={props.handleClick} />
                        <a onClick={props.handleClick}>
                            {he.translate('wordlist__out_opts_fieldset_legend')}
                        </a>
                </SC.ExpandableSectionLabel>
                {props.formVisible ?
                    <div className="contents">
                        <FrequencyFigures wlnums={props.wlnums} />
                        <OutputType attrList={props.attrList} wposattrs={props.wposattrs}
                                    maxNumWlPosattrLevels={props.maxNumWlPosattrLevels}
                                    wltype={props.wltype} wlattr={props.wlattr}
                                    allowsMultilevelWltype={props.allowsMultilevelWltype} />
                    </div> :
                    null
                }
            </S.FieldsetOutputOptions>
        );
    };

    // --------------------- <FilterWordCount /> ----------------------

    const FilterWordCount:React.FC<{
        pfilterWords:string;
        nfilterWords:string;

    }> = (props) => {

        const pcount = List.size(List.filter(v => !!v, props.pfilterWords.split(/\r?\n/)));
        const ncount = List.size(List.filter(v => !!v, props.nfilterWords.split(/\r?\n/)));

        return (
            <S.HeadingListOfFilters>
                {pcount || ncount ? ':' : null}
                <span className="filters">
                    {pcount > 0 ?
                        he.translate('wordlist__positive_{pcount}', {pcount}) :
                        null}
                    {pcount && ncount ? ', ' : null}
                    {ncount > 0 ?
                        he.translate('wordlist__negative_{ncount}', {ncount}) :
                        null}
                </span>
            </S.HeadingListOfFilters>
        );
    };

    // --------------------- <FieldsetFilterOptions /> -----------------------------

    const FieldsetFilterOptions:React.FC<{
        pfilterWords:string;
        pfilterFileName:string;
        nfilterWords:string;
        nfilterFileName:string;
        formVisible:boolean;
        handleClick:()=>void;

    }> = (props) => {
        return (
            <S.FieldsetFilterOptions>
                <SC.ExpandableSectionLabel id="wlform-filter-options">
                    <layoutViews.ExpandButton isExpanded={props.formVisible} onClick={props.handleClick} />
                        <a onClick={props.handleClick}>
                            {he.translate('wordlist__filter_opts_fieldset_legend')}
                        </a>
                    {!props.formVisible ? <FilterWordCount pfilterWords={props.pfilterWords} nfilterWords={props.nfilterWords} /> : null}
                </SC.ExpandableSectionLabel>
                {props.formVisible ?
                    <div className="contents">
                        <FilterFile label={he.translate('wordlist__pfilter_label')} target="pfilter"
                                hasValue={!!props.pfilterWords} fileName={props.pfilterFileName} />
                        <FilterFile label={he.translate('wordlist__nfilter_label')} target="nfilter"
                                                    hasValue={!!props.nfilterWords} fileName={props.nfilterFileName} />
                        <div />
                        <FileFormatHint />
                    </div> :
                    null
                }
            </S.FieldsetFilterOptions>
        )
    }

    // --------------------- <WlminfreqInput /> ----------------------------------

    const WlminfreqInput:React.FC<{
        wlminfreq:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.WordlistFormSetWlminfreq>({
                name: Actions.WordlistFormSetWlminfreq.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <>
                <label htmlFor="wl-min-freq-input">
                    {he.translate('wordlist__min_freq_label')}:
                </label>
                <span>
                    <layoutViews.ValidatedItem invalid={props.wlminfreq.isInvalid}>
                        <input id="wl-min-freq-input" type="text" value={props.wlminfreq.value}
                                onChange={handleInputChange}
                                style={{width: '3em'}} />
                    </layoutViews.ValidatedItem>
                </span>
            </>
        );
    };

    // -------------------- <FilterFileUploadInput /> ----------------------------------------

    const FilterFileUploadInput:React.FC<{
        target:FileTarget;
        ident:string;

    }> = (props) => {

        const handleInputChange = (evt:React.ChangeEvent<{}>) => {
            dispatcher.dispatch<typeof Actions.WordlistFormSetFilter>({
                name: Actions.WordlistFormSetFilter.name,
                payload: {
                    value: evt.target['files'][0],
                    target: props.target
                }
            });
        };

        const handleNewFileClick = (evt) => {
            if (props.target === 'pfilter') {
                dispatcher.dispatch<typeof Actions.WordlistFormCreatePfilter>({
                    name: Actions.WordlistFormCreatePfilter.name
                });

            } else {
                dispatcher.dispatch<typeof Actions.WordlistFormCreateNfilter>({
                    name: Actions.WordlistFormCreateNfilter.name
                });
            }
        }

        return (
            <span>
                <a onClick={handleNewFileClick}>{he.translate('wordlist__create_filter_list')}</a>
                {'\u00a0/\u00a0'}<input id={props.ident} type="file" onChange={handleInputChange} />
            </span>
        );

    };

    // -------------------- <ExistingFileOps /> ----------------------------------------

    const ExistingFileOps:React.FC<{
        target:FileTarget;
        fileName:string;

    }> = (props) => {

        const handleRemoveClick = (evt) => {
            dispatcher.dispatch<typeof Actions.WordlistFormClearFilterFile>({
                name: Actions.WordlistFormClearFilterFile.name,
                payload: {
                    target: props.target
                }
            });
        };

        const handleEditorEnableClick = (evt) => {
            dispatcher.dispatch<typeof Actions.WordlistFormReopenEditor>({
                name: Actions.WordlistFormReopenEditor.name,
                payload: {
                    target: props.target
                }
            });
        };

        return (
            <S.ExistingFileOps>
                <span className="active-file">{props.fileName}</span>
                {'\u00a0'}
                <a onClick={handleEditorEnableClick}>
                    {he.translate('global__edit')}
                </a>
                {'\u00a0'}
                <a onClick={handleRemoveClick}>
                    {he.translate('global__remove')}
                </a>
            </S.ExistingFileOps>
        );
    };

    // -------------------- <ListUploadInput /> ----------------------------------------

    const FilterFile:React.FC<{
        label:string;
        hasValue:boolean;
        target:FileTarget;
        fileName:string;

    }> = (props) => {

        return (
            <>
                <label htmlFor={`filter-file-${props.label}`}>
                    {props.label}:{'\u00a0'}
                </label>
                {props.hasValue ?
                    <ExistingFileOps target={props.target} fileName={props.fileName} /> :
                    <FilterFileUploadInput ident={`filter-file-${props.label}`} target={props.target} />
                }
            </>
        );
    };

    // -------------------- <FileEditor /> ----------------------------------------

    /**
     *
     */
    const FileEditor:React.FC<{
        data:{
            fileName:string;
            data:string;
        }
    }> = (props) => {

        const handleClose = () => {
            dispatcher.dispatch<typeof Actions.WordlistFormCloseEditor>({
                name: Actions.WordlistFormCloseEditor.name
            });
        };

        const handleWriting = (evt) => {
            dispatcher.dispatch<typeof Actions.WordlistFormUpdateEditor>({
                name: Actions.WordlistFormUpdateEditor.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        const handleKeyDown = (evt:React.KeyboardEvent<{}>) => {
            if (evt.key === Keyboard.Value.ENTER) {
                if (evt.ctrlKey) {
                    dispatcher.dispatch<typeof Actions.WordlistFormUpdateEditor>({
                        name: Actions.WordlistFormUpdateEditor.name,
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
                    <S.FileEditor>
                        <p className="note">
                            {he.translate('wordlist__use_ctrl_enter_for_newline')}
                        </p>
                        <textarea rows={30} cols={80} value={props.data.data} onChange={handleWriting}
                            onKeyDown={handleKeyDown} ref={item => item ? item.focus() : null} />
                        <br/>
                        <button className="default-button" onClick={handleClose}>
                            {he.translate('global__ok')}
                        </button>
                    </S.FileEditor>
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    }

    // --------------- <IncludeNonWordsCheckbox /> ------------------------

    const IncludeNonWordsCheckbox:React.FC<{
        value:boolean;

    }> = (props) => {

        const handleChange = (value:boolean) => {
            dispatcher.dispatch<typeof Actions.WordlistFormSetIncludeNonwords>({
                name: Actions.WordlistFormSetIncludeNonwords.name,
                payload: {
                    value
                }
            });
        };

        return (
            <>
                <label htmlFor="wl-include-non-words-checkbox">
                    {he.translate('wordlist__incl_non_word_label')}:
                </label>
                <S.IncludeNonWordsCheckboxSpan>
                    <layoutViews.ToggleSwitch checked={props.value} onChange={handleChange}
                        id="wl-include-non-words-checkbox"/>
                </S.IncludeNonWordsCheckboxSpan>
            </>
        );
    };

    // --------------- <FileFormatHint /> ------------------------

    class FileFormatHint extends React.Component<{},
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
                <S.FileFormatHint>
                    <label>
                        {this.state.hintVisible ?
                            (<layoutViews.PopupBox onCloseClick={this._handleCloseClick}
                                    customStyle={{width: '20em'}}>
                                <p>{he.translate('wordlist__pn_filter_lists')}</p>
                            </layoutViews.PopupBox>) : null}
                    </label>
                    <layoutViews.StatusIcon status="info" inline={true} htmlClass="info" />
                    <span className="help">
                        <a className="hint" onClick={this._handleClick}>
                            {he.translate('wordlist__req_file_format_link')}
                        </a>
                    </span>
                </S.FileFormatHint>
            );
        }
    }

    // --------------- <WordListForm /> ------------------------

    class WordListForm extends React.PureComponent<WordlistFormState> {

        constructor(props) {
            super(props);
            this._handleSubmitClick = this._handleSubmitClick.bind(this);
            this._handleKeyPress = this._handleKeyPress.bind(this);
            this._handleOptionsLegendClick = this._handleOptionsLegendClick.bind(this);
            this._handleFiltersLegendClick = this._handleFiltersLegendClick.bind(this);
        }

        _handleSubmitClick() {
            dispatcher.dispatch<typeof Actions.WordlistFormSubmit>({
                name: Actions.WordlistFormSubmit.name
            });
        }

        _handleKeyPress(evt) {
            if (evt.key === Keyboard.Value.ENTER) {
                evt.preventDefault();
                evt.stopPropagation();
                this._handleSubmitClick();
            }
        }

        _handleOptionsLegendClick() {
            dispatcher.dispatch<typeof Actions.ToggleOutputOptions>({
                name: Actions.ToggleOutputOptions.name
            });
        }

        _handleFiltersLegendClick() {
            dispatcher.dispatch<typeof Actions.ToggleFilterOptions>({
                name: Actions.ToggleFilterOptions.name
            });
        }

        render() {
            return (
                <S.WordListForm onKeyDown={this._handleKeyPress}>
                    {this.props.filterEditorData.target !== 'empty' ?
                        <FileEditor data={this.props.filterEditorData} /> :
                        null
                    }
                    <div>
                        {CorparchWidget ? <CorparchWidget /> : null}
                    </div>
                    <S.MainFieldset>
                        <AttrSelector attrList={this.props.attrList}
                                structAttrList={this.props.structAttrList}
                                wlattr={this.props.wlattr} />
                        <WlpatternInput wlpat={this.props.wlpat} />
                        <WlminfreqInput wlminfreq={this.props.wlminfreq} />
                        <IncludeNonWordsCheckbox value={this.props.includeNonwords} />
                    </S.MainFieldset>
                    <FieldsetFilterOptions
                            pfilterWords={this.props.pfilterWords}
                            pfilterFileName={this.props.pfilterFileName}
                            nfilterWords={this.props.nfilterWords}
                            nfilterFileName={this.props.nfilterFileName}
                            formVisible={this.props.filtersVisible}
                            handleClick={this._handleFiltersLegendClick} />
                    <FieldsetOutputOptions wlnums={this.props.wlnums} wposattrs={this.props.wlposattrs}
                            maxNumWlPosattrLevels={this.props.maxNumWlPosattrLevels}
                            attrList={this.props.attrList} wltype={this.props.wltype} wlattr={this.props.wlattr}
                            allowsMultilevelWltype={this.props.wlnums === WlnumsTypes.FRQ}
                            formVisible={this.props.outputOptionsVisible}
                            handleClick={this._handleOptionsLegendClick} />
                    <div className="buttons">
                        {this.props.isBusy ?
                            <layoutViews.AjaxLoaderBarImage /> :
                            <button className="default-button" type="button"
                                    onClick={this._handleSubmitClick}>
                                {he.translate('wordlist__make_wl_btn')}
                            </button>
                        }
                    </div>
                </S.WordListForm>
            );
        }
    }

    return {
        WordListForm: Bound(WordListForm, wordlistFormModel),
        CorpInfoToolbar
    };
}