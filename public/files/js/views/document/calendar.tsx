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

import { List, pipe } from 'cnc-tskit';
import * as React from 'react';

import { Kontext } from '../../types/common';
import { ImgWithMouseover } from './general';
import { CoreViews } from '../../types/coreViews';



export function init(he:Kontext.ComponentHelpers):React.FC<CoreViews.Calendar.Props> {

    const dateMonthToString = (m:number):string => {
        const map = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        return he.translate(`global__${map[m]}_full`);
    };

    // -------------------- <Row /> --------------------------------------------------

    const Row:React.FC<{
        days:Array<Date>;
        current:Date;
        isActive:boolean;
        onClick:(d:Date)=>void;

    }> = (props) => {

        const isCurrentDay = (d:Date):boolean =>
                d.getFullYear() === props.current.getFullYear() &&
                d.getMonth() === props.current.getMonth() &&
                d.getDate() === props.current.getDate();

        const isCurrentMonth = (d:Date):boolean =>
                props.current.getMonth() === d.getMonth();

        const determineClass = (v:Date) => {
            if (isCurrentDay(v)) {
                return `current${props.isActive ? ' active' : ''}`;
            }
            return null;
        };

        return (
            <tr>
                {pipe(
                    props.days,
                    List.slice(0, 7),
                    List.map((v, i) => (
                        <td key={v ? `d:${v.getTime()}` : `d:${i}`}
                                className={determineClass(v)}>
                            <a onClick={() => props.onClick(v)}
                                style={isCurrentMonth(v) ? null : {color: 'gray'}}
                            >{v ? v.getDate() : '?'}</a>
                        </td>
                    ))
                )}
            </tr>
        );
    };

    // -------------------- <Heading /> --------------------------------------------------

    const Heading:React.FC<{
        firstDayOfWeek:'mo'|'su'|'sa';
    }> = (props) => {
        const days = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];
        const dayIndex = List.findIndex(v => v === props.firstDayOfWeek, days);
        return <tr>{List.map(
            day =>  <th key={`h:${day}`}>{he.translate(`global__${day}_short`)}</th>,
            List.concat(List.slice(0, dayIndex, days), List.slice(dayIndex, 7, days))
        )}
        </tr>;
    }

    // -------------------- <Calendar /> --------------------------------------------------

    const Calendar:React.FC<{
        onClick:(date:Date|null)=>void;
        currDate?:Date;
        firstDayOfWeek?:'mo'|'su'|'sa';

    }> = (props) => {

        const normNow = () => {
            const now = new Date();
            return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        };

        const [state, updateState] = React.useState({
            currDate: props.currDate ? props.currDate : normNow(),
            isSelected: !!props.currDate
        });

        const getMonthDays = (year:number, month:number):Array<Date> => {
            const monthStart = new Date(year, month, 1, 0, 0, 0);
            const fday = monthStart.getDay();
            const monthEnd = new Date(year, month + 1, 0, 0, 0, 0);
            const lday = monthEnd.getDay();
            const daysOfMonth = new Date(
                monthStart.getFullYear(),
                monthStart.getMonth() + 1,
                0
            );
            const startDayId = props.firstDayOfWeek === 'mo' ? 1 :
                             props.firstDayOfWeek === 'su' ? 0 :
                             props.firstDayOfWeek === 'sa' ? 6 :
                             1;
            const endDayId = startDayId === 0 ? 6 : startDayId - 1;
            const startFillDays = startDayId > fday ? fday - startDayId + 7 : fday - startDayId;
            const endFillDays = endDayId < lday ? endDayId - lday + 7 : endDayId - lday;
            return List.repeat(
                idx => new Date(
                    monthStart.getFullYear(),
                    monthStart.getMonth(),
                    monthStart.getDate() - startFillDays + idx
                ), startFillDays + daysOfMonth.getDate() + endFillDays);
        }

        const groupDays = (data:Array<Date>):Array<Array<Date>> => {
            let i = 0;
            const ans = [];
            for (i; i < data.length;) {
                const w = [];
                for (let j = 0; j < 7; j++, i++) {
                    w.push(data[i]);
                }
                ans.push(w);
            }
            return ans;
        }

        const calData = groupDays(getMonthDays(state.currDate.getFullYear(),
                state.currDate.getMonth()));

        const datesEqual = (d1:Date, d2:Date) => {
            return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() &&
                    d1.getDate() === d2.getDate();
        };

        const handleClick = (d:Date|null) => {
            updateState({
                currDate: d,
                isSelected: datesEqual(d, state.currDate) ? !state.isSelected : true
            });
            props.onClick(datesEqual(d, state.currDate) && state.isSelected ? null : d);
        };

        const handlePrevClick = () => {
            updateState({
                currDate: state.currDate.getMonth() > 0 ?
                    new Date(state.currDate.getFullYear(), state.currDate.getMonth() - 1, 1) :
                    new Date(state.currDate.getFullYear() - 1, 11, 1),
                isSelected: false
            });
            props.onClick(null);
        };

        const handleNextClick = () => {
            updateState({
                currDate: state.currDate.getMonth() < 11 ?
                    new Date(state.currDate.getFullYear(), state.currDate.getMonth() + 1, 1) :
                    new Date(state.currDate.getFullYear() + 1, 0, 1),
                isSelected: false
            });
            props.onClick(null);
        };

        return (
            <div className="Calendar">
                <table>
                    <thead>
                        <tr className="controls">
                            <td>
                                <a className="prev-month-change" onClick={handlePrevClick}>
                                    <ImgWithMouseover src={he.createStaticUrl('img/prev-page.svg')}
                                        alt={he.translate('global__prev_month')} />
                                </a>
                            </td>
                            <td colSpan={5} className="curr-date">
                                {dateMonthToString(state.currDate.getMonth())} {state.currDate.getFullYear()}
                            </td>
                            <td>
                                <a className="next-month-change" onClick={handleNextClick}>
                                    <ImgWithMouseover src={he.createStaticUrl('img/next-page.svg')}
                                        alt={he.translate('global__next_month')} />
                                </a>
                            </td>
                        </tr>
                        <Heading firstDayOfWeek={props.firstDayOfWeek ? props.firstDayOfWeek : 'mo'} />
                    </thead>
                    <tbody>
                        {List.map(
                            v => <Row key={`row:${v[0].getTime()}`} days={v}
                                        current={state.currDate} isActive={state.isSelected}
                                            onClick={handleClick} />,
                            calData
                        )}
                    </tbody>
                </table>
            </div>
        )
    };

    return Calendar;

}