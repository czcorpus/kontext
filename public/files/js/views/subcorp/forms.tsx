/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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
import {IActionDispatcher, Bound, BoundWithProps} from 'kombo';
import * as Kontext from '../../types/kontext';
import * as PluginInterfaces from '../../types/plugins';
import { SubcorpFormModel, SubcorpFormModelState } from '../../models/subcorp/form';
import { SubcorpWithinFormModel, SubcorpWithinFormModelState, WithinLine } from '../../models/subcorp/withinForm';
import { TextTypesPanelProps } from '../textTypes';
import { Actions } from '../../models/subcorp/actions';
import { List } from 'cnc-tskit';

import * as S from './style';


export interface FormsModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    CorparchComponent:PluginInterfaces.Corparch.WidgetView;
    subcorpFormModel:SubcorpFormModel;
    subcorpWithinFormModel:SubcorpWithinFormModel;
}

export interface SubcorpFormProps {
    ttProps:TextTypesPanelProps;
    ttComponent:React.ComponentClass<TextTypesPanelProps>;
}

export interface FormViews {
    SubcorpForm:React.ComponentClass<SubcorpFormProps>;
    SubcNamePublicCheckbox:React.SFC<{value:boolean}>;
    SubcDescription:React.SFC<{value:Kontext.FormValue<string>}>;
}

