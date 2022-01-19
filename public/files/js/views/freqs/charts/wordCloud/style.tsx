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
import * as theme from '../../../theme/default';

// ---------------- <WdgTooltip /> --------------------------------------

export const WdgTooltip = styled.div<{multiword?:boolean}>`
    background-color: #FFFFFF;
    z-index: 10000;
    padding: ${props => props.multiword ? '0.3em 1em 1.3em 1em' : '1em'};
    border: 1px solid ${theme.colorLightGrey};
    border-radius: 3px;
    border-spacing: 0;
    border-collapse: collapse;
    line-height: 1.2em;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.25);

    table {
        .value {
            ${props => props.multiword ? null : 'font-weight: bold'};
            text-align: left;
        }

        .label {
            text-align: ${props => props.multiword ? 'center' : 'right'};
            padding: ${props => props.multiword ? '0 10px 0 10px' : '0 0.4em 0 0'};
            ${props => props.multiword ? 'font-weight: 900' : null};
            ${props => props.multiword ? 'color: white' : null};
        }

        th {
            padding: ${props => props.multiword ? '10px 0' : '0 0 1em 0'};
            ${props => props.multiword ? 'text-align: left' : null};
            ${props => props.multiword ? 'font-weight: bolder' : null};
        }

        td {
            text-align: left;
        }

        td.numWh {
            text-align: right;
            padding: ${props => props.multiword ? '0 0 0 10px' : '0 0 0 1em'};
        }

        td.numDec {
            padding: 0;
        }

        td.unit {
            text-align: left;
        }
    }
`;
