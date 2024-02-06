/*
 * Copyright (c) 2023 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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

// ---------------- <KeywordsResult /> --------------------------------------

export const KeywordsResult = styled.form`

    .kword {
        font-size: 1.2em;
    }

    table.data tr:hover {
        background-color: ${theme.colorLightPink};
    }

    dl.corpora {
        max-width: 50em;
        display: grid;
        grid-template-columns: auto 1fr;
        grid-column-gap: 0.7em;
        align-items: center;

        dd {
            margin-inline-start: 0;
            font-weight: bold;
            font-size: 1.1em;
        }
    }

    .ktx-pagination {
        text-align: right;
        padding: 0.7em;
        display: flex;
        align-items: center;
    }

    .data {
        margin: 1em;
    }

    p.no-result {
        text-align: center;
        margin: 1em;
        padding-top: 2em;
        padding-bottom: 0;
        font-size: 120%;
    }

    p.modify {
        text-align: center;
        margin-top: 0.4em;
        margin-bottom: 3.5em;
    }
`;

// ------------------- <PaginatorWrapper /> -------------

export const PaginatorWrapper = styled.span`
    flex-grow: 1;
`;

// ------------------- <PNote /> ------------------------

export const PNote = styled.p`
    margin: 0;
    color: ${theme.colorLightText};
`
