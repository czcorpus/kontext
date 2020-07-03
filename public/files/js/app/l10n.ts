/*
 * Copyright (c) 2013 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../vendor.d.ts/intl-messageformat.d.ts" />
/// <reference path="../vendor.d.ts/translations.d.ts" />

import * as translations from 'translations';
import * as IntlMessageFormat from '../vendor/intl-messageformat';
import { ITranslator } from 'kombo';

/**
 * L10n provides a set of essential localization functions.
 */
export class L10n implements ITranslator {

    private uiLang:string;

    private translations:{[key:string]:string};

    private helpLinks:{[key:string]:string};

    /**
     *
     */
    constructor(uiLang:string, helpLinks:{[key:string]:string}) {
        this.uiLang = uiLang;
        this.translations = translations[uiLang] || {};
        this.helpLinks = {...helpLinks};
    }

    /**
     * Translate a message identified by a provided key.
     * Null/undefined messages are translated into
     * an empty string. Non-translated keys are passed
     * as they are.
     */
    translate(msg:string, values?:{[key:string]:string|number|boolean}):string {
        if (msg) {
            const tmp = this.translations[msg];
            if (tmp) {
                try {
                    const format = new IntlMessageFormat(this.translations[msg], this.uiLang);
                    return format.format(values);

                } catch (e) {
                    console.error('Failed to translate ', msg, e);
                    return tmp;
                }
            }
            return msg;
        }
        return '';
    }

    formatNumber(v:number, fractionDigits:number=2):string {
        let format:any = new Intl.NumberFormat(this.uiLang, {
            maximumFractionDigits: fractionDigits
        });
        return format.format(v);
    }

    /**
     * @param d a Date object
     * @param timeFormat 0 = no time, 1 = hours + minutes, 2 = hours + minutes + seconds
     *  (hours, minutes and seconds are always in 2-digit format)
     */
    formatDate(d:Date, timeFormat:number=0):string {
        const opts = {year: 'numeric', month: '2-digit', day: '2-digit'};

        if (timeFormat > 0) {
            opts['hour'] = '2-digit';
            opts['minute'] = '2-digit';
        }
        if (timeFormat === 2) {
            opts['second'] = '2-digit';
        }
        return new Intl.DateTimeFormat(this.uiLang, opts).format(d);
    }

    /**
     *
     */
    getHelpLink(ident:string):string {
        return this.helpLinks[ident];
    }
}