export function init({dispatcher, he, CorparchComponent, subcorpFormModel,
            subcorpWithinFormModel}:FormsModuleArgs):FormViews {

    const layoutViews = he.getLayoutViews();

    // ------------------------------------------- <WithinSwitch /> ----------------------------

    const WithinSwitch:React.FC<{
        rowIdx:number;
        withinType:string;

    }> = (props) => {

        const changeHandler = (evt) => {
            dispatcher.dispatch<typeof Actions.FormWithinLineSetType>({
                name: Actions.FormWithinLineSetType.name,
                payload: {
                    rowIdx: props.rowIdx,
                    value: ({'within': false, '!within': true})[evt.target.value]
                }
            });
        };
        return (
            <select className="code" onChange={changeHandler}
                    value={props.withinType}>
                <option value="within">within</option>
                <option value="!within">!within</option>
            </select>
        );
    };

    // ------------------------------------------- <CloseImg /> ----------------------------

    class CloseImg extends React.Component<{
        onClick:()=>void;
    },
    {
        img:string;
    }> {

        constructor(props) {
            super(props);
            this.state = {img: he.createStaticUrl('img/close-icon.svg')};
            this._onMouseOver = this._onMouseOver.bind(this);
            this._onMouseOut = this._onMouseOut.bind(this);
        }

        _onMouseOver() {
            this.setState({img: he.createStaticUrl('img/close-icon_s.svg')});
        }

        _onMouseOut() {
            this.setState({img: he.createStaticUrl('img/close-icon.svg')});
        }

        render() {
            return <img className="remove-line"
                        onClick={this.props.onClick}
                        onMouseOver={this._onMouseOver}
                        onMouseOut={this._onMouseOut}
                        src={this.state.img}
                        title={he.translate('global__remove_line')} />;
        }
    }

    // ------------------------------------------- <ExpressionDescLine /> ----------------------------

    const ExpressionDescLine:React.FC<{
        viewIdx:number;

    }> = (props) => {

        const createPrevLinkRef = (i) => {
            if (props.viewIdx > 0) {
                return he.translate('global__subc_all_the_matching_tokens_{prev}', {prev: i});

            } else {
                return he.translate('global__subc_all_the_tokens');
            }
        };

        return (
            <tr className="within-rel">
                <td className="line-id" rowSpan={2}>{props.viewIdx + 1})</td>
                    <td colSpan={3}>
                    <span className="set-desc">{createPrevLinkRef(props.viewIdx)}</span>
                </td>
            </tr>
        );
    };

    // ------------------------------------------- <StructLine /> ----------------------------

    const StructLine:React.FC<{
        rowIdx:number;
        structsAndAttrs:Kontext.StructsAndAttrs;
        lineData:WithinLine;

    }> = (props) => {

        const removeHandler = () => {
            dispatcher.dispatch<typeof Actions.FormWithinLineRemoved>({
                name: Actions.FormWithinLineRemoved.name,
                payload: {rowIdx: props.rowIdx}
            });
        };

        const getStructHint = (structName) => {
            return (props.structsAndAttrs[structName] || []).join(', ');
        };

        const handleStructChange = (evt) => {
            dispatcher.dispatch<typeof Actions.FormWithinLineSetStruct>({
                name: Actions.FormWithinLineSetStruct.name,
                payload: {
                    rowIdx: props.rowIdx,
                    value: evt.target.value
                }
            });
        };

        const handleCqlChange = (evt) => {
            dispatcher.dispatch<typeof Actions.FormWithinLineSetCQL>({
                name: Actions.FormWithinLineSetCQL.name,
                payload: {
                    rowIdx: props.rowIdx,
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <td>
                    <WithinSwitch withinType={props.lineData.negated ? '!within' : 'within'} rowIdx={props.rowIdx} />
                    {'\u00a0'}
                    <select value={props.lineData.structureName} onChange={handleStructChange}>
                    {
                        Object.keys(props.structsAndAttrs).map(
                            (item) => <option key={item}
                                                value={item}
                                                title={getStructHint(item)}>{item}</option>
                        )
                    }
                    </select>
                </td>
                <td>
                    <layoutViews.ValidatedItem invalid={props.lineData.attributeCql.isInvalid}>
                        <input type="text" value={props.lineData.attributeCql.value}
                                onChange={handleCqlChange}
                                style={{width: '30em'}} />
                        </layoutViews.ValidatedItem>
                </td>
                <td>
                    {props.rowIdx > 0
                        ? <CloseImg onClick={removeHandler} /> : null
                    }
                </td>
            </tr>
        );
    };

    // ------------------------------------------- <WithinBuilder /> ----------------------------

    const WithinBuilder:React.FC<{
        structsAndAttrs:Kontext.StructsAndAttrs;
        lines:Array<WithinLine>;
    }> = (props) => {

        const addLineHandler = () => {
            dispatcher.dispatch<typeof Actions.FormWithinLineAdded>({
                name: Actions.FormWithinLineAdded.name,
                payload: {
                    negated: false,
                    structureName: Object.keys(props.structsAndAttrs).sort()[0],
                    attributeCql: ''
                }
            });
        };

        return (
            <table className="WithinBuilder">
                <tbody>
                    {List.map((line, i) =>
                        <React.Fragment key ={'wl' + line.rowIdx}>
                            <ExpressionDescLine viewIdx={i} />
                            <StructLine rowIdx={line.rowIdx}
                                lineData={line} structsAndAttrs={props.structsAndAttrs} />
                        </React.Fragment>,
                        props.lines
                    )}
                    <tr className="button-row">
                        <td>
                            <a className="add-within"
                                    onClick={addLineHandler}
                                    title={he.translate('global__add_within')}>
                                <img src={he.createStaticUrl('img/plus.svg')} style={{width: '1em'}} />
                            </a>
                        </td>
                        <td></td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        );
    };


    // ------------------------------------------- <TRWithinBuilderWrapper /> ----------------------------

    class TRWithinBuilderWrapper extends React.PureComponent<SubcorpWithinFormModelState> {

        constructor(props) {
            super(props);
            this._handleHelpClick = this._handleHelpClick.bind(this);
            this._handleHelpCloseClick = this._handleHelpCloseClick.bind(this);
        }

        _handleHelpClick() {
            dispatcher.dispatch<typeof Actions.FormShowRawWithinHint>({
                name: Actions.FormShowRawWithinHint.name,
                payload: {}
            });
        }

        _handleHelpCloseClick() {
            dispatcher.dispatch<typeof Actions.FormHideRawWithinHint>({
                name: Actions.FormHideRawWithinHint.name,
                payload: {}
            });
        }

        render() {
            return (
                <S.TRWithinBuilderWrapper>
                    <div>
                        <a id="custom-within-hint" onClick={this._handleHelpClick}>
                            <img className="over-img" src={he.createStaticUrl('img/question-mark.svg')} />
                        </a>
                        {this.props.helpHintVisible ?
                            <StructsHint structsAndAttrs={this.props.structsAndAttrs}
                                    onCloseClick={this._handleHelpCloseClick} /> :
                            null
                        }
                    </div>
                    <div className="container">
                        <WithinBuilder lines={this.props.lines} structsAndAttrs={this.props.structsAndAttrs} />
                    </div>
                </S.TRWithinBuilderWrapper>
            );
        }
    }

    const BoundTRWithinBuilderWrapper = Bound(TRWithinBuilderWrapper, subcorpWithinFormModel);

    /**
     *
     */
    const SubcNameInput:React.FC<{
        value:Kontext.FormValue<string>;
    }> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch<typeof Actions.FormSetSubcName>({
                name: Actions.FormSetSubcName.name,
                payload: {value: evt.target.value}
            });
        };

        return <layoutViews.ValidatedItem invalid={props.value.isInvalid}>
                <input type="text" value={props.value.value} onChange={handleChange} />
            </layoutViews.ValidatedItem>;
    };

    // ------------------------ <SubcNamePublicCheckbox /> --------------------------

    const SubcNamePublicCheckbox:React.FC<{
        value:boolean;

    }> = (props) => {

        const handleCheckbox = (evt) => {
            dispatcher.dispatch<typeof Actions.FormSetSubcAsPublic>({
                name: Actions.FormSetSubcAsPublic.name,
                payload: {
                    value: !props.value
                }
            });
        };

        return <input type="checkbox" onChange={handleCheckbox} checked={props.value}
                    style={{verticalAlign: 'middle'}} />;
    };

    // ------------------------ <SubcDescription /> --------------------------

    const SubcDescription:React.FC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleChange = (evt:React.ChangeEvent<HTMLTextAreaElement>) => {
            dispatcher.dispatch<typeof Actions.FormSetDescription>({
                name: Actions.FormSetDescription.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return <>
            <layoutViews.ValidatedItem invalid={props.value.isInvalid}>
                <textarea rows={5} cols={60} value={props.value.value} onChange={handleChange} />
            </layoutViews.ValidatedItem>
            <p className="note">({he.translate('global__markdown_supported')})</p>
            </>;
    };

    /**
     */
    const StructsHint:React.FC<{
        structsAndAttrs:Kontext.StructsAndAttrs;
        onCloseClick:()=>void;

    }> = (props) => {

        const renderAttrs = () => {
            const ans = [];
            for (let p in props.structsAndAttrs) {
                ans.push(<li key={p}><strong>{p}</strong>:{'\u00a0'}{props.structsAndAttrs[p].join(', ')}</li>);
            }
            return ans;
        };

        const css:React.CSSProperties = {
            position: 'absolute',
            maxWidth: '20em',
            fontWeight: 'normal',
            textAlign: 'left'
        };

        return (
            <layoutViews.PopupBox onCloseClick={props.onCloseClick}
                        customStyle={css}>
                <div>
                    {he.translate('global__within_hint_text')}
                </div>
                <ul>
                    {renderAttrs()}
                </ul>
            </layoutViews.PopupBox>
        );
    };

    /**
     *
     */
    class SubcorpForm extends React.Component<SubcorpFormProps & SubcorpFormModelState> {

        constructor(props) {
            super(props);
            this._handleInputModeChange = this._handleInputModeChange.bind(this);
            this._handleSubmitClick = this._handleSubmitClick.bind(this);
        }

        _handleInputModeChange(v) {
            dispatcher.dispatch<typeof Actions.FormSetInputMode>({
                name: Actions.FormSetInputMode.name,
                payload: {
                    value: v
                }
            });
        }

        _handleSubmitClick() {
            dispatcher.dispatch<typeof Actions.FormSubmit>({
                name: Actions.FormSubmit.name,
                payload: {}
            });
        }

        render() {
            return (
                <S.SubcorpForm>
                    <table className="form">
                        <tbody>
                            <tr>
                                <th>
                                    {he.translate('global__corpus')}:
                                </th>
                                <td>
                                    <CorparchComponent />
                                    <div className="starred"></div>
                                </td>
                            </tr>
                            <tr className="required">
                                <th style={{width: '20%'}}>
                                    {he.translate('global__new_subcorpus_name_lab')}:
                                </th>
                                <td style={{width: '80%'}}>
                                    <SubcNameInput value={this.props.subcname} />
                                </td>
                            </tr>
                            <tr>
                                <th>
                                    {he.translate('subcform__set_as_public')}:
                                    <layoutViews.InlineHelp customStyle={{width: '20em'}} noSuperscript={true}>
                                        <p>{he.translate('subcform__publication_notes')}</p>
                                        <p>{he.translate('subcform__publication_notes_2')}</p>
                                    </layoutViews.InlineHelp>
                                </th>
                                <td>
                                    <SubcNamePublicCheckbox value={this.props.isPublic} />
                                </td>
                            </tr>
                            {this.props.isPublic ?
                                (<tr>
                                    <th>{he.translate('subcform__public_description')}:</th>
                                    <td>
                                        <SubcDescription value={this.props.description} />
                                    </td>
                                </tr>) : null
                            }
                        </tbody>
                    </table>
                    <div className="data-sel">
                        <layoutViews.TabView
                                className="FreqFormSelector"
                                defaultId={this.props.inputMode}
                                callback={this._handleInputModeChange}
                                items={[
                                    {
                                        id: 'gui',
                                        label: he.translate('subcform__mode_attr_list')
                                    },
                                    {
                                        id: 'within',
                                        label: he.translate('subcform__mode_raw_within')
                                    }]}>
                            <this.props.ttComponent {...this.props.ttProps} />
                            <BoundTRWithinBuilderWrapper  />
                        </layoutViews.TabView>
                        <div id="subc-mixer-row">
                            <div className="widget"></div>
                        </div>
                    </div>
                    {this.props.isBusy ?
                        <layoutViews.AjaxLoaderBarImage /> :
                        <p>
                        <button className="default-button" type="button"
                                onClick={this._handleSubmitClick}>
                            {he.translate('subcform__create_subcorpus')}
                        </button>
                        </p>
                    }
                </S.SubcorpForm>
            );
        }
    }

    return {
        SubcorpForm: BoundWithProps(SubcorpForm, subcorpFormModel),
        SubcNamePublicCheckbox: SubcNamePublicCheckbox,
        SubcDescription: SubcDescription
    };
}