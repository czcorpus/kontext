/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import * as React from 'react';
import * as Kontext from '../../types/kontext.js';
import * as S from './style.js';
import { SubcorpusRecord } from '../../models/subcorp/common.js';


export function init(he:Kontext.ComponentHelpers) {

    const layoutViews = he.getLayoutViews();


    // --------------------- <StatusDisplay /> -------------------------------------

    const StatusDisplay:React.FC<{
        isDraft:boolean;
        isArchived:boolean;

    }> = ({isDraft, isArchived}) => {



        if (isDraft) {
            return isArchived ?
                <span>{he.translate('subclist__draft')} ({he.translate('subclist__archived')})</span> :
                <span>{he.translate('subclist__draft')}</span>;

        } else if (isArchived) {
            return <>
                {he.translate('subclist__archived') + '\u00a0'}
                <layoutViews.InlineHelp customStyle={{maxWidth: '28em', fontSize: '0.8em'}}>
                    {he.translate('subclist__archived_status_help')}
                </layoutViews.InlineHelp>
            </>;

        } else {
            return <span>{he.translate('subclist__active')}</span>;
        }
    }

    // --------------------- <SubcorpusInfo /> -------------------------------------

    const SubcorpusInfo:React.FC<{
        data:SubcorpusRecord;
        standalone:boolean;
    }> = (props) => {
        return (
            <S.SubcorpusInfo>
                {props.standalone ?
                    <>
                        <h2 className="subcorpus-name">
                            {props.data.corpname}{'\u00a0/\u00a0'}<strong>{props.data.name}</strong>
                        </h2>
                    </> :
                    null
                }
                <dl>
                    <dt>{he.translate('subclist__subc_status')}:</dt>
                    <dd>
                        <StatusDisplay isArchived={!!props.data.archived} isDraft={props.data.isDraft} />
                    </dd>
                    <dt>{he.translate('global__size_in_tokens')}:</dt>
                    <dd>{props.data.size ? he.formatNumber(props.data.size) : '--'}</dd>
                    <dt>{he.translate('pubsubclist__author')}:</dt>
                    <dd>{props.data.authorFullname}</dd>
                    <dt>{he.translate('global__subcorp_created_at')}:</dt>
                    <dd>{he.formatDate(new Date(props.data.created * 1000), 1)}</dd>
                    <dt>{he.translate('global__published_subcorp_id')}:</dt>
                    <dd>{props.data.usesubcorp}</dd>
                    {props.data.description && props.standalone ?
                        <>
                            <dt>{he.translate('global__description')}:</dt>
                            <dd className="description">
                                <div className="html" dangerouslySetInnerHTML={{__html: props.data.description}} />
                            </dd>
                        </> :
                        null
                    }
                </dl>
                <div>
                    <form action={he.createActionLink('query')}>
                        <input type="hidden" name="corpname" value={props.data.corpname} />
                        <input type="hidden" name="usesubcorp" value={props.data.usesubcorp} />
                        <button className="default-button" type="submit">{he.translate('global__use_in_query')}</button>
                    </form>
                </div>
            </S.SubcorpusInfo>
        );
    };

    return SubcorpusInfo;

}