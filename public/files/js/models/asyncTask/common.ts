/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Subject } from 'rxjs';


export function taskCheckTimer():Subject<number> {
    const intervals = [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10.5, 12, 13.5, 15, 16.5, 18, 19.5, 21, 22.5, 24, 26,
        28, 30, 32, 34, 36, 38, 40, 42, 44, 47, 50, 53, 56, 59, 62, 65, 68, 71, 74, 79, 84,
        89, 94, 99, 104, 109, 114, 119, 124, 132, 140, 148, 156, 164, 172, 180, 188, 196,
        204, 216, 228, 240, 252, 264, 284, 304, 324, 344, 374, 420, 500, 600];

    const findValue = (v:number) => {
        for (let i = 0; i < intervals.length; i++) {
            if (v === intervals[i]) {
                return intervals[i];
            }
        }
        return undefined;
    }

    const timer = new Subject<number>();
    let elapsed = 0;
    window.setInterval(() => {
        const val = findValue(elapsed);
        if (val !== undefined) {
            timer.next(val);

        } else if (elapsed > intervals[intervals.length - 1]) {
            timer.complete();
        }
        elapsed += 0.5;
    }, 500);

    return timer;
}
