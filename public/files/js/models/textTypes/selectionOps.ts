/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

import { TextTypes } from '../../types/common';
import { List, pipe } from 'cnc-tskit';
import { AnyTTSelection } from './common';


export type ExtendedInfo = {[key:string]:any}; // TODO type


/**
 * TTSelOps is a set of operations for both
 * TextTypes.TextInputAttributeSelection and TextTypes.FullAttributeSelection
 */
export namespace TTSelOps {


    export function mapValues(
        sel:AnyTTSelection,
        mapFn:(item:TextTypes.AttributeValue, i?:number)=>TextTypes.AttributeValue
    ):AnyTTSelection {
        return {
            ...sel,
            values: List.map(mapFn, sel.values)
        };
    }

    export function toggleValueSelection(sel:AnyTTSelection, idx:number):AnyTTSelection {
        const val = sel.values[idx];
        if (sel.type === 'text') {
            if (val.selected) {
                return {
                    ...sel,
                    values: List.removeAt(idx, sel.values)
                }

            } else {
                return sel;
            }

        } else {
            return {
                ...sel,
                values: List.map(
                    (v, i) => ({
                        ...v,
                        selected: i === idx ? !v.selected : v.selected
                    }),
                    sel.values
                )
            };
        }
    }

    export function containsFullList(sel:AnyTTSelection):boolean {
        if (sel.type === 'full') {
            return true;
        }
        return false;
    }

    export function hasUserChanges(sel:AnyTTSelection):boolean {
        const hasSelected = List.some((item:TextTypes.AttributeValue) => item.selected === true, sel.values);
        if (sel.type === 'text') {
            return hasSelected || !!sel.textFieldValue;
        }
        return hasSelected;
    }

    export function exportSelections(sel:AnyTTSelection, lockedOnesOnly:boolean):Array<string> {
        const items = lockedOnesOnly ?
        sel.values.filter((item:TextTypes.AttributeValue)=>item.locked) :
        sel.values;

        return pipe(
            items,
            List.filter((item:TextTypes.AttributeValue) => item.selected === true),
            List.map((item:TextTypes.AttributeValue) => item.ident)
        );
    }

    export function keepIfPresentIn(sel:AnyTTSelection, items:Array<string>):AnyTTSelection {
        let values;
        if (!List.empty(sel.values)) {
            values = List.filter(
                (item:TextTypes.AttributeValue) => items.indexOf(item.ident) > -1,
                sel.values
            );

        } else {
            values = List.map(
                item => ({
                    value: item,
                    selected: false,
                    locked: false,
                }),
                items
            );
        }
        return {
            ...sel,
            values
        };
    }

    export function filter(sel:AnyTTSelection, fn:(v:TextTypes.AttributeValue)=>boolean):AnyTTSelection {
        return {
            ...sel,
            values: sel.values.filter(fn)
        };
    }

    export function addValue(sel:AnyTTSelection, value:TextTypes.AttributeValue):AnyTTSelection {
        if (sel.type === 'text') {
            if (sel.values.find(x => x.value === value.value) === undefined) {
                return {
                    ...sel,
                    values: sel.values.concat([value])
                };

            } else {
                return this;
            }

        } else {
            throw new Error('FullAttributeSelection cannot add new values');
        }
    }

    export function removeValue(sel:AnyTTSelection, value:string):AnyTTSelection {
        if (sel.type === 'text') {
            const idx = List.findIndex(x => x.value === value, sel.values);
            if (idx > -1) {
                const values = List.removeAt(idx, sel.values);
                return {
                    ...sel,
                    values
                };

            } else {
                return this;
            }

        } else {
            throw new Error('FullAttributeSelection cannot remove values');
        }
    }

    export function clearValues(sel:AnyTTSelection):AnyTTSelection {
        return {
            ...sel,
            values: []
        };
    }

    export function setValues(sel:AnyTTSelection, values:Array<TextTypes.AttributeValue>):AnyTTSelection {
        return {
            ...sel,
            values
        };
    }

    export function setAutoComplete(sel:AnyTTSelection, values:Array<TextTypes.AutoCompleteItem>):AnyTTSelection {
        if (sel.type === 'text') {
            return {
                ...sel,
                autoCompleteHints: values
            };

        } else {
            throw new Error('Auto complete not supported in checkbox only text type selection');
        }
    }

    export function resetAutoComplete(sel:AnyTTSelection):AnyTTSelection {
        if (sel.type === 'text') {
            return {
                ...sel,
                autoCompleteHints: []
            }

        } else {
            throw new Error('Auto complete not supported in checkbox only text type selection');
        }
    }

    export function getAutoComplete(sel:AnyTTSelection):Array<TextTypes.AutoCompleteItem> {
        if (sel.type === 'text') {
            return sel.autoCompleteHints;

        } else {
            throw new Error('Auto complete not supported in checkbox only text type selection');
        }
    }

    export function isLocked(sel:AnyTTSelection):boolean {
        return List.some(item => item.locked, sel.values);
    }

    export function setExtendedInfo(sel:AnyTTSelection, ident:string, data:ExtendedInfo):AnyTTSelection {
        const srchIdx = sel.values.findIndex(v => v.ident === ident);
        if (srchIdx > -1) {
            const valuesCopy = [...sel.values];
            const currVal = valuesCopy[srchIdx];
            const newVal = {
                ...currVal,
                extendedInfo: data
            };
            valuesCopy[srchIdx] = newVal;
            return {
                ...sel,
                values: valuesCopy
            };

        } else {
            throw new Error(`Cannot set extended info - ident ${ident} not found`);
        }
    }

    export function getNumOfSelectedItems(sel:AnyTTSelection):number {
        return List.foldl(
            (p, curr) => p + (curr.selected ? 1 : 0),
            0,
            sel.values
        );
    }

    export function setTextFieldValue(sel:AnyTTSelection, value:string):AnyTTSelection {
        if (sel.type === 'text') {
            return {
                ...sel,
                textFieldValue: value
            };

        } else {
            throw new Error('Cannot set text field in checkbox only text type selection');
        }
    }


    export function getTextFieldValue(sel:AnyTTSelection):string {
        if (sel.type === 'text') {
            return sel.textFieldValue;

        } else {
            throw new Error('Cannot set text field in checkbox only text type selection');
        }
    }
}
