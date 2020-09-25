/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
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

import * as React from 'react';
import { Keyboard, List, tuple } from 'cnc-tskit';
import { IActionDispatcher } from 'kombo';

import { Kontext, TextTypes } from '../../types/common';
import { TTSelOps } from '../../models/textTypes/selectionOps';
import { CoreViews } from '../../types/coreViews';
import { Actions, ActionName } from '../../models/textTypes/actions';
import { AnyTTSelection, WidgetView } from '../../models/textTypes/common';
import { init as commonViewInit } from './common';



function rangeToRegexp(d1:Date, d2:Date):string {

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

export interface CalendarDaysSelectorProps {
    attrObj:AnyTTSelection;
}

export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers):React.FC<CalendarDaysSelectorProps> {

    const commonViews = commonViewInit(dispatcher, he);
    const layoutViews = he.getLayoutViews();


    const CalendarDaysSelector:React.FC<CalendarDaysSelectorProps> = (props) => {

        const [state, setState] = React.useState({
            fromDate:[0, 0, 0],
            toDate:[0, 0, 0]
        });

        const handleCalClick = (cal:'from'|'to') => (y:number, m:number, d:number) => {
            if (cal === 'from') {
                setState({fromDate: [y, m, d], toDate: state.toDate});

            } else {
                setState({fromDate: state.fromDate, toDate: [y, m, d]});
            }
        };

        const handleConfirmClick = () => {
            dispatcher.dispatch<Actions.AttributeTextInputChanged>({
                name: ActionName.AttributeTextInputChanged,
                payload: {
                    attrName: props.attrObj.name,
                    value: rangeToRegexp(
                        new Date(state.fromDate[0], state.fromDate[1], state.fromDate[2]),
                        new Date(state.toDate[0], state.toDate[1], state.toDate[2]))
                }
            });
        }

        return <div className="CalendarDaysSelector">
            <layoutViews.Calendar onClick={handleCalClick('from')} />
            <layoutViews.Calendar onClick={handleCalClick('to')} />
            <button type="button" onClick={handleConfirmClick}>OK</button>
        </div>;
    }

    return CalendarDaysSelector;

}