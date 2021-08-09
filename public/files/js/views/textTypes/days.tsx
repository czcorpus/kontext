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
import { List, tuple } from 'cnc-tskit';
import { IActionDispatcher } from 'kombo';

import * as Kontext from '../../types/kontext';
import * as TextTypes from '../../types/textTypes';
import { Actions } from '../../models/textTypes/actions';

import * as S from './style';


function rangeToRegexp(d1:Date, d2:Date):string {

    function packDays(data:Array<Date>) {
        return List.foldl(
            ([,,days], curr) => tuple(
                curr.getFullYear().toFixed(),
                md2str(curr.getMonth() + 1),
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
                months.concat([md2str(curr.getMonth() + 1)])
            ),
            ['', []] as [string, Array<string>],
            data
        );
    }

    function md2str(v:number):string {
        return (v < 10 ? '0' : '') + v;
    }
    if (Math.abs(d1.getTime() - d2.getTime()) > 100 * 365 * 3600 * 1000) {
        throw new Error('Only ranges up to 100 years can be selected via the calendars');
    }
    const toEndOfMonth1:Array<Date> = [];
    let md = new Date(d1);
    while (md.getMonth() === d1.getMonth() && md.getTime() < d2.getTime()) {
        toEndOfMonth1.push(md);
        md = new Date(md);
        md.setDate(md.getDate() + 1);
    }
    const toEndOfYear1:Array<Date> = [];
    while (md.getFullYear() === d1.getFullYear() && (d1.getFullYear() === d2.getFullYear() ? md.getMonth() < d2.getMonth() : true)) {
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
    while (md.getDate() <= d2.getDate() && md.getTime() <= d2.getTime()) {
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
        ans.push(`${comp1[0]}-${comp1[1]}-${comp1[2][0]}`);
        if (comp1[2].length > 1) {
            ans.push(`${comp1[0]}-${comp1[1]}-(${comp1[2].slice(1).join('|')})`);
        }
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
        if (comp5[2].length > 1) {
            ans.push(`${comp5[0]}-${comp5[1]}-(${comp5[2].slice(0, comp5[2].length - 1).join('|')})`);
        }
        ans.push(`${comp5[0]}-${comp5[1]}-${comp5[2][comp5[2].length - 1]}`);
    }

    return ans.join('|');
}

function regexpToRange(regexp:string):[Date, Date] {
    if (regexp) {
        const fromDate = regexp.match(/(?=^)\d{4}-\d{2}-\d{2}/);
        const toDate = regexp.match(/\d{4}-\d{2}-\d{2}(?=$)/);
        const d1 = new Date(fromDate[0]);
        const d2 = new Date(toDate[0]);
        d1.setHours(0);
        d2.setHours(0);
        return [d1, d2];
    }
    return [null, null];
}

export interface CalendarDaysSelectorProps {
    attrObj:TextTypes.AnyTTSelection;
    firstDayOfWeek:'mo'|'su'|'sa';
}


function localIsoDate(d:Date):string {
    return new Date(d.getTime() -  60000 * d.getTimezoneOffset()).toISOString().split('T')[0];
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers):React.FC<CalendarDaysSelectorProps> {

    const layoutViews = he.getLayoutViews();


    const CalendarDaysSelector:React.FC<CalendarDaysSelectorProps> = (props) => {
        const attrObj = props.attrObj;
        if (attrObj.type !== 'regexp') {
            throw new Error(`Invalid attribute type for CalendarDaysSelector: ${attrObj.type}`);
        }
        const [initFromDate, initToDate] = regexpToRange(attrObj.textFieldValue);
        const [state, setState] = React.useState<{fromDate:Date|null; toDate: Date|null}>({
            fromDate: initFromDate,
            toDate: initToDate
        });

        const handleCalClick = (cal:'from'|'to') => (d:Date|null) => {
            const newState = cal === 'from' ?
                    {fromDate: d, toDate: state.toDate} :
                    {fromDate: state.fromDate, toDate: d};
            setState({...newState});

            if (newState.fromDate !== null && newState.toDate !== null) {
                dispatcher.dispatch<typeof Actions.AttributeTextInputChanged>({
                    name: Actions.AttributeTextInputChanged.name,
                    payload: {
                        attrName: props.attrObj.name,
                        type: props.attrObj.type,
                        value: rangeToRegexp(newState.fromDate, newState.toDate),
                        decodedValue: `${localIsoDate(newState.fromDate)}, \u2026, ${localIsoDate(newState.toDate)}`
                    }
                });

                dispatcher.dispatch<typeof Actions.SelectionChanged>({
                    name: Actions.SelectionChanged.name,
                    payload: {
                        hasSelectedItems: true,
                        attributes: []
                    }
                });
            }
        };

        return (
            <S.CalendarDaysSelector>
                <div className="calendars">
                    <div>
                        <h3>{he.translate('query__tt_calendar_from_date')}</h3>
                        <layoutViews.Calendar onClick={handleCalClick('from')} firstDayOfWeek={props.firstDayOfWeek} currDate={state.fromDate} />
                    </div>
                    <div>
                        <h3>{he.translate('query__tt_calendar_to_date')}</h3>
                        <layoutViews.Calendar onClick={handleCalClick('to')} firstDayOfWeek={props.firstDayOfWeek} currDate={state.toDate}/>
                    </div>
                </div>
                <p className={`info${state.fromDate === null || state.toDate === null ? '' : ' note'}`}>
                    {state.fromDate === null || state.toDate === null ?
                        he.translate('query__tt_no_date_range_selected') :
                        '(' + he.translate('query__tt_you_can_unselect_date_range') + ')'}
                </p>
            </S.CalendarDaysSelector>
        );
    }

    return CalendarDaysSelector;

}