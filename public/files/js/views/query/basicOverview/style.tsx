/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
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
import * as theme from '../../theme/default'

// ------------------ <QueryOverviewDiv /> ----------------

export const QueryOverviewDiv = styled.div`

    padding: 1.5em;
    background-color: #E9F7FC;
    text-align: center;

    h3 {
        display: inline-block;
        margin-top: 0;
        margin-bottom: 0.5em;
        border-style: solid;
        border-color: ${theme.colorDefaultGreen};
        border-width: 0 0 1px 0;
    }

    table {
        border-collapse: collapse;
        border: none;
    }

    table th,
    table td {
        padding: 5px 1em;
    }

    table th {
        color: ${theme.colorLogoPink};
        border: none;
    }

    table td {
        text-align: left;
        border: 1px solid ${theme.colorDefaultGreen};
    }
`;

// --------------------- <QueryOverviewBarUL /> ----------------------

export const QueryOverviewBarUL = styled.ul`

    padding: 0;
    margin: 0;
    list-style-type: none;
    font-family: ${theme.condensedFontFamily};

    > li {
        display: inline-block;
        margin: 0;
    }

    > li a.args {
        text-decoration: none;
        color: ${theme.colorLogoBlue};
    }

    > li a.args:hover {
        text-decoration: underline;
    }

    > li .transition {
        font-size: 120%;
        color: ${theme.colorLightText};
    }

`;