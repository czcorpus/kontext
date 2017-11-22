/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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



export const availConfLevels:Array<string> = ['0.1', '0.05', '0.01'];


export const wilsonConfInterval = (v:number, base:number, alphaId:string):[number, number] => {
    const z = { // scipy.stat.norm.pdf(1 - alpha / 2)
        '0.1': 1.6448536269514722,
        '0.05': 1.959963984540054,
        '0.01': 2.5758293035489004
    }[alphaId];
    const p = v / base;
    const sq = z * Math.sqrt( p * (1 - p) / base + z ** 2 / (4 * base ** 2) );
    const denom = 1 + z ** 2 / base;
    const a = p + z ** 2 / (2 * base);

    return [(a - sq) / denom, (a + sq) / denom];
}
