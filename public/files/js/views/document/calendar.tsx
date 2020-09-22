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

import { List, pipe, tuple } from 'cnc-tskit';
import * as React from 'react';

import { Kontext } from '../../types/common';
import { ImgWithMouseover } from './general';


export interface CalendarProps {
    onClick:(year:number, month:number, day:number)=>void;
}


export function rangeToRegexp(d1:Date, d2:Date):string {

    function packDays(data:Array<Date>) {
        return List.foldl(
            ([,,days], curr) => tuple(
                curr.getFullYear().toFixed(),
                md2str(curr.getMonth()),
                days.concat([md2str(curr.getDate())])
            ),
            ['', '', []] as [string, string, Array<string>],
            data
        );
    }

    function packMonths(data:Array<Date>) {
        return List.foldl(
            ([,months], curr) => tuple(
                curr.getFullYear().toFixed(),
                months.concat([md2str(curr.getMonth())])
            ),
            ['', []] as [string, Array<string>],
            data
        );
    }

    function md2str(v:number):string {
        return (v < 10 ? '0' : '') + v;
    }

    const toEndOfMonth1:Array<Date> = [];
    let md = new Date(d1);
    while (md.getMonth() === d1.getMonth() && md.getTime() < d2.getTime()) {
        toEndOfMonth1.push(md);
        md = new Date(md);
        md.setDate(md.getDate() + 1);
    }
    const toEndOfYear1:Array<Date> = [];
    while (md.getFullYear() === d1.getFullYear() && md.getTime() < d2.getTime()) {
        toEndOfYear1.push(md);
        md = new Date(md);
        md.setMonth(md.getMonth() + 1);
    }
    const toTargetYear:Array<Date> = [];
    while (md.getFullYear() < d2.getFullYear()) {
        toTargetYear.push(md);
        md = new Date(md);
        md.setFullYear(md.getFullYear() + 1);
    }
    const toTargetMonth:Array<Date> = [];
    while (md.getMonth() < d2.getMonth()) {
        toTargetMonth.push(md);
        md = new Date(md);
        md.setMonth(md.getMonth() + 1);
    }
    const toTargetDay:Array<Date> = [];
    while (md.getDate() <= d2.getDate()) {
        toTargetDay.push(md);
        md = new Date(md);
        md.setDate(md.getDate() + 1);
    }

    const comp1 = packDays(toEndOfMonth1);
    const comp2 = packMonths(toEndOfYear1);
    const comp3 = List.map(
        item => item.getFullYear(),
        toTargetYear
    );
    const comp4 = packMonths(toTargetMonth);
    const comp5 = packDays(toTargetDay);

    const ans = [];
    if (!List.empty(comp1[2])) {
        ans.push(`${comp1[0]}-${comp1[1]}-(${comp1[2].join('|')})`);
    }
    if (!List.empty(comp2[1])) {
        ans.push(`${comp2[0]}-(${comp2[1].join('|')})-..`);
    }
    if (!List.empty(comp3)) {
        ans.push(`(${comp3.join('|')})-..-..`);
    }
    if (!List.empty(comp4[1])) {
        ans.push(`${comp4[0]}-(${comp4[1].join('|')})-..`);
    }
    if (!List.empty(comp5[2])) {
        ans.push(`${comp5[0]}-${comp5[1]}-(${comp5[2].join('|')})`);
    }
    return ans.join('|');
}

export function init(he:Kontext.ComponentHelpers):React.FC<CalendarProps> {

    const dateMonthToString = (m:number):string => {
        const map = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        return he.translate(`global__${map[m]}_full`);
    };

    // -------------------- <Row /> --------------------------------------------------

    const Row:React.FC<{
        days:Array<Date>
        onClick:(d:Date)=>void;

    }> = (props) => {
        return (
            <tr>
                {pipe(
                    props.days,
                    List.slice(0, 7),
                    List.map((v, i) => (
                        <td key={v ? `d:${v.getTime()}` : `d:${i}`}>
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
        onClick:(year:number, month:number, day:number)=>void;

    }> = (props) => {

        const now = new Date();
        const [currState, updateState] = React.useState({
            month: now.getMonth(),
            year: now.getFullYear()
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

        const calData = groupDays(getMonthDays(currState.year, currState.month));

        const handleClick = (d:Date) => {
            props.onClick(d.getFullYear(), d.getMonth() + 1, d.getDate());
        };

        const handlePrevClick = () => {
            updateState({
                month: currState.month > 0 ? currState.month - 1 : 11,
                year: currState.month > 0 ? currState.year : currState.year - 1,
            })
        }

        const handleNextClick = () => {
            updateState({
                month: currState.month < 11 ? currState.month + 1 : 0,
                year: currState.month < 11 ? currState.year : currState.year + 1,
            })
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
                                {dateMonthToString(currState.month)} {currState.year}
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
                            v => <Row key={`row:${v[0].getTime()}`} days={v} onClick={handleClick} />,
                            calData
                        )}
                    </tbody>
                </table>
            </div>
        )
    };

    return Calendar;

}