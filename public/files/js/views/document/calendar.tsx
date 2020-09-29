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
        onClick:(d:Date)=>void;

    }> = (props) => {

        const isCurrentDay = (d:Date):boolean =>
                d.getFullYear() === props.current.getFullYear() &&
                d.getMonth() === props.current.getMonth() &&
                d.getDate() === props.current.getDate();

        return (
            <tr>
                {pipe(
                    props.days,
                    List.slice(0, 7),
                    List.map((v, i) => (
                        <td key={v ? `d:${v.getTime()}` : `d:${i}`}
                                className={isCurrentDay(v) ? 'current' : null}>
                            <a onClick={() => props.onClick(v)}>{v ? v.getDate() : '?'}</a>
                        </td>
                    ))
                )}
            </tr>
        );
    };

    // -------------------- <Heading /> --------------------------------------------------

    const Heading:React.FC<{}> = (props) => {
        return <tr>{List.map(
            day =>  <th key={`h:${day}`}>{he.translate(`global__${day}_short`)}</th>,
            ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su']
        )}
        </tr>;
    }

    // -------------------- <Calendar /> --------------------------------------------------

    const Calendar:React.FC<{
        onClick:(date:Date)=>void;
        currDate?:Date;

    }> = (props) => {

        const normNow = () => {
            const now = new Date();
            return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        };

        const [currDate, updateState] = React.useState(
            props.currDate ? props.currDate : normNow());

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
            return List.repeat(
                idx => new Date(
                    monthStart.getFullYear(),
                    monthStart.getMonth(),
                    monthStart.getDate() - fday + 1 + idx
                ), fday - 1 + daysOfMonth.getDate() + 7 - lday);
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

        const calData = groupDays(getMonthDays(currDate.getFullYear(), currDate.getMonth()));

        const handleClick = (d:Date) => {
            updateState(d);
            props.onClick(d);
        };

        const handlePrevClick = () => {
            updateState(currDate.getMonth() > 0 ?
                new Date(currDate.getFullYear(), currDate.getMonth() - 1, 1) :
                new Date(currDate.getFullYear() - 1, 11, 1)
            );
        }

        const handleNextClick = () => {
            updateState(currDate.getMonth() < 11 ?
                new Date(currDate.getFullYear(), currDate.getMonth() + 1, 1) :
                new Date(currDate.getFullYear() + 1, 0, 1)
            );
        }

        return (
            <div className="Calendar">
                <table>
                    <thead>
                        <tr className="controls">
                            <td>
                                <ImgWithMouseover src={he.createStaticUrl('img/prev-page.svg')}
                                    alt={he.translate('global__prev_month')}
                                    clickHandler={handlePrevClick} htmlClass="prev-month-change" />
                            </td>
                            <td colSpan={5} className="curr-date">
                                {dateMonthToString(currDate.getMonth())} {currDate.getFullYear()}
                            </td>
                            <td>
                                <ImgWithMouseover src={he.createStaticUrl('img/next-page.svg')}
                                    alt={he.translate('global__next_month')}
                                    clickHandler={handleNextClick} htmlClass="next-month-change" />
                            </td>
                        </tr>
                        <Heading />
                    </thead>
                    <tbody>
                        {List.map(
                            v => <Row key={`row:${v[0].getTime()}`} days={v}
                                        current={currDate} onClick={handleClick} />,
                            calData
                        )}
                    </tbody>
                </table>
            </div>
        )
    };

    return Calendar;

}