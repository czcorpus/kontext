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

import * as TextTypes from '../../types/textTypes';
import { List, pipe } from 'cnc-tskit';


/**
 * TTSelOps is a set of operations applicable for any type of text type selection
 * (full list, raw input, regexp)
 */
export class TTSelOps {

    static mapValues(
        sel:TextTypes.AnyTTSelection,
        mapFn:(item:TextTypes.AttributeValue, i?:number)=>TextTypes.AttributeValue
    ):TextTypes.AnyTTSelection {
        return sel.type === 'regexp' ? sel : {...sel, values: List.map(mapFn, sel.values)}
    };

    static toggleValueSelection(sel:TextTypes.AnyTTSelection, idx:number):TextTypes.AnyTTSelection {
        if (sel.type === 'text') {
            const val = sel.values[idx];
            if (val.selected) {
                return {
                    ...sel,
                    values: List.removeAt(idx, sel.values)
                }

            } else {
                return sel;
            }

        } else if (sel.type === 'full') {
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

    static containsFullList(sel:TextTypes.AnyTTSelection):boolean {
        if (sel.type === 'full') {
            return true;
        }
        return false;
    }

    static hasUserChanges(sel:TextTypes.AnyTTSelection):boolean {
        if (sel.type === 'regexp') {
            return !!sel.textFieldValue;

        } else {
            const hasSelected = List.some((item:TextTypes.AttributeValue) => item.selected === true, sel.values);
            if (sel.type === 'text') {
                return hasSelected || !!sel.textFieldValue;
            }
            return hasSelected;
        }
    }

    static exportSelections(sel:TextTypes.AnyTTSelection, lockedOnesOnly:boolean):Array<string> {
        if (sel.type === 'regexp') {
            return [sel.textFieldValue];
        }
        const filter = lockedOnesOnly ?
            List.filter<TextTypes.AttributeValue>(item => item.locked) :
            List.filter<TextTypes.AttributeValue>(_ => true);

        return pipe(
            sel.values,
            filter,
            List.filter(item => item.selected === true),
            List.map(item => item.ident),
            sel.type === 'text' && sel.textFieldValue !== '' ?
                List.push(sel.textFieldValue) : x => x
        );
    }

    static keepIfPresentIn(sel:TextTypes.AnyTTSelection, items:Array<string>):TextTypes.AnyTTSelection {
        if (sel.type === 'regexp') {
            return sel;

        } else {
            let values:Array<TextTypes.AttributeValue>;
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
                        ident: item, // TODO is this correct? (ident vs label problem)
                        numGrouped: 0
                    }),
                    items
                );
            }
            return {
                ...sel,
                values
            };

        }
    }

    static filter(sel:TextTypes.AnyTTSelection, fn:(v:TextTypes.AttributeValue)=>boolean):TextTypes.AnyTTSelection {
        return sel.type === 'regexp' ?
            sel :
            {...sel, values: sel.values.filter(fn)};
    }

    static addValue(sel:TextTypes.AnyTTSelection, value:TextTypes.AttributeValue):TextTypes.AnyTTSelection {
        if (sel.type == 'text') {
            if (sel.values.find(x => x.value === value.value) === undefined) {
                return {
                    ...sel,
                    values: sel.values.concat([value])
                };

            } else {
                return sel;
            }

        } else {
            throw new Error('only TextInputAttributeSelection can add new values');
        }
    }

    static removeValue(sel:TextTypes.AnyTTSelection, value:string):TextTypes.AnyTTSelection {
        if (sel.type === 'text') {
            const idx = List.findIndex(x => x.value === value, sel.values);
            if (idx > -1) {
                const values = List.removeAt(idx, sel.values);
                return {
                    ...sel,
                    values
                };

            } else {
                return sel;
            }

        } else {
            throw new Error('only TextInputAttributeSelection can add new values');
        }
    }

    static clearValues(sel:TextTypes.AnyTTSelection):TextTypes.AnyTTSelection {
        return sel.type === 'regexp' ?
            sel :
            {...sel, values: []};
    }

    static setValues(sel:TextTypes.AnyTTSelection, values:Array<TextTypes.AttributeValue>):TextTypes.AnyTTSelection {
        return sel.type === 'regexp' ?
            sel :
            {...sel, values};
    }

    static getValues(sel:TextTypes.AnyTTSelection):Array<TextTypes.AttributeValue> {
        return sel.type === 'regexp' ? [] : sel.values;
    }

    static setAutoComplete(sel:TextTypes.AnyTTSelection, values:Array<TextTypes.AutoCompleteItem>):TextTypes.AnyTTSelection {
        if (sel.type === 'text') {
            return {
                ...sel,
                autoCompleteHints: values
            };

        } else {
            throw new Error('Auto complete not supported in checkbox only text type selection');
        }
    }

    static resetAutoComplete(sel:TextTypes.AnyTTSelection):TextTypes.AnyTTSelection {
        if (sel.type === 'text') {
            return {
                ...sel,
                autoCompleteHints: []
            }

        } else {
            throw new Error('Auto complete not supported in checkbox only text type selection');
        }
    }

    static getAutoComplete(sel:TextTypes.AnyTTSelection):Array<TextTypes.AutoCompleteItem> {
        if (sel.type === 'text') {
            return sel.autoCompleteHints;

        } else {
            throw new Error('Auto complete not supported in checkbox only text type selection');
        }
    }

    static isLocked(sel:TextTypes.AnyTTSelection):boolean {
        return sel.type === 'regexp' ? sel.isLocked : List.some(item => item.locked, sel.values);
    }

    static setExtendedInfo(
        sel:TextTypes.AnyTTSelection,
        ident:string,
        data:TextTypes.ExtendedInfo
    ):TextTypes.AnyTTSelection {

        if (sel.type === 'regexp') {
            return sel;

        } else {
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
    }

    static getNumOfSelectedItems(sel:TextTypes.AnyTTSelection):number {
        return sel.type === 'regexp' ?
            0 :
            List.foldl(
                (p, curr) => p + (curr.selected ? 1 : 0),
                0,
                sel.values
            );
    }

    static setTextFieldValue(
        sel:TextTypes.AnyTTSelection,
        value:string,
        valueDecoded?:string
    ):TextTypes.AnyTTSelection {

        if (sel.type === 'text') {
            return {
                ...sel,
                textFieldValue: value
            };

        } else if (sel.type === 'regexp') {
            return {
                ...sel,
                textFieldValue: value,
                textFieldDecoded: valueDecoded ? valueDecoded : value
            };

        } else {
            throw new Error('Only "text" and "regexp" selections support setting of textFiledValue');
        }
    }


    static getTextFieldValue(sel:TextTypes.AnyTTSelection):string {
        if (sel.type === 'text' || sel.type === 'regexp') {
            return sel.textFieldValue;

        } else {
            throw new Error('Only "text" and "regexp" selections support getting of textFiledValue');
        }
    }
}
