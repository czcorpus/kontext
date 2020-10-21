/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

import { List } from 'cnc-tskit';
import * as React from 'react';

import { Kontext } from '../../types/common';
import { CoreViews } from '../../types/coreViews';



export function init(he:Kontext.ComponentHelpers):React.FC<CoreViews.KwicRangeSelector.Props> {


    // -------------------------- <KwicRangeSelector /> -----------------------------------

    const KwicRangeSelector:CoreViews.KwicRangeSelector.Component = (props) => {

        const [state, setState] = React.useState({
            leftRange: props.initialLeft || 0,
            rightRange: props.initialRight || 0,
            leftInput: Kontext.newFormValue('', false),
            rightInput: Kontext.newFormValue('', false),
        });

        const handleClick = (e:React.MouseEvent) => {
            const target = e.target as HTMLAnchorElement;
            if (target.tagName === 'A') {
                const val = parseInt(target.getAttribute('data-idx'));
                if (val < 0) {
                    setState({
                        ...state,
                        leftRange: val === state.leftRange ? 0 : val
                    });
                    props.onClick(val === state.leftRange ? 0 : val, state.rightRange, false); // TODO 3rd arg

                } else if (val > 0) {
                    setState({
                        ...state,
                        rightRange: val === state.rightRange ? 0 : val
                    });
                    props.onClick(state.leftRange, val === state.rightRange ? 0 : val, false); // TODO 3rd arg
                }
            }
        };

        const handleKwicClick = () => {
            setState({
                ...state,
                leftRange: 0,
                rightRange: 0
            });
            props.onClick(state.leftRange, state.rightRange, false); // TODO 3rd arg
        };

        const posClass = (idx:number, customClass?:string) => {
            if ((idx < 0 && idx >= state.leftRange) ||
                    (idx > 0 && idx <= state.rightRange)) {
                return `pos selected${customClass ? ' ' + customClass : ''}`;
            }
            return `pos${customClass ? ' ' + customClass : ''}`;
        };

        const validateInput = (
            input:Kontext.FormValue<string>,
            rngType:'left'|'right'
        ):Kontext.FormValue<string> => {

            if (input.value === '') {
                return input;
            }
            const val = parseInt(input.value);
            if (isNaN(val)) {
                return Kontext.updateFormValue(input, {
                    isInvalid: true,
                    errorDesc: he.translate('global__invalid_number_format')
                });
            }
            if (rngType === 'left') {
                if (val >= -props.rangeSize || val >= 0) {
                    return Kontext.updateFormValue(input, {
                        isInvalid: true,
                        errorDesc: he.translate(
                            'global__number_must_be_less_than_{val}',
                            {val: -props.rangeSize}
                        )
                    });
                }
            }
            if (rngType === 'right') {
                if (val <= props.rangeSize || val <= 0) {
                    return Kontext.updateFormValue(input, {
                        isInvalid: true,
                        errorDesc: he.translate(
                            'global__number_must_be_greater_than_{val}',
                            {val: props.rangeSize}
                        )
                    });
                }
            }
            return Kontext.updateFormValue(input, {isInvalid: false});
        }

        const handleLeftInputChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            const leftInput = validateInput(
                Kontext.updateFormValue(state.leftInput, {value: evt.target.value}),
                'left'
            );
            setState({
                ...state,
                leftInput,
                leftRange: leftInput.isInvalid ? state.leftRange : parseInt(leftInput.value)
            });
            if (!leftInput.isInvalid) {
                props.onClick(parseInt(leftInput.value), state.rightRange, false); // TODO 3rd arg
            }
        };

        const handleRightInputChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            const rightInput = validateInput(
                Kontext.updateFormValue(state.rightInput, {value: evt.target.value}),
                'right'
            );
            setState({
                ...state,
                rightInput,
                rightRange: rightInput.isInvalid ? state.rightRange : parseInt(rightInput.value)
            });
            if (!rightInput.isInvalid) {
                props.onClick(state.leftRange, parseInt(rightInput.value), false); // TODO 3rd arg
            }
        };

        return (
            <div className="KwicRangeSelector">
                <div className="items" onClick={handleClick}>
                    <div className={`${state.leftRange === parseInt(state.leftInput.value) ? 'selected' : null}`}
                            title={state.leftInput.isInvalid ? state.leftInput.errorDesc : null}>
                        <input className={`manual-range${state.leftInput.isInvalid ? ' invalid' : ''}`}
                            type="text" value={state.leftInput.value}
                            onChange={handleLeftInputChange}
                            onFocus={handleLeftInputChange} />
                    </div>
                    <div>{'\u2026'}</div>
                    {List.repeat(
                        (idx) => {
                            const v = idx - props.rangeSize;
                            return (
                                <div className={posClass(v, idx === 0 ? 'left-lim' : '')} key={`left-${v}}`}>
                                    <a data-idx={v}>{v}</a>
                                </div>
                            );
                        },
                        props.rangeSize
                    )}
                    <div className="pos kwic">
                        {props.isKwicExcluded ?
                            <span>KWIC</span> :
                            <a onClick={handleKwicClick}>KWIC</a>
                        }
                    </div>
                    {List.repeat(
                        idx => {
                            const v = idx + 1;
                            return (
                                <div className={posClass(v, idx === props.rangeSize - 1 ? 'right-lim' : '')} key={`right-${v}}`}>
                                    <a data-idx={v}>{v}</a>
                                </div>
                            );
                        },
                        props.rangeSize
                    )}
                    <div>{'\u2026'}</div>
                    <div className={`${state.rightRange === parseInt(state.rightInput.value) ? 'selected' : null}`}
                            title={state.rightInput.isInvalid ? state.rightInput.errorDesc : null}>
                        <input className={`manual-range${state.rightInput.isInvalid ? ' invalid' : ''}`}
                            type="text" value={state.rightInput.value}
                            onChange={handleRightInputChange}
                            onFocus={handleRightInputChange} />
                    </div>
                </div>
            </div>
        );
    };

    return KwicRangeSelector;

}