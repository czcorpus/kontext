/*
 * Copyright (c) 2022 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
 * Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>

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

import { Action } from 'kombo';
import { ChartExportFormat } from '../../types/kontext.js';
import { DispersionDataRow } from './result.js';



export class Actions {

    static SubmitForm:Action<{
        reloadPage?:boolean;

    }> = {
        name: 'FREQ_DISPERSION_SUBMIT_FORM'
    };

    static ReloadDone:Action<{
        data:Array<DispersionDataRow>;

    }> = {
        name: 'FREQ_DISPERSION_RELOAD_DONE'
    };

    static ChangeResolution:Action<{
        value:string;

    }> = {
        name: 'FREQ_DISPERSION_CHANGE_RESOLUTION'
    };

    static ChangeResolutionAndReload:Action<{
        value:string;

    }> = {
        name: 'FREQ_DISPERSION_CHANGE_RESOLUTION_AND_RELOAD'
    };

    static SetDownloadFormat:Action<{
        format:ChartExportFormat;

    }> = {
        name: 'FREQ_DISPERSION_SET_DOWNLOAD_FORMAT'
    };

}
