/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import styled from 'styled-components';
import * as theme from '../../theme/default';


export const QueryHistoryRows = styled.ol`
    margin: 0;
    padding: 0;

    li {
        padding: 5px 8px;
        border-radius: ${theme.borderRadiusDefault};
        cursor: pointer;
        color: #999999;
        overflow: hidden;

        .wrapper {
            color: ${theme.colorDefaultText};
        }

        em {
            display: inline;
            font-style: normal;
        }

        .corpname {
            color: #999999;
            font-size: 80%;
            padding-left: 0.5em;
        }
    }

    li.selected {
        background-color: ${theme.colorWhitelikeBlue};
    }

    .footer {
        background-color: ${theme.colorLightGreen};
        text-align: right;
        padding: 3px 0;
    }
`;
