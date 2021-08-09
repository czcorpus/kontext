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

import * as React from 'react';
import * as Kontext from '../../types/kontext';
import * as CoreViews from '../../types/coreViews';
import { IActionDispatcher } from 'kombo';


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers
):{IssueReportingWidget:React.FC<CoreViews.IssueReportingLink.Props>} {

    const layoutViews = he.getLayoutViews();


    const IssueReportingWidget:React.FC<CoreViews.IssueReportingLink.Props> = (props) => {
        return <span><layoutViews.IssueReportingLink {...props} /></span>;
    };

    return {
        IssueReportingWidget
    };
}