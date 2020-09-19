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

import { Keyboard, Client, List, pipe } from 'cnc-tskit';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { IActionDispatcher, BoundWithProps } from 'kombo';

import { Kontext } from '../../types/common';
import { CoreViews } from '../../types/coreViews';
import { MessageModel, MessageModelState} from '../../models/common/layout';
import { Actions, ActionName } from '../../models/common/actions';

export interface CalendarProps {

}

export function init(he:Kontext.ComponentHelpers):React.FC<CalendarProps> {


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
    }

    const Heading:React.FC<{}> = (props) => {
        return <tr>
            <th>po</th>
            <th>ut</th>
            <th>st</th>
            <th>ct</th>
            <th>pa</th>
            <th>so</th>
            <th>ne</th>
        </tr>
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
                <div>month: {currState.month + 1}</div>
                <div>
                    <a onClick={handlePrevClick}>prev</a>
                    <a>{currState.year}</a>
                    <a onClick={handleNextClick}>next</a>
                </div>
                <table>
                    <thead>
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