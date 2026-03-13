/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import * as Kontext from '../../types/kontext.js';
import { ConcRestoreModel, ConcRestoreModelState } from '../../models/concRestore/index.js';
import { WaitingForConc as S_WaitingForConc } from '../../views/concordance/main/style.js';
import * as S from './style.js';


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, model:ConcRestoreModel) {

    const layoutViews = he.getLayoutViews();

    const View:React.FC<ConcRestoreModelState> = (props) => (
        <S.ConcRestore>
            {props.isBusy ?
                <>
                    <p>{he.translate('concRestore__please_wait_msg')}</p>
                    {props.isSlowQUery ?
                        <S_WaitingForConc>
                            <div className="cqlizer-note">
                                <div className="messages">
                                    <div className="icon">
                                        <img src={he.createStaticUrl('img/hourglass.svg')} />
                                        <span className="excl">!</span>
                                    </div>
                                    <p>
                                        <span>
                                            {he.translateRich('concview__this_is_a_possibly_slow_query',
                                                {strong: (chunks) => <strong key="chunks">{chunks}</strong>}
                                            )}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </S_WaitingForConc> :
                        <>
                            <layoutViews.AjaxLoaderImage />
                        </>
                    }
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
