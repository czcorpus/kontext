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
import * as theme from '../theme/default';

// ---------------- <CollForm /> --------------------------------------

export const CollForm = styled.form`
    margin-bottom: 2em;
`;

// ---------------- <CollMetricsSelection /> --------------------------------------

export const CollMetricsSelection = styled.table`
    margin-left: 2em;
    border-spacing: 0;
    border-collapse: collapse;

    td.display-chk,
    td.unique-sel {
        cursor: pointer;

        input {
            cursor: pointer;
        }
    }

    thead tr th,
    thead tr td,
    tbody tr.func th,
    tbody tr.func td {
        border: none;
    }

    thead tr th {
        color: ${theme.colorLightText};
    }

    tr th, td {
        border: 1px solid ${theme.colorLightText};
        padding: 0.3em 1em 0.3em 0.6em;
    }

    tr:nth-child(2n) {
        background-color: ${theme.colorTableEvenBg};
    }

    td.display-chk {
        text-align: center;
    }

    tr td.unique-sel {
        text-align: center;
    }

    th.row-hd {
        text-align: left;
        font-weight: normal;
    }

    td.select-whole-col {
        padding-top: 0.4em;
        vertical-align: middle;

        input[type="checkbox"] {
            vertical-align: middle;
        }
    }
`;
