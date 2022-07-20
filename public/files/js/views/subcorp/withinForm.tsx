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
import {IActionDispatcher, Bound} from 'kombo';
import * as Kontext from '../../types/kontext';
import { SubcorpWithinFormModel, SubcorpWithinFormModelState, WithinLine } from '../../models/subcorp/withinForm';
import { TextTypesPanelProps } from '../textTypes';
import { Actions } from '../../models/subcorp/actions';
import { Dict, List, pipe } from 'cnc-tskit';

import * as S from './style';


export interface SubcorpFormProps {
    ttProps:TextTypesPanelProps;
    ttComponent:React.ComponentClass<TextTypesPanelProps>;
}

export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    subcorpWithinFormModel:SubcorpWithinFormModel
):React.ComponentClass<{}, SubcorpWithinFormModelState> {

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

        const getStructHint = (structName:string):string => {
            return pipe(
                props.structsAndAttrs[structName] || [],
                List.map(v => v.name),
                v => v.join(', ')
            );
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
                        pipe(
                            props.structsAndAttrs,
                            Dict.keys(),
                            List.map(
                                item => (
                                    <option key={item}
                                        value={item}
                                        title={getStructHint(item)}>{item}</option>
                                )
                            )
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
    }> = ({ structsAndAttrs, lines }) => {

        const addLineHandler = () => {
            dispatcher.dispatch<typeof Actions.FormWithinLineAdded>({
                name: Actions.FormWithinLineAdded.name,
                payload: {
                    negated: false,
                    structureName: pipe(
                        structsAndAttrs,
                        Dict.keys(),
                        List.sortAlphaBy(v => v),
                        List.head()
                    ),
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
                                lineData={line} structsAndAttrs={structsAndAttrs} />
                        </React.Fragment>,
                        lines
                    )}
                    <tr className="button-row">
                        {Dict.empty(structsAndAttrs) ?
                            <td colSpan={3}>
                                {he.translate('global__corpus_has_no_structattrs')}
                            </td> :
                            <>
                                <td>
                                    <a className="add-within"
                                            onClick={addLineHandler}
                                            title={he.translate('global__add_within')}>
                                        <img src={he.createStaticUrl('img/plus.svg')} style={{width: '1em'}} />
                                    </a>
                                </td>
                                <td></td>
                                <td></td>
                            </>
                        }
                    </tr>
                </tbody>
            </table>
        );
    };

    // --------------- <StructsHint /> -----------------

    const StructsHint:React.FC<{
        structsAndAttrs:Kontext.StructsAndAttrs;
        onCloseClick:()=>void;

    }> = (props) => {

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
                    {pipe(
                        props.structsAndAttrs,
                        Dict.toEntries(),
                        List.map(([struct, items]) => (
                            <li key={struct}><strong>{struct}</strong>:{'\u00a0'}{List.map(v => v.name, items).join(', ')}</li>
                        ))
                    )}
                </ul>
            </layoutViews.PopupBox>
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

    return Bound(TRWithinBuilderWrapper, subcorpWithinFormModel);
}