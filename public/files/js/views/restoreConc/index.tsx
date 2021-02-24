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

import * as React from 'react';
import { IActionDispatcher, Bound } from 'kombo';
import { Kontext } from '../../types/common';
import { ConcRestoreModel, ConcRestoreModelState } from '../../models/concRestore';
import * as S from './style';


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, model:ConcRestoreModel) {

    const layoutViews = he.getLayoutViews();

    const View:React.FC<ConcRestoreModelState> = (props) => (
        <S.ConcRestore>
            {props.isBusy ?
                <>
                    <layoutViews.AjaxLoaderImage />
                    <p>{he.translate('concRestore__please_wait_msg')}</p>
                </> :
                <div>
                    <p>{he.translate('concRestore__conc_ready')}</p>
                    <p>{he.translate('concRestore__result_link')}:<br />
                    <a className="result-link" href={props.nextActionLink}>{props.nextActionLink}</a></p>
                </div>
            }
        </S.ConcRestore>
    );

    return Bound(View, model);
};
