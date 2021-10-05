/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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


// ---------------- <PqueryResultSection /> ----------------------------

export const PqueryResultSection = styled.section`

    border: 1px solid ${theme.colorBgLightBlue};
    padding-bottom: 1em;
    min-width: 30em;

    table.data {
        margin: 1em 2em 1em 0;

        td.sum {
            font-size: 110%;
        }

        th.conc-group {
            text-align: center;
        }
    }

    table.data.busy tr td, table.data.busy tr th,
    table.data.busy tr td a, table.data.busy tr th a {
        color: ${theme.colorLightText} !important;
    }

    section.heading {
        display: flex;
        align-items: center;

        .controls {
            flex-grow: 1;
        }

        .loader {
            padding-right: 2em;
        }
    }

`;

// ---------------- <PageCounter /> ----------------------------

export const PageCounter = styled.section`

    margin: 0.5em 0;

    .num-input {
        margin: 0 1em;

        input {
            width: 2em;
        }

        input.error {
            background-color: ${theme.colorErrorInputBg};
        }
    }

    .inactive {
        opacity: 0.5;
        cursor: default;
    }
`;

// ----------------- <NoResultPar /> -------------------------------

export const NoResultPar = styled.p`

    font-size: 1.2em;

`;