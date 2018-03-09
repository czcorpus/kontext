/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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
import {ActionDispatcher} from '../app/dispatcher';
import {Kontext} from '../types/common';


export interface MessageViewProps {
    issueReportingView:React.SFC<{}>|React.ComponentClass<{}>;
}

export interface MessageViews {
    MessagePageHelp:React.SFC<MessageViewProps>;
}

export function init(dispatcher:ActionDispatcher, he:Kontext.ComponentHelpers):MessageViews {


    const MessagePageHelp:MessageViews['MessagePageHelp'] = (props) => {

        const handleCorporaClick = () => {
            window.location.href = he.createActionLink('corpora/corplist');
        };

        return <ul>
            <li>
                <a onClick={handleCorporaClick}>{he.translate('global__view_avail_corpora')}</a>
            </li>
            {props.issueReportingView ? <li><props.issueReportingView /></li> : null}
        </ul>;
    }


    return {
        MessagePageHelp: MessagePageHelp
    };

}