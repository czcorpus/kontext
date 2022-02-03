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

import styled from 'styled-components';
import * as theme from '../../theme/default';


// -------------- <DataRowTR /> --------------

export const DataRowTR = styled.tr`

    .bar {
        background-color: ${theme.colorLogoBlue};
    }

    td.bci {

        text-align: left;

        .bracket {
            font-size: 1.1em;
            display: inline-block;
            padding-left: 0.2em;
            padding-right: 0.2em;
        }

        .separ {
            display: inline-block;
            padding-left: 0.15em;
            padding-right: 0.25em;
            font-weight: bold;
            font-size: 1.2em;
        }
    }

    .frac {
        color: ${theme.colorLightText};
    }
`;

// -------------- <ValueTD /> --------------

export const ValueTD = styled.td<{ monospace: boolean }>`

    font-family: ${props => props.monospace ? theme.monospaceFontFamily : theme.defaultFontFamily};

`;

// -------------- <DataTableDiv /> -------------

export const DataTable = styled.div`

    .skipped-info {
        display: flex;
        align-items: center;
        margin-top: 1em;
        width: 90%;

        img {
            width: 1.4em;
        }

        p {
            margin-left: 0.7em;
            display: inline;
        }
    }
`